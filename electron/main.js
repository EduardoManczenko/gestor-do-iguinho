const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 3157; // Porta customizada para evitar conflitos
const NEXT_DIR = path.join(__dirname, '..', 'website');

let mainWindow = null;
let serverProcess = null;

// ─── Configuração de dados ─────────────────────────────────────────────────

function getUserDataDir() {
  return app.getPath('userData');
}

// ─── Servidor Next.js ─────────────────────────────────────────────────────

function startNextServer() {
  const userDataDir = getUserDataDir();

  // Garante que a pasta de dados existe
  fs.mkdirSync(userDataDir, { recursive: true });

  const env = {
    ...process.env,
    PORT: String(PORT),
    GESTOR_CONFIG_DIR: userDataDir,
    NODE_ENV: 'production',
  };

  // Verifica se existe o servidor standalone (build de produção)
  const standaloneServer = path.join(NEXT_DIR, '.next', 'standalone', 'server.js');
  const hasStandalone = fs.existsSync(standaloneServer);

  if (hasStandalone) {
    console.log('[Electron] Iniciando Next.js standalone...');
    serverProcess = spawn('node', [standaloneServer], {
      cwd: path.join(NEXT_DIR, '.next', 'standalone'),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } else {
    // Desenvolvimento: usa 'next start' após 'next build', ou 'next dev'
    const hasNextBuild = fs.existsSync(path.join(NEXT_DIR, '.next'));
    const script = hasNextBuild ? 'start' : 'dev';
    console.log(`[Electron] Iniciando Next.js em modo ${script}...`);

    // No Windows usa o .cmd, no Unix usa o binário diretamente
    const isWin = process.platform === 'win32';
    const nextBin = isWin
      ? path.join(NEXT_DIR, 'node_modules', '.bin', 'next.cmd')
      : path.join(NEXT_DIR, 'node_modules', '.bin', 'next');

    serverProcess = spawn(
      nextBin,
      [script, '-p', String(PORT)],
      {
        cwd: NEXT_DIR,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWin, // Necessário no Windows para executar .cmd
      }
    );
  }

  serverProcess.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log('[Next.js]', msg);
  });

  serverProcess.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error('[Next.js err]', msg);
  });

  serverProcess.on('error', (err) => {
    console.error('[Electron] Falha ao iniciar servidor:', err);
  });
}

// ─── Aguardar servidor ─────────────────────────────────────────────────────

function waitForServer(callback, tentativas = 60, intervalo = 1000) {
  http.get(`http://localhost:${PORT}/api/clientes`, (res) => {
    if (res.statusCode < 500) {
      callback();
    } else {
      retry();
    }
  }).on('error', () => {
    retry();
  });

  function retry() {
    if (tentativas <= 0) {
      console.error('[Electron] Servidor não respondeu após várias tentativas.');
      callback(); // Tenta carregar mesmo assim
      return;
    }
    setTimeout(() => waitForServer(callback, tentativas - 1, intervalo), intervalo);
  }
}

// ─── Janela principal ──────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Gestor Jurídico',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    menuBarVisible: false,
  });

  // Tela de carregamento
  mainWindow.loadURL(
    `data:text/html,<!DOCTYPE html><html><body style="margin:0;background:#1a3050;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;font-family:system-ui,sans-serif"><div style="color:#c9a84c;font-size:28px;font-weight:700;letter-spacing:-0.5px">Gestor Jurídico</div><div style="color:rgba(255,255,255,0.5);font-size:13px">Iniciando o sistema...</div><div style="width:36px;height:36px;border:3px solid rgba(201,168,76,0.3);border-top-color:#c9a84c;border-radius:50%;animation:spin 1s linear infinite"></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></body></html>`
  );

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Abre links externos no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Aguarda o servidor e carrega a aplicação
  waitForServer(() => {
    if (mainWindow) {
      mainWindow.loadURL(`http://localhost:${PORT}`);
    }
  });
}

// ─── IPC: Seletor de pasta ─────────────────────────────────────────────────

ipcMain.handle('select-folder', async (_event, startPath) => {
  if (!mainWindow) return { cancelado: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: startPath || app.getPath('home'),
    properties: ['openDirectory', 'createDirectory'],
    title: 'Selecionar Pasta',
  });
  if (result.canceled || result.filePaths.length === 0) return { cancelado: true };
  return { pasta: result.filePaths[0] };
});

// ─── IPC: Seletor de arquivo ───────────────────────────────────────────────

ipcMain.handle('select-file', async (_event, filters) => {
  if (!mainWindow) return { cancelado: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'Arquivo ZIP', extensions: ['zip'] }],
    title: 'Selecionar Arquivo',
  });
  if (result.canceled || result.filePaths.length === 0) return { cancelado: true };
  return { arquivo: result.filePaths[0] };
});

// ─── Ciclo de vida ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Remove o menu nativo global
  const { Menu } = require('electron');
  Menu.setApplicationMenu(null);

  startNextServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});
