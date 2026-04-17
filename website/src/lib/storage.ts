import fs from 'fs';
import os from 'os';
import path from 'path';
import { Cliente, Contrato, EventoHistorico, TipoEvento } from './types';
import { v4 as uuidv4 } from 'uuid';

// ─── Configuração de diretórios ───────────────────────────────────────────────

// O Electron passa GESTOR_CONFIG_DIR = app.getPath('userData') ao iniciar o Next.js.
// Em desenvolvimento, cai para ~/.config/gestor-juridico/
// Na Vercel o filesystem do servidor é efémero; /tmp é gravável entre invocações da mesma instância.
const APP_CONFIG_DIR =
  process.env.GESTOR_CONFIG_DIR ||
  (process.env.VERCEL
    ? path.join('/tmp', 'gestor-juridico')
    : path.join(os.homedir(), '.config', 'gestor-juridico'));

const APP_CONFIG_FILE = path.join(APP_CONFIG_DIR, 'app-config.json');

const DEFAULT_DATA_DIR = path.join(APP_CONFIG_DIR, 'dados');

// O Electron define caminhos absolutos (standalone usa cwd em .next/standalone).
export const TEMPLATES_DIR =
  process.env.GESTOR_TEMPLATES_DIR ||
  path.join(process.cwd(), 'contratos-template');

const DEFAULT_SCANNER_DIR =
  process.env.GESTOR_DEFAULT_SCANNER_DIR ||
  path.join(process.cwd(), '..', 'scanner');

// ─── Config do app (qual pasta de dados usar) ─────────────────────────────────

interface AppConfig {
  dataDir?: string;
}

function lerAppConfig(): AppConfig {
  try {
    return JSON.parse(fs.readFileSync(APP_CONFIG_FILE, 'utf-8')) as AppConfig;
  } catch {
    return {};
  }
}

function salvarAppConfig(cfg: AppConfig): void {
  fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  fs.writeFileSync(APP_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

export function getDataDir(): string {
  return lerAppConfig().dataDir || DEFAULT_DATA_DIR;
}

export function setDataDir(novoDir: string): void {
  salvarAppConfig({ ...lerAppConfig(), dataDir: novoDir });
}

// ─── Diretórios derivados ──────────────────────────────────────────────────────

export function getClientesDir(): string {
  const d = path.join(getDataDir(), 'clientes');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function getConfigFile(): string {
  fs.mkdirSync(getDataDir(), { recursive: true });
  return path.join(getDataDir(), 'config.json');
}

export function getHistoricoFile(): string {
  fs.mkdirSync(getDataDir(), { recursive: true });
  return path.join(getDataDir(), 'historico.json');
}

// ─── Config do scanner (pasta de documentos) ──────────────────────────────────

interface Config {
  scannerDir?: string;
}

export function lerConfig(): Config {
  try {
    return JSON.parse(fs.readFileSync(getConfigFile(), 'utf-8')) as Config;
  } catch {
    return {};
  }
}

export function salvarConfig(cfg: Partial<Config>): Config {
  const atual = lerConfig();
  const novo = { ...atual, ...cfg };
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.writeFileSync(getConfigFile(), JSON.stringify(novo, null, 2), 'utf-8');
  return novo;
}

export function getScannerDir(): string {
  return lerConfig().scannerDir || DEFAULT_SCANNER_DIR;
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export function getClientes(): Cliente[] {
  const dir = getClientesDir();
  const pastas = fs.readdirSync(dir).filter((n) =>
    fs.statSync(path.join(dir, n)).isDirectory()
  );
  return pastas
    .map((id) => {
      try {
        const file = path.join(dir, id, 'dados.json');
        return JSON.parse(fs.readFileSync(file, 'utf-8')) as Cliente;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b!.criadoEm).getTime() - new Date(a!.criadoEm).getTime()
    ) as Cliente[];
}

export function buscarCliente(id: string): Cliente | null {
  try {
    const file = path.join(getClientesDir(), id, 'dados.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Cliente;
  } catch {
    return null;
  }
}

export function salvarCliente(cliente: Cliente): void {
  const dir = path.join(getClientesDir(), cliente.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'dados.json'), JSON.stringify(cliente, null, 2), 'utf-8');
}

export function deletarCliente(id: string): void {
  const dir = path.join(getClientesDir(), id);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Contratos ────────────────────────────────────────────────────────────────

export function salvarContrato(
  clienteId: string,
  contrato: Contrato,
  buffer: Buffer
): string {
  const clienteDir = path.join(getClientesDir(), clienteId);
  const contratosDir = path.join(clienteDir, 'contratos');
  fs.mkdirSync(contratosDir, { recursive: true });
  const filename = `${contrato.id}.docx`;
  const filePath = path.join(contratosDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function getContratoDOCXPath(clienteId: string, contratoId: string): string | null {
  const filePath = path.join(getClientesDir(), clienteId, 'contratos', `${contratoId}.docx`);
  return fs.existsSync(filePath) ? filePath : null;
}

// ─── Documentos do cliente (scanner) ─────────────────────────────────────────

export function copiarArquivosScanner(
  clienteId: string,
  arquivos: string[],
  pastaScanner: string
): string[] {
  const docsDir = path.join(getClientesDir(), clienteId, 'documentos');
  fs.mkdirSync(docsDir, { recursive: true });
  const copiados: string[] = [];

  for (const arquivo of arquivos) {
    const src = path.join(pastaScanner, arquivo);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(docsDir, arquivo);
    fs.copyFileSync(src, dst);
    copiados.push(arquivo);
  }

  return copiados;
}

// ─── Arquivos no scanner ───────────────────────────────────────────────────────

export function listarArquivosScanner(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(pdf|jpg|jpeg|png)$/i.test(f))
      .sort();
  } catch {
    return [];
  }
}

// ─── Histórico ────────────────────────────────────────────────────────────────

export function getHistorico(): EventoHistorico[] {
  try {
    const raw = fs.readFileSync(getHistoricoFile(), 'utf-8');
    const list = JSON.parse(raw) as EventoHistorico[];
    return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  } catch {
    return [];
  }
}

export function registrarEvento(
  tipo: TipoEvento,
  descricao: string,
  opts?: {
    nomeCliente?: string;
    clienteId?: string;
    detalhes?: Record<string, string>;
  }
): void {
  const historico = getHistorico();
  historico.unshift({
    id: uuidv4(),
    tipo,
    data: new Date().toISOString(),
    descricao,
    ...(opts || {}),
  });
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.writeFileSync(getHistoricoFile(), JSON.stringify(historico, null, 2), 'utf-8');
}

// ─── Info de caminhos (para página Dados) ────────────────────────────────────

export function calcularTamanho(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    total += stat.isDirectory() ? calcularTamanho(full) : stat.size;
  }
  return total;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getPathsInfo() {
  const dataDir = getDataDir();
  const tamanhoBytes = calcularTamanho(dataDir);
  return {
    dataDir,
    tamanhoBytes,
    tamanhoFormatado: formatarTamanho(tamanhoBytes),
    ehPadrao: dataDir === DEFAULT_DATA_DIR,
  };
}

// ─── Migração de dados ───────────────────────────────────────────────────────

export function copiarRecursivo(
  origem: string,
  destino: string
): { migrados: number; ignorados: number } {
  let migrados = 0;
  let ignorados = 0;

  if (!fs.existsSync(origem)) return { migrados, ignorados };

  fs.mkdirSync(destino, { recursive: true });

  for (const entry of fs.readdirSync(origem)) {
    const src = path.join(origem, entry);
    const dst = path.join(destino, entry);
    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
      const r = copiarRecursivo(src, dst);
      migrados += r.migrados;
      ignorados += r.ignorados;
    } else {
      if (!fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
        migrados++;
      } else {
        ignorados++;
      }
    }
  }

  return { migrados, ignorados };
}
