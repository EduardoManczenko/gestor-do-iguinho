'use client';

import { useState } from 'react';
import {
  ScanLine, CheckCircle, AlertCircle, Loader2,
  ChevronDown, ChevronUp, Square, CheckSquare, Scan, FolderOpen, Users
} from 'lucide-react';
import { DadosCliente, PessoaCertidao, ResultadoExtracao } from '@/lib/types';
import { cn, brDateToISO } from '@/lib/utils';

// Campos que pertencem exclusivamente à pessoa (não podem vir de documentos de terceiros)
const CAMPOS_PESSOAIS = new Set<keyof DadosCliente>([
  'NOME_CLIENTE', 'CPF_CLIENTE', 'DATA_NASCIMENTO_CLIENTE', 'NOME_PAI_CLIENTE',
  'NOME_MAE_CLIENTE', 'NATURALIDADE_CLIENTE', 'NACIONALIDADE_CLIENTE',
  'ESTADO_CIVIL_CLIENTE', 'PROFISSAO_CLIENTE', 'TELEFONE_CLIENTE',
  'DOCUMENTO_TIPO_CLIENTE', 'DOCUMENTO_NUMERO_CLIENTE', 'DOCUMENTO_ORGAO_CLIENTE',
]);

// Campos de endereço — podem vir de qualquer documento (ex: conta de luz no nome do cônjuge)
const CAMPOS_ENDERECO = new Set<keyof DadosCliente>([
  'LOGRADOURO_CLIENTE', 'NUMERO_CLIENTE', 'COMPLEMENTO_CLIENTE',
  'BAIRRO_CLIENTE', 'CIDADE_CLIENTE', 'CEP_CLIENTE',
]);

// Verifica se dois nomes têm pelo menos uma palavra significativa em comum
function nomesCompatíveis(nomePrimario: string, nomeDocumento: string): boolean {
  if (!nomePrimario || !nomeDocumento) return true; // sem nome = não filtra
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().split(/\s+/);
  const pa = norm(nomePrimario).filter(w => w.length > 3);
  const pb = norm(nomeDocumento).filter(w => w.length > 3);
  return pa.some(w => pb.includes(w));
}

// Aplica conversão de data onde necessário e retorna os dados normalizados
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
  onDadosExtraidos: (dados: Partial<DadosCliente>, arquivosSelecionados: string[]) => void;
}

export default function DocumentScanner({ onDadosExtraidos }: Props) {
  const [aberto, setAberto] = useState(false);
  const [arquivos, setArquivos] = useState<string[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<ResultadoMultiplo | null>(null);
  const [diretorio, setDiretorio] = useState('');
  const [pessoasPendentes, setPessoasPendentes] = useState<{ pessoas: PessoaCertidao[]; arquivo: string } | null>(null);

  const carregarArquivos = async () => {
    if (aberto) {
      setAberto(false);
      return;
    }
    setCarregandoLista(true);
    setAberto(true);
    setResultado(null);
    setSelecionados(new Set());
    try {
      const res = await fetch('/api/scanner');
      const data = await res.json();
      setArquivos(data.arquivos || []);
      setDiretorio(data.diretorio || '');
    } catch {
      setArquivos([]);
    } finally {
      setCarregandoLista(false);
    }
  };

  const toggleSelecionado = (arquivo: string) => {
    setSelecionados((prev) => {
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

  const processarSelecionados = async () => {
    if (selecionados.size === 0) return;
    setProcessando(true);
    setProgresso(0);
    setResultado(null);

    try {
      const arquivosList = Array.from(selecionados);

      // Processar progressivamente para dar feedback visual
      const resultadosArquivos: ResultadoArquivo[] = [];
      let dadosMesclados: Partial<DadosCliente> = {};

      for (let i = 0; i < arquivosList.length; i++) {
        setProgresso(Math.round((i / arquivosList.length) * 100));
        const res = await fetch('/api/scanner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ arquivo: arquivosList[i] }),
        });
        const data: ResultadoExtracao = await res.json();
        resultadosArquivos.push({ ...data, arquivo: arquivosList[i] });

        if (data.sucesso) {
          const dadosNorm = normalizarDados(data.dados);
          const nomePrimario = dadosMesclados.NOME_CLIENTE || '';
          const nomeDocumento = (dadosNorm.NOME_CLIENTE as string) || '';

          // Verifica se este documento parece ser da mesma pessoa já identificada
          const mesmaPessoa = nomesCompatíveis(nomePrimario, nomeDocumento);

          // Comprovantes de utilidade (energia, água) podem ter endereço em outro nome → sempre mescla endereço
          // Declarações de residência: endereço só mescla se for da mesma pessoa
          //   (declaração de terceiro já extrai o endereço correto do beneficiário na API)
          const tipoDoc = data.tipoDocumento || '';
          // ATENÇÃO: usar comparação exata — "DECLARAÇÃO DE RESIDÊNCIA" NÃO é comprovante
          const ehComprovante = tipoDoc === 'COMPROVANTE DE ENERGIA' || tipoDoc === 'COMPROVANTE DE RESIDÊNCIA';

          for (const [k, v] of Object.entries(dadosNorm)) {
            const campo = k as keyof DadosCliente;
            if (!v || (dadosMesclados as Record<string, string>)[k]) continue;

            if (CAMPOS_PESSOAIS.has(campo)) {
              // Dados pessoais: só mescla se for a mesma pessoa (ou não há nome definido ainda)
              if (!nomePrimario || !nomeDocumento || mesmaPessoa) {
                (dadosMesclados as Record<string, string>)[k] = v as string;
              }
            } else if (CAMPOS_ENDERECO.has(campo)) {
              // Comprovantes de energia/água: mescla endereço mesmo em outro nome
              // Para outros documentos: mescla endereço só se for da mesma pessoa
              if (ehComprovante || !nomePrimario || !nomeDocumento || mesmaPessoa) {
                (dadosMesclados as Record<string, string>)[k] = v as string;
              }
            }
          }
        }
      }

      setProgresso(100);
      setResultado({ dadosMesclados, resultados: resultadosArquivos });

      // Verificar se algum documento tem múltiplas pessoas (certidão de casamento)
      const comPessoas = resultadosArquivos.find(r => r.pessoasCertidao && r.pessoasCertidao.length > 1);
      if (comPessoas && comPessoas.pessoasCertidao) {
        setPessoasPendentes({ pessoas: comPessoas.pessoasCertidao, arquivo: comPessoas.arquivo });
      } else if (Object.keys(dadosMesclados).length > 0) {
        onDadosExtraidos(normalizarDados(dadosMesclados), arquivosList);
      }
    } catch {
      setResultado({
        dadosMesclados: {},
        resultados: [{ sucesso: false, dados: {}, confianca: 'baixa', mensagem: 'Erro ao processar documentos.', arquivo: '' }],
      });
    } finally {
      setProcessando(false);
    }
  };

  const selecionarPessoaCertidao = (pessoa: PessoaCertidao, arquivosList: string[]) => {
    // Dados da pessoa selecionada na certidão (têm prioridade máxima)
    const dadosPessoa: Partial<DadosCliente> = {};
    if (pessoa.nome) dadosPessoa.NOME_CLIENTE = pessoa.nome;
    if (pessoa.naturalidade) dadosPessoa.NATURALIDADE_CLIENTE = pessoa.naturalidade;
    if (pessoa.dataNascimento) dadosPessoa.DATA_NASCIMENTO_CLIENTE = brDateToISO(pessoa.dataNascimento);
    if (pessoa.nacionalidade) dadosPessoa.NACIONALIDADE_CLIENTE = pessoa.nacionalidade;
    if (pessoa.nomePai) dadosPessoa.NOME_PAI_CLIENTE = pessoa.nomePai;
    if (pessoa.nomeMae) dadosPessoa.NOME_MAE_CLIENTE = pessoa.nomeMae;
    dadosPessoa.ESTADO_CIVIL_CLIENTE = 'CASADO(A)';

    if (!resultado) {
      onDadosExtraidos(dadosPessoa, arquivosList);
      setPessoasPendentes(null);
      return;
    }

    // Mesclagem inteligente: dados da certidão têm prioridade sobre os anteriores,
    // mas mantemos endereço e outros campos já extraídos que não vêm na certidão
    const dadosMescladosFinal: Partial<DadosCliente> = {};

    // 1. Aplica dados dos documentos anteriores (endereço + campos não-pessoais)
    for (const [k, v] of Object.entries(resultado.dadosMesclados)) {
      const campo = k as keyof DadosCliente;
      if (v && CAMPOS_ENDERECO.has(campo)) {
        (dadosMescladosFinal as Record<string, string>)[k] = v as string;
      }
    }

    // 2. Aplica dados da pessoa selecionada (têm prioridade sobre tudo)
    for (const [k, v] of Object.entries(dadosPessoa)) {
      if (v) (dadosMescladosFinal as Record<string, string>)[k] = v as string;
    }

    // 3. Complementa com campos pessoais dos documentos anteriores que a certidão não cobre
    //    (ex: CPF da CNH, número do documento) — só se a pessoa for a mesma
    for (const [k, v] of Object.entries(resultado.dadosMesclados)) {
      const campo = k as keyof DadosCliente;
      if (v && CAMPOS_PESSOAIS.has(campo) && !(dadosMescladosFinal as Record<string, string>)[k]) {
        const nomePrimario = dadosPessoa.NOME_CLIENTE || '';
        const nomeOriginal = (resultado.dadosMesclados.NOME_CLIENTE as string) || '';
        if (!nomePrimario || !nomeOriginal || nomesCompatíveis(nomePrimario, nomeOriginal)) {
          (dadosMescladosFinal as Record<string, string>)[k] = v as string;
        }
      }
    }

    setPessoasPendentes(null);
    onDadosExtraidos(dadosMescladosFinal, arquivosList);
  };

  const confiancaConfig = {
    alta: { cor: 'badge-green', label: 'Alta' },
    media: { cor: 'badge-gold', label: 'Média' },
    baixa: { cor: 'badge-red', label: 'Baixa' },
  };

  const totalCamposExtraidos = resultado ? Object.keys(resultado.dadosMesclados).length : 0;

  // Modal de seleção de pessoa (certidão de casamento)
  if (pessoasPendentes) {
    const arquivosList = Array.from(selecionados);
    return (
      <div className="rounded-2xl border-2 border-yellow-300 bg-yellow-50/40 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center flex-shrink-0">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-sm text-yellow-900">Certidão de Casamento detectada</div>
            <div className="text-xs text-yellow-700">Selecione qual pessoa é o(a) seu(sua) cliente:</div>
          </div>
        </div>
        <div className="space-y-3">
          {pessoasPendentes.pessoas.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selecionarPessoaCertidao(p, arquivosList)}
              className="w-full text-left p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all"
            >
              <div className="font-bold text-gray-800 mb-1">{p.nome}</div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {p.naturalidade && <div>Natural de: {p.naturalidade}</div>}
                {p.dataNascimento && <div>Nascido(a) em: {p.dataNascimento}</div>}
                {p.nacionalidade && <div>Nacionalidade: {p.nacionalidade}</div>}
                {(p.nomePai || p.nomeMae) && (
                  <div>Filiação: {[p.nomePai, p.nomeMae].filter(Boolean).join(' e ')}</div>
                )}
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPessoasPendentes(null)}
          className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600"
        >
          Cancelar seleção
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={carregarArquivos}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-blue-50 transition-colors"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #1a3050, #254268)' }}
        >
          <ScanLine size={18} className="text-white" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-sm" style={{ color: '#1a3050' }}>
            Ler Documentos Escaneados
          </div>
          <div className="text-xs text-gray-500">
            Selecione um ou mais documentos da pasta scanner para preencher automaticamente
          </div>
        </div>
        {aberto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {aberto && (
        <div className="border-t border-blue-100 px-6 pb-5 pt-4">
          {/* Diretório */}
          {diretorio && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-white rounded-xl border border-gray-100">
              <FolderOpen size={13} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400 font-mono break-all">{diretorio}</span>
            </div>
          )}

          {/* Resultado do processamento */}
          {resultado && (
            <div className="mb-5 space-y-3">
              {/* Resumo geral */}
              <div className={cn(
                'p-4 rounded-2xl border',
                totalCamposExtraidos > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              )}>
                <div className="flex items-start gap-3">
                  {totalCamposExtraidos > 0
                    ? <CheckCircle size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    : <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <div className={cn('font-semibold text-sm mb-1', totalCamposExtraidos > 0 ? 'text-emerald-700' : 'text-red-700')}>
                      {totalCamposExtraidos > 0
                        ? `${totalCamposExtraidos} campos preenchidos a partir de ${resultado.resultados.filter(r => r.sucesso).length} documento(s)`
                        : 'Nenhum dado foi identificado nos documentos'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {totalCamposExtraidos > 0
                        ? 'Os dados foram preenchidos no formulário. Revise e corrija se necessário.'
                        : 'Preencha os dados manualmente abaixo.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resultado por documento */}
              <div className="space-y-1.5">
                {resultado.resultados.map((r) => (
                  <div key={r.arquivo} className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-xl border border-gray-100">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                      r.sucesso ? 'bg-emerald-100' : 'bg-red-50')}>
                      {r.sucesso
                        ? <CheckCircle size={13} className="text-emerald-600" />
                        : <AlertCircle size={13} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700 truncate">{r.arquivo}</div>
                      <div className="text-xs text-gray-400">
                        {r.tipoDocumento && <span className="font-medium">{r.tipoDocumento} · </span>}
                        {r.mensagem}
                      </div>
                    </div>
                    {r.sucesso && (
                      <span className={cn('badge text-xs flex-shrink-0', confiancaConfig[r.confianca].cor)}>
                        {confiancaConfig[r.confianca].label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de progresso */}
          {processando && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Processando documentos...</span>
                <span className="text-xs text-gray-500">{progresso}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progresso}%`, background: 'linear-gradient(90deg, #1a3050, #c9a84c)' }}
                />
              </div>
            </div>
          )}

          {/* Lista de arquivos */}
          {carregandoLista ? (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 size={18} className="animate-spin text-gray-400" />
              <span className="text-sm text-gray-400">Buscando documentos...</span>
            </div>
          ) : arquivos.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm text-gray-500 font-medium">Nenhum documento encontrado</p>
              <p className="text-xs text-gray-400 mt-1">Coloque documentos PDF, JPG ou PNG na pasta &quot;scanner&quot;</p>
            </div>
          ) : (
            <div>
              {/* Controles de seleção */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={toggleTodos}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {selecionados.size === arquivos.length
                    ? <CheckSquare size={15} style={{ color: '#1a3050' }} />
                    : <Square size={15} className="text-gray-400" />}
                  {selecionados.size === arquivos.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                <span className="text-xs text-gray-400">
                  {arquivos.length} documento(s) disponível(is)
                </span>
              </div>

              {/* Lista com checkboxes */}
              <div className="space-y-2 mb-4">
                {arquivos.map((arquivo) => {
                  const sel = selecionados.has(arquivo);
                  const ext = arquivo.split('.').pop()?.toUpperCase() || 'DOC';
                  return (
                    <button
                      key={arquivo}
                      type="button"
                      onClick={() => toggleSelecionado(arquivo)}
                      disabled={processando}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed',
                        sel
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all border-2',
                        sel ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'
                      )}>
                        {sel && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                        style={{ background: ext === 'PDF' ? '#e53e3e' : '#3182ce' }}
                      >
                        {ext.slice(0, 3)}
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-700 truncate">{arquivo}</span>
                      {sel && <CheckCircle size={15} className="text-blue-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Botão de processar */}
              <button
                type="button"
                onClick={processarSelecionados}
                disabled={selecionados.size === 0 || processando}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all',
                  selecionados.size > 0 && !processando
                    ? 'text-white hover:-translate-y-0.5 hover:shadow-lg'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
                style={selecionados.size > 0 && !processando ? { background: 'linear-gradient(135deg, #1a3050, #254268)' } : {}}
              >
                {processando ? (
                  <><Loader2 size={15} className="animate-spin" />Lendo documentos...</>
                ) : (
                  <>
                    <Scan size={15} />
                    {selecionados.size === 0
                      ? 'Selecione ao menos um documento'
                      : `Escanear ${selecionados.size} documento${selecionados.size > 1 ? 's' : ''}`}
                  </>
                )}
              </button>

              {selecionados.size > 0 && !processando && (
                <p className="text-center text-xs text-gray-400 mt-2">
                  Os documentos serão salvos junto ao cadastro do cliente
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
