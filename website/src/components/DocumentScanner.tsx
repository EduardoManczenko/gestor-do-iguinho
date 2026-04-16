'use client';

import { useState, useEffect } from 'react';
import {
  ScanLine, CheckCircle, AlertCircle, Loader2,
  ChevronDown, ChevronUp, Square, CheckSquare, Scan, FolderOpen, Users
} from 'lucide-react';
import { DadosCliente, PessoaCertidao, ResultadoExtracao } from '@/lib/types';
import { cn, brDateToISO } from '@/lib/utils';

// Campos pessoais (não podem vir de documentos de terceiros)
const CAMPOS_PESSOAIS = new Set<keyof DadosCliente>([
  'NOME_CLIENTE', 'CPF_CLIENTE', 'DATA_NASCIMENTO_CLIENTE', 'NOME_PAI_CLIENTE',
  'NOME_MAE_CLIENTE', 'NATURALIDADE_CLIENTE', 'NACIONALIDADE_CLIENTE',
  'ESTADO_CIVIL_CLIENTE', 'PROFISSAO_CLIENTE', 'TELEFONE_CLIENTE',
  'DOCUMENTO_TIPO_CLIENTE', 'DOCUMENTO_NUMERO_CLIENTE', 'DOCUMENTO_ORGAO_CLIENTE',
]);

const CAMPOS_ENDERECO = new Set<keyof DadosCliente>([
  'LOGRADOURO_CLIENTE', 'NUMERO_CLIENTE', 'COMPLEMENTO_CLIENTE',
  'BAIRRO_CLIENTE', 'CIDADE_CLIENTE', 'CEP_CLIENTE',
]);

function nomesCompatíveis(a: string, b: string): boolean {
  if (!a || !b) return true;
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().split(/\s+/);
  const pa = norm(a).filter(w => w.length > 3);
  const pb = norm(b).filter(w => w.length > 3);
  return pa.some(w => pb.includes(w));
}

function normalizarDados(dados: Partial<DadosCliente>): Partial<DadosCliente> {
  const r = { ...dados };
  if (r.DATA_NASCIMENTO_CLIENTE) r.DATA_NASCIMENTO_CLIENTE = brDateToISO(r.DATA_NASCIMENTO_CLIENTE);
  return r;
}

interface ResultadoArquivo extends ResultadoExtracao {
  arquivo: string;
}

interface ResultadoMultiplo {
  dadosMesclados: Partial<DadosCliente>;
  resultados: ResultadoArquivo[];
}

interface Props {
  onDadosExtraidos: (dados: Partial<DadosCliente>, arquivos: string[], pasta: string) => void;
}

declare global {
  interface Window {
    electronAPI?: {
      selectFolder: (startPath?: string) => Promise<{ pasta?: string; cancelado?: boolean }>;
      selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<{ arquivo?: string; cancelado?: boolean }>;
    };
  }
}

export default function DocumentScanner({ onDadosExtraidos }: Props) {
  const [aberto, setAberto] = useState(false);
  const [pastaScanner, setPastaScanner] = useState('');
  const [arquivos, setArquivos] = useState<string[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregandoArquivos, setCarregandoArquivos] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoMultiplo | null>(null);
  const [pessoasCertidao, setPessoasCertidao] = useState<PessoaCertidao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<number | null>(null);
  const [erro, setErro] = useState('');

  // Carrega pasta do scanner salva
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => {
        if (cfg.scannerDir) {
          setPastaScanner(cfg.scannerDir);
        }
      })
      .catch(() => {});
  }, []);

  // Lista arquivos quando a pasta muda
  useEffect(() => {
    if (!pastaScanner) return;
    listarArquivos(pastaScanner);
  }, [pastaScanner]);

  const listarArquivos = async (pasta: string) => {
    setCarregandoArquivos(true);
    try {
      const res = await fetch(`/api/scanner?pasta=${encodeURIComponent(pasta)}`);
      const data = await res.json();
      setArquivos(data.arquivos || []);
    } catch {
      setArquivos([]);
    } finally {
      setCarregandoArquivos(false);
    }
  };

  const selecionarPasta = async () => {
    if (window.electronAPI) {
      const resultado = await window.electronAPI.selectFolder(pastaScanner);
      if (resultado.cancelado || !resultado.pasta) return;
      const novaPasta = resultado.pasta;
      setPastaScanner(novaPasta);
      setSelecionados(new Set());
      setResultados(null);
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannerDir: novaPasta }),
      });
    } else {
      // Fallback: prompt simples
      const novaPasta = prompt('Digite o caminho da pasta de documentos escaneados:', pastaScanner);
      if (!novaPasta) return;
      setPastaScanner(novaPasta);
      setSelecionados(new Set());
      setResultados(null);
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannerDir: novaPasta }),
      });
    }
  };

  const toggleSelecionado = (arquivo: string) => {
    setSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(arquivo)) novo.delete(arquivo);
      else novo.add(arquivo);
      return novo;
    });
  };

  const toggleTodos = () => {
    if (selecionados.size === arquivos.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(arquivos));
    }
  };

  const mesclarResultados = (resultadosList: ResultadoArquivo[]): Partial<DadosCliente> => {
    let dadosMesclados: Partial<DadosCliente> = {};
    let nomeBase = '';

    for (const resultado of resultadosList) {
      const dados = normalizarDados(resultado.dados);

      // Primeiro documento — define base de nome
      if (!nomeBase && dados.NOME_CLIENTE) {
        nomeBase = dados.NOME_CLIENTE;
      }

      // Campos pessoais: só aceitar se compatível com nome base
      for (const campo of CAMPOS_PESSOAIS) {
        const val = (dados as Record<string, string>)[campo];
        if (!val) continue;

        if (campo === 'NOME_CLIENTE') {
          if (!dadosMesclados.NOME_CLIENTE) {
            dadosMesclados.NOME_CLIENTE = val;
            nomeBase = val;
          }
          continue;
        }

        const nomeDocumento = dados.NOME_CLIENTE;
        const compatível = !nomeDocumento || nomesCompatíveis(nomeBase, nomeDocumento);
        if (compatível && !(dadosMesclados as Record<string, string>)[campo]) {
          (dadosMesclados as Record<string, string>)[campo] = val;
        }
      }

      // Endereço: aceitar de documentos pessoais ou comprovantes de residência
      const tipoDoc = resultado.tipoDocumento || '';
      const ehDocPessoal = ['CNH', 'RG'].includes(tipoDoc);
      const ehComprovanteOuDeclaracao = tipoDoc.includes('COMPROVANTE') || tipoDoc.includes('DECLARAÇÃO');

      if (ehDocPessoal || ehComprovanteOuDeclaracao) {
        const nomeDocumento = dados.NOME_CLIENTE;
        const compatível = !nomeDocumento || nomesCompatíveis(nomeBase, nomeDocumento);

        if (compatível || ehComprovanteOuDeclaracao) {
          for (const campo of CAMPOS_ENDERECO) {
            const val = (dados as Record<string, string>)[campo];
            if (val && !(dadosMesclados as Record<string, string>)[campo]) {
              (dadosMesclados as Record<string, string>)[campo] = val;
            }
          }
        }
      }
    }

    return dadosMesclados;
  };

  const escanear = async () => {
    if (selecionados.size === 0) return;
    setProcessando(true);
    setErro('');
    setResultados(null);
    setPessoasCertidao([]);
    setPessoaSelecionada(null);

    try {
      const resultadosList: ResultadoArquivo[] = [];

      for (const arquivo of Array.from(selecionados)) {
        const res = await fetch('/api/scanner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ arquivo, pastaScanner }),
        });
        const data: ResultadoExtracao = await res.json();
        resultadosList.push({ ...data, arquivo });

        // Coleta pessoas de certidão de casamento
        if (data.pessoasCertidao?.length) {
          setPessoasCertidao(prev => [...prev, ...data.pessoasCertidao!]);
        }
      }

      const dadosMesclados = mesclarResultados(resultadosList);

      setResultados({ dadosMesclados, resultados: resultadosList });

      // Se há pessoas de certidão, aguarda seleção
      if (pessoasCertidao.length === 0) {
        onDadosExtraidos(dadosMesclados, Array.from(selecionados), pastaScanner);
      }
    } catch {
      setErro('Erro ao processar documentos. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const selecionarPessoaCertidao = (idx: number) => {
    if (!resultados) return;
    setPessoaSelecionada(idx);
    const pessoa = pessoasCertidao[idx];

    const dadosComPessoa: Partial<DadosCliente> = {
      ...resultados.dadosMesclados,
      NOME_CLIENTE: pessoa.nome || resultados.dadosMesclados.NOME_CLIENTE,
      ESTADO_CIVIL_CLIENTE: pessoa.estadoCivil || resultados.dadosMesclados.ESTADO_CIVIL_CLIENTE,
      DATA_NASCIMENTO_CLIENTE: pessoa.dataNascimento
        ? brDateToISO(pessoa.dataNascimento)
        : resultados.dadosMesclados.DATA_NASCIMENTO_CLIENTE,
      NATURALIDADE_CLIENTE: pessoa.naturalidade || resultados.dadosMesclados.NATURALIDADE_CLIENTE,
    };

    onDadosExtraidos(dadosComPessoa, Array.from(selecionados), pastaScanner);
  };

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#e8edf4' }}>
          <ScanLine size={16} style={{ color: '#1a3050' }} />
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-gray-800 text-sm">Escanear Documentos</div>
          <div className="text-xs text-gray-400 mt-0.5">Extrair dados automaticamente de CNH, RG, certidões e comprovantes</div>
        </div>
        {aberto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {aberto && (
        <div className="border-t border-gray-100 p-6 space-y-5">
          {/* Seletor de pasta */}
          <div>
            <label className="label-field">Pasta de documentos escaneados</label>
            <div className="flex gap-2">
              <div className="flex-1 input-field bg-gray-50 text-gray-500 text-sm truncate flex items-center">
                {pastaScanner || 'Nenhuma pasta selecionada'}
              </div>
              <button onClick={selecionarPasta} className="btn-outline flex-shrink-0">
                <FolderOpen size={15} />
                Selecionar
              </button>
            </div>
          </div>

          {/* Lista de arquivos */}
          {carregandoArquivos ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={15} className="animate-spin" />
              Carregando arquivos...
            </div>
          ) : arquivos.length === 0 && pastaScanner ? (
            <div className="p-6 bg-gray-50 rounded-xl text-center">
              <p className="text-sm text-gray-400">Nenhum documento encontrado na pasta</p>
              <p className="text-xs text-gray-300 mt-1">Formatos aceitos: PDF, JPG, JPEG, PNG</p>
            </div>
          ) : arquivos.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-field mb-0">Selecionar documentos</label>
                <button onClick={toggleTodos} className="btn-ghost py-1 px-2 text-xs">
                  {selecionados.size === arquivos.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {arquivos.map((arquivo) => (
                  <label
                    key={arquivo}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                      selecionados.has(arquivo) ? 'bg-blue-50' : 'hover:bg-gray-50'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelecionado(arquivo)}
                      className="flex-shrink-0"
                    >
                      {selecionados.has(arquivo)
                        ? <CheckSquare size={18} style={{ color: '#1a3050' }} />
                        : <Square size={18} className="text-gray-300" />
                      }
                    </button>
                    <span className="text-sm text-gray-700 flex-1 truncate">{arquivo}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {arquivo.split('.').pop()?.toUpperCase()}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {selecionados.size} de {arquivos.length} selecionado(s)
              </div>
            </div>
          ) : null}

          {/* Botão escanear */}
          {selecionados.size > 0 && (
            <button
              onClick={escanear}
              disabled={processando}
              className="btn-primary w-full justify-center"
            >
              {processando
                ? <><Loader2 size={16} className="animate-spin" />Processando {selecionados.size} documento(s)...</>
                : <><Scan size={16} />Escanear {selecionados.size} documento(s)</>
              }
            </button>
          )}

          {/* Erro */}
          {erro && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{erro}</span>
            </div>
          )}

          {/* Seleção de pessoa (certidão de casamento) */}
          {pessoasCertidao.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-blue-600" />
                <span className="font-semibold text-blue-800 text-sm">Certidão com múltiplas pessoas — selecione o cliente:</span>
              </div>
              <div className="space-y-2">
                {pessoasCertidao.map((pessoa, idx) => (
                  <button
                    key={idx}
                    onClick={() => selecionarPessoaCertidao(idx)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                      pessoaSelecionada === idx
                        ? 'border-blue-500 bg-blue-100'
                        : 'border-blue-200 bg-white hover:border-blue-400'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {(pessoa.nome || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm">{pessoa.nome}</div>
                      <div className="text-xs text-gray-500">{pessoa.papel} · {pessoa.estadoCivil}</div>
                    </div>
                    {pessoaSelecionada === idx && <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resultados */}
          {resultados && pessoasCertidao.length === 0 && (
            <div className={cn(
              'p-4 rounded-xl border flex items-start gap-3',
              resultados.dadosMesclados && Object.keys(resultados.dadosMesclados).length > 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-yellow-50 border-yellow-200'
            )}>
              {Object.keys(resultados.dadosMesclados || {}).length > 0 ? (
                <>
                  <CheckCircle size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-emerald-700 text-sm mb-1">
                      {Object.keys(resultados.dadosMesclados).length} campo(s) extraído(s) com sucesso!
                    </div>
                    <div className="text-xs text-emerald-600 space-y-0.5">
                      {resultados.resultados.map(r => (
                        <div key={r.arquivo}>{r.arquivo}: {r.tipoDocumento || 'Desconhecido'}</div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    Nenhum dado extraído. Preencha o formulário manualmente.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
