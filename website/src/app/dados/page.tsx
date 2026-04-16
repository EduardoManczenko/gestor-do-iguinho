'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FolderOpen, Download, Upload, AlertCircle, CheckCircle,
  Loader2, RefreshCw, HardDrive, Info
} from 'lucide-react';

interface PathsInfo {
  dataDir: string;
  tamanhoFormatado: string;
  ehPadrao: boolean;
}

declare global {
  interface Window {
    electronAPI?: {
      selectFolder: (startPath?: string) => Promise<{ pasta?: string; cancelado?: boolean }>;
      selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<{ arquivo?: string; cancelado?: boolean }>;
    };
  }
}

export default function DadosPage() {
  const [info, setInfo] = useState<PathsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro' | 'info'; texto: string } | null>(null);
  const [operando, setOperando] = useState(false);

  const mostrarMensagem = (tipo: 'ok' | 'erro' | 'info', texto: string) => {
    setMensagem({ tipo, texto });
    setTimeout(() => setMensagem(null), 5000);
  };

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/dados');
      setInfo(await res.json());
    } catch {
      mostrarMensagem('erro', 'Não foi possível carregar as informações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const alterarPasta = async () => {
    if (!window.electronAPI) {
      mostrarMensagem('info', 'Este recurso está disponível apenas no aplicativo desktop.');
      return;
    }
    const resultado = await window.electronAPI.selectFolder(info?.dataDir);
    if (resultado.cancelado || !resultado.pasta) return;

    setOperando(true);
    try {
      const res = await fetch('/api/dados/pasta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novoDir: resultado.pasta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro);
      setInfo(data);
      mostrarMensagem('ok', `Pasta alterada com sucesso! ${data.migrados || 0} arquivo(s) migrado(s).`);
    } catch (e) {
      mostrarMensagem('erro', `Erro ao alterar pasta: ${String(e)}`);
    } finally {
      setOperando(false);
    }
  };

  const exportarBackup = async () => {
    setOperando(true);
    try {
      const res = await fetch('/api/dados/exportar');
      if (!res.ok) throw new Error('Falha ao exportar');
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="(.+?)"/);
      const filename = match?.[1] || `backup_${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      mostrarMensagem('ok', `Backup exportado: ${filename}`);
    } catch (e) {
      mostrarMensagem('erro', `Erro ao exportar: ${String(e)}`);
    } finally {
      setOperando(false);
    }
  };

  const importarBackup = async () => {
    setOperando(true);
    try {
      let file: File | null = null;

      if (window.electronAPI) {
        const resultado = await window.electronAPI.selectFile([{ name: 'Backup ZIP', extensions: ['zip'] }]);
        if (resultado.cancelado || !resultado.arquivo) { setOperando(false); return; }
        // Precisamos do arquivo via input file para enviar como FormData
        // Usa um input file oculto
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        await new Promise<void>((resolve) => {
          input.onchange = () => { file = input.files?.[0] || null; resolve(); };
          input.click();
        });
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        await new Promise<void>((resolve) => {
          input.onchange = () => { file = input.files?.[0] || null; resolve(); };
          input.click();
        });
      }

      if (!file) { setOperando(false); return; }

      const formData = new FormData();
      formData.append('arquivo', file);
      const res = await fetch('/api/dados/importar', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro);
      mostrarMensagem('ok', `Backup importado: ${data.restaurados} arquivo(s) restaurado(s).`);
      await carregar();
    } catch (e) {
      mostrarMensagem('erro', `Erro ao importar: ${String(e)}`);
    } finally {
      setOperando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 mx-auto mb-4 animate-spin"
            style={{ borderColor: '#1a3050', borderTopColor: 'transparent' }} />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title mb-1">Dados &amp; Backup</h1>
        <p className="text-gray-500 text-sm">Gerencie onde seus dados são armazenados e faça backups de segurança</p>
      </div>

      {mensagem && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-fade-in ${
          mensagem.tipo === 'ok' ? 'bg-emerald-50 border border-emerald-200' :
          mensagem.tipo === 'info' ? 'bg-blue-50 border border-blue-200' :
          'bg-red-50 border border-red-200'
        }`}>
          {mensagem.tipo === 'ok' && <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />}
          {mensagem.tipo === 'info' && <Info size={18} className="text-blue-600 flex-shrink-0" />}
          {mensagem.tipo === 'erro' && <AlertCircle size={18} className="text-red-500 flex-shrink-0" />}
          <span className={`text-sm font-medium ${
            mensagem.tipo === 'ok' ? 'text-emerald-700' :
            mensagem.tipo === 'info' ? 'text-blue-700' :
            'text-red-700'
          }`}>{mensagem.texto}</span>
        </div>
      )}

      {/* Pasta de dados */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <HardDrive size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Pasta de Dados</h2>
            <p className="text-xs text-gray-500">Local onde clientes, contratos e histórico são salvos</p>
          </div>
          <button onClick={carregar} className="ml-auto btn-ghost p-2">
            <RefreshCw size={15} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Caminho atual</div>
          <div className="font-mono text-sm text-gray-700 break-all">{info?.dataDir || 'Desconhecido'}</div>
          <div className="flex items-center gap-3 mt-2">
            <span className="badge badge-navy text-xs">{info?.tamanhoFormatado || '—'} em uso</span>
            {info?.ehPadrao && <span className="badge badge-gold text-xs">Pasta padrão</span>}
          </div>
        </div>

        <button
          onClick={alterarPasta}
          disabled={operando}
          className="btn-outline w-full justify-center"
        >
          {operando ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />}
          Alterar Pasta de Dados
        </button>

        {!window.electronAPI && (
          <p className="text-xs text-gray-400 text-center mt-3">
            A alteração de pasta está disponível apenas no aplicativo desktop Electron.
          </p>
        )}
      </div>

      {/* Backup */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Download size={20} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Backup</h2>
            <p className="text-xs text-gray-500">Exporte ou importe todos os seus dados em um arquivo ZIP</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={exportarBackup}
            disabled={operando}
            className="card p-5 text-left hover:border-emerald-200 hover:shadow-md transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Download size={20} className="text-emerald-600" />
            </div>
            <div className="font-semibold text-gray-800 mb-1">Exportar Backup</div>
            <div className="text-xs text-gray-400">Baixa todos os dados em um arquivo .zip</div>
          </button>

          <button
            onClick={importarBackup}
            disabled={operando}
            className="card p-5 text-left hover:border-blue-200 hover:shadow-md transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Upload size={20} className="text-blue-600" />
            </div>
            <div className="font-semibold text-gray-800 mb-1">Importar Backup</div>
            <div className="text-xs text-gray-400">Restaura dados a partir de um arquivo .zip</div>
          </button>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-xl flex items-start gap-2">
          <AlertCircle size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-700">
            Ao importar, os arquivos existentes com o mesmo nome não serão substituídos. Faça um backup antes de importar.
          </p>
        </div>
      </div>
    </div>
  );
}
