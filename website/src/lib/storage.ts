import fs from 'fs';
import path from 'path';
import { Cliente, Contrato } from './types';

const ROOT = path.resolve(process.cwd(), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const TEMPLATES_DIR = path.join(ROOT, 'contratos-template');
export const SCANNER_DIR = path.join(ROOT, 'scanner');
export const CLIENTES_DIR = path.join(DATA_DIR, 'clientes');

export function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function initStorage() {
  ensureDir(DATA_DIR);
  ensureDir(CLIENTES_DIR);
}

export function listarClientes(): Cliente[] {
  initStorage();
  if (!fs.existsSync(CLIENTES_DIR)) return [];

  const pastas = fs.readdirSync(CLIENTES_DIR).filter((f) => {
    const full = path.join(CLIENTES_DIR, f);
    return fs.statSync(full).isDirectory();
  });

  const clientes: Cliente[] = [];
  for (const pasta of pastas) {
    const dadosPath = path.join(CLIENTES_DIR, pasta, 'dados.json');
    if (fs.existsSync(dadosPath)) {
      try {
        const raw = fs.readFileSync(dadosPath, 'utf-8');
        const c = JSON.parse(raw);
        // Garantir retrocompatibilidade
        if (!c.documentos) c.documentos = [];
        if (!c.contratos) c.contratos = [];
        clientes.push(c);
      } catch {
        // skip corrupt files
      }
    }
  }

  return clientes.sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
  );
}

export function buscarCliente(id: string): Cliente | null {
  const dadosPath = path.join(CLIENTES_DIR, id, 'dados.json');
  if (!fs.existsSync(dadosPath)) return null;
  try {
    const raw = fs.readFileSync(dadosPath, 'utf-8');
    const c = JSON.parse(raw);
    if (!c.documentos) c.documentos = [];
    if (!c.contratos) c.contratos = [];
    return c;
  } catch {
    return null;
  }
}

export function salvarCliente(cliente: Cliente): void {
  initStorage();
  const clienteDir = path.join(CLIENTES_DIR, cliente.id);
  ensureDir(clienteDir);
  ensureDir(path.join(clienteDir, 'contratos'));
  const dadosPath = path.join(clienteDir, 'dados.json');
  fs.writeFileSync(dadosPath, JSON.stringify(cliente, null, 2), 'utf-8');
}

export function deletarCliente(id: string): boolean {
  const clienteDir = path.join(CLIENTES_DIR, id);
  if (!fs.existsSync(clienteDir)) return false;
  fs.rmSync(clienteDir, { recursive: true, force: true });
  return true;
}

export function salvarContrato(clienteId: string, contrato: Contrato, buffer: Buffer): string {
  const contratoDir = path.join(CLIENTES_DIR, clienteId, 'contratos', contrato.id);
  ensureDir(contratoDir);
  const arquivoPath = path.join(contratoDir, `${contrato.template}.docx`);
  fs.writeFileSync(arquivoPath, buffer);

  const relPath = path.join('data', 'clientes', clienteId, 'contratos', contrato.id, `${contrato.template}.docx`);
  return relPath;
}

export function lerContratoDOCX(clienteId: string, contratoId: string, template: string): Buffer | null {
  const arquivoPath = path.join(CLIENTES_DIR, clienteId, 'contratos', contratoId, `${template}.docx`);
  if (!fs.existsSync(arquivoPath)) return null;
  return fs.readFileSync(arquivoPath);
}

export function listarArquivosScanner(): string[] {
  if (!fs.existsSync(SCANNER_DIR)) return [];
  return fs.readdirSync(SCANNER_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ['.pdf', '.jpg', '.jpeg', '.png'].includes(ext);
  });
}

export function copiarDocumentosParaCliente(clienteId: string, arquivosScanner: string[]): string[] {
  const docsDir = path.join(CLIENTES_DIR, clienteId, 'documentos');
  ensureDir(docsDir);
  const copiados: string[] = [];

  for (const arquivo of arquivosScanner) {
    const origem = path.join(SCANNER_DIR, arquivo);
    if (!fs.existsSync(origem)) continue;
    const destino = path.join(docsDir, arquivo);
    try {
      fs.copyFileSync(origem, destino);
      copiados.push(path.join('data', 'clientes', clienteId, 'documentos', arquivo));
    } catch { /* ignorar erros de cópia */ }
  }

  return copiados;
}

export function listarDocumentosCliente(clienteId: string): string[] {
  const docsDir = path.join(CLIENTES_DIR, clienteId, 'documentos');
  if (!fs.existsSync(docsDir)) return [];
  return fs.readdirSync(docsDir).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ['.pdf', '.jpg', '.jpeg', '.png'].includes(ext);
  });
}

export function getPathsInfo() {
  return {
    dataDir: DATA_DIR,
    clientesDir: CLIENTES_DIR,
    templatesDir: TEMPLATES_DIR,
    scannerDir: SCANNER_DIR,
  };
}
