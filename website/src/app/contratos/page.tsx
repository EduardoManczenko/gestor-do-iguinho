'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText, ChevronRight, Users, Search, X, Loader2,
  AlertCircle, CheckCircle, Download, ArrowLeft, Info,
  ScanLine
} from 'lucide-react';
import Link from 'next/link';
import { Template, Cliente, DadosTestemunha } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONES_TEMPLATE: Record<string, string> = {
  TEMPLATE_PROCURACAO: '📜',
  TEMPLATE_CONTRATO_HONORARIOS: '💼',
  TEMPLATE_DECLARACAO_HIPOSSUFICIENCIA: '📋',
  TEMPLATE_PROCURACAO_SIMPLES: '📄',
  TEMPLATE_CONTRATO_HONORARIOS_SIMPLES: '📑',
  TEMPLATE_DECLARACAO_IRPF: '🏛️',
  TEMPLATE_DECLARACAO_TESTEMUNHA: '🤝',
};

function ContratoGerador() {
  const searchParams = useSearchParams();
  const clienteIdParam = searchParams.get('clienteId');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // Estado do fluxo de geração
  const [templateSelecionado, setTemplateSelecionado] = useState<Template | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [dadosExtras, setDadosExtras] = useState<Record<string, string>>({});
  const [dadosTestemunha, setDadosTestemunha] = useState<Partial<DadosTestemunha>>({});
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<{ sucesso: boolean; mensagem: string; contratoId?: string } | null>(null);
  const [etapa, setEtapa] = useState<'template' | 'cliente' | 'formulario' | 'concluido'>('template');

  useEffect(() => {
    Promise.all([
      fetch('/api/templates').then((r) => r.json()),
      fetch('/api/clientes').then((r) => r.json()),
    ]).then(([t, c]) => {
      setTemplates(Array.isArray(t) ? t : []);
      const clientesArr = Array.isArray(c) ? c : [];
      setClientes(clientesArr);

      if (clienteIdParam) {
        const cl = clientesArr.find((x: Cliente) => x.id === clienteIdParam);
        if (cl) {
          setClienteSelecionado(cl);
          setEtapa('template');
        }
      }
      setLoading(false);
    });
  }, [clienteIdParam]);

  const templatesFiltrados = templates.filter((t) =>
    t.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const clientesFiltrados = clientes.filter((c) => {
    const termo = buscaCliente.toLowerCase();
    return (
      (c.dados.NOME_CLIENTE || '').toLowerCase().includes(termo) ||
      (c.dados.CPF_CLIENTE || '').includes(termo)
    );
  });

  const selecionarTemplate = (t: Template) => {
    setTemplateSelecionado(t);
    setDadosExtras({});
    setDadosTestemunha({});
    setResultado(null);
    if (clienteSelecionado) {
      setEtapa('formulario');
    } else {
      setEtapa('cliente');
    }
  };

  const selecionarCliente = (c: Cliente) => {
    setClienteSelecionado(c);
    setEtapa('formulario');
  };

  const gerar = async () => {
    if (!templateSelecionado || !clienteSelecionado) return;
    setGerando(true);
    setResultado(null);
    try {
      const res = await fetch('/api/contratos/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: clienteSelecionado.id,
          templateId: templateSelecionado.id,
          dadosExtras,
          dadosTestemunha: templateSelecionado.requerTestemunha ? dadosTestemunha : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || data.detalhe || 'Erro ao gerar');
      setResultado({ sucesso: true, mensagem: 'Contrato gerado com sucesso!', contratoId: data.contrato?.id });
      setEtapa('concluido');
    } catch (e) {
      setResultado({ sucesso: false, mensagem: String(e) });
    } finally {
      setGerando(false);
    }
  };

  const reiniciar = () => {
    setTemplateSelecionado(null);
    setClienteSelecionado(clienteIdParam ? clienteSelecionado : null);
    setDadosExtras({});
    setDadosTestemunha({});
    setResultado(null);
    setEtapa(clienteIdParam && clienteSelecionado ? 'template' : 'template');
  };

  const camposFaltando = templateSelecionado?.tagsEspecificas.filter(
    (t) => t.tag !== 'DATA_ATUAL' && !dadosExtras[t.tag]?.trim()
  ) || [];

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
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title mb-1">Geração de Contratos</h1>
        <p className="text-gray-500 text-sm">Selecione um modelo e preencha os dados para gerar o documento</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {(['template', 'cliente', 'formulario', 'concluido'] as const).map((e, i) => {
          const labels = ['Modelo', 'Cliente', 'Dados', 'Concluído'];
          const ativo = e === etapa;
          const completo = (
            (e === 'template' && (etapa === 'cliente' || etapa === 'formulario' || etapa === 'concluido')) ||
            (e === 'cliente' && (etapa === 'formulario' || etapa === 'concluido')) ||
            (e === 'formulario' && etapa === 'concluido')
          );
          return (
            <div key={e} className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                ativo ? 'text-white' : completo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
              )} style={ativo ? { background: '#1a3050' } : {}}>
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                  ativo ? 'bg-white/20' : completo ? 'bg-emerald-200' : 'bg-gray-200'
                )}>
                  {completo ? '✓' : i + 1}
                </span>
                {labels[i]}
              </div>
              {i < 3 && <ChevronRight size={14} className="text-gray-300" />}
            </div>
          );
        })}
      </div>

      {/* Etapa: Selecionar Template */}
      {etapa === 'template' && (
        <div>
          {clienteSelecionado && (
            <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(clienteSelecionado.dados.NOME_CLIENTE || 'C')[0]}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-blue-800">{clienteSelecionado.dados.NOME_CLIENTE}</div>
                <div className="text-xs text-blue-600">Cliente selecionado</div>
              </div>
              {!clienteIdParam && (
                <button onClick={() => setClienteSelecionado(null)} className="text-blue-400 hover:text-blue-600">
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          <div className="relative mb-5">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar modelo de contrato..."
              className="input-field pl-11"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templatesFiltrados.map((t) => (
              <button
                key={t.id}
                onClick={() => selecionarTemplate(t)}
                className="card p-5 text-left hover:border-blue-200 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl flex-shrink-0">{ICONES_TEMPLATE[t.id] || '📄'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors mb-1">
                      {t.nome}
                    </div>
                    <div className="text-xs text-gray-400 mb-3">
                      {t.tagsEspecificas.length} campo(s) adicional(is) necessário(s)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {t.tagsEspecificas.slice(0, 3).map((tag) => (
                        <span key={tag.tag} className="badge badge-navy text-xs">
                          {tag.label}
                        </span>
                      ))}
                      {t.tagsEspecificas.length > 3 && (
                        <span className="badge badge-navy text-xs">
                          +{t.tagsEspecificas.length - 3} mais
                        </span>
                      )}
                      {t.requerTestemunha && (
                        <span className="badge badge-gold text-xs">Testemunha</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Etapa: Selecionar Cliente */}
      {etapa === 'cliente' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setEtapa('template')} className="btn-ghost py-2 px-3">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="section-title">Selecionar Cliente</h2>
              <p className="text-sm text-gray-500">Para: <strong>{templateSelecionado?.nome}</strong></p>
            </div>
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              placeholder="Buscar cliente por nome ou CPF..."
              className="input-field pl-11"
            />
          </div>

          <div className="card overflow-hidden">
            {clientesFiltrados.length === 0 ? (
              <div className="p-12 text-center">
                <Users size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Nenhum cliente encontrado</p>
                <Link href="/clientes/novo" className="btn-primary mt-4">
                  Cadastrar Cliente
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {clientesFiltrados.map((c, i) => {
                  const cores = ['#1a3050', '#254268', '#c9a84c'];
                  return (
                    <button
                      key={c.id}
                      onClick={() => selecionarCliente(c)}
                      className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                        style={{ background: cores[i % cores.length] }}>
                        {(c.dados.NOME_CLIENTE || 'C')[0]}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">{c.dados.NOME_CLIENTE || 'Sem nome'}</div>
                        <div className="text-xs text-gray-400">{c.dados.CPF_CLIENTE || 'CPF não informado'}</div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Etapa: Formulário */}
      {etapa === 'formulario' && templateSelecionado && clienteSelecionado && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setEtapa(clienteIdParam ? 'template' : 'cliente')} className="btn-ghost py-2 px-3">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="section-title">{templateSelecionado.nome}</h2>
              <p className="text-sm text-gray-500">Cliente: <strong>{clienteSelecionado.dados.NOME_CLIENTE}</strong></p>
            </div>
          </div>

          {/* Aviso de campos do cliente que faltam */}
          {(() => {
            const camposClienteFaltando = [];
            const dados = clienteSelecionado.dados;
            if (!dados.NOME_CLIENTE) camposClienteFaltando.push('Nome');
            if (!dados.CPF_CLIENTE) camposClienteFaltando.push('CPF');
            if (templateSelecionado.id.includes('HONORARIOS') || templateSelecionado.id === 'TEMPLATE_PROCURACAO') {
              if (!dados.NOME_MAE_CLIENTE) camposClienteFaltando.push('Nome da Mãe');
              if (!dados.NOME_PAI_CLIENTE) camposClienteFaltando.push('Nome do Pai');
            }
            if (camposClienteFaltando.length === 0) return null;
            return (
              <div className="mb-5 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-start gap-3">
                <Info size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-yellow-800 text-sm mb-1">
                    Dados do cliente incompletos
                  </div>
                  <div className="text-xs text-yellow-700">
                    Os seguintes campos não foram preenchidos no cadastro: {camposClienteFaltando.join(', ')}.
                    Eles aparecerão em branco no contrato.{' '}
                    <Link href={`/clientes/${clienteSelecionado.id}`} className="underline font-semibold">
                      Editar cadastro
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="card p-6 mb-5">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <FileText size={16} style={{ color: '#c9a84c' }} />
              Dados Adicionais do Contrato
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templateSelecionado.tagsEspecificas.map((tag) => (
                <div key={tag.tag} className={tag.tag.includes('DESCRICAO') || tag.tag.includes('OBJETO') || tag.tag.includes('FINALIDADE') ? 'md:col-span-2' : ''}>
                  <label className="label-field">{tag.label}</label>
                  {tag.tipo === 'select' && tag.opcoes ? (
                    <select
                      value={dadosExtras[tag.tag] || ''}
                      onChange={(e) => setDadosExtras((prev) => ({ ...prev, [tag.tag]: e.target.value }))}
                      className="input-field"
                    >
                      <option value="">Selecionar...</option>
                      {tag.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : tag.tag.includes('DESCRICAO') || tag.tag.includes('OBJETO') || tag.tag.includes('FINALIDADE') ? (
                    <textarea
                      value={dadosExtras[tag.tag] || ''}
                      onChange={(e) => setDadosExtras((prev) => ({ ...prev, [tag.tag]: e.target.value }))}
                      placeholder={tag.label}
                      rows={3}
                      className="input-field resize-none"
                    />
                  ) : (
                    <input
                      type={tag.tipo === 'date' ? 'date' : tag.tipo === 'number' ? 'number' : 'text'}
                      value={dadosExtras[tag.tag] || ''}
                      onChange={(e) => setDadosExtras((prev) => ({ ...prev, [tag.tag]: e.target.value }))}
                      placeholder={tag.label}
                      className="input-field"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dados da Testemunha */}
          {templateSelecionado.requerTestemunha && (
            <div className="card p-6 mb-5">
              <h3 className="font-bold text-gray-700 mb-1 flex items-center gap-2">
                <ScanLine size={16} style={{ color: '#1a3050' }} />
                Dados da Testemunha
              </h3>
              <p className="text-xs text-gray-400 mb-5">Preencha os dados da pessoa que irá testemunhar o documento</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  ['NOME_TESTEMUNHA', 'Nome Completo', 'text'],
                  ['CPF_TESTEMUNHA', 'CPF', 'text'],
                  ['NACIONALIDADE_TESTEMUNHA', 'Nacionalidade', 'text'],
                  ['ESTADO_CIVIL_TESTEMUNHA', 'Estado Civil', 'text'],
                  ['PROFISSAO_TESTEMUNHA', 'Profissão', 'text'],
                  ['TELEFONE_TESTEMUNHA', 'Telefone', 'text'],
                  ['LOGRADOURO_TESTEMUNHA', 'Logradouro', 'text'],
                  ['NUMERO_TESTEMUNHA', 'Número', 'text'],
                  ['BAIRRO_TESTEMUNHA', 'Bairro', 'text'],
                  ['CIDADE_TESTEMUNHA', 'Cidade', 'text'],
                  ['CEP_TESTEMUNHA', 'CEP', 'text'],
                ] as [keyof DadosTestemunha, string, string][]).map(([campo, label]) => (
                  <div key={campo} className={campo === 'NOME_TESTEMUNHA' ? 'md:col-span-2' : ''}>
                    <label className="label-field">{label}</label>
                    <input
                      type="text"
                      value={(dadosTestemunha[campo] as string) || ''}
                      onChange={(e) => setDadosTestemunha((prev) => ({ ...prev, [campo]: e.target.value }))}
                      placeholder={label}
                      className="input-field"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resultado */}
          {resultado && !resultado.sucesso && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{resultado.mensagem}</span>
            </div>
          )}

          {/* Ação */}
          <div className="flex items-center justify-between">
            <button onClick={() => setEtapa(clienteIdParam ? 'template' : 'cliente')} className="btn-ghost">
              <ArrowLeft size={16} />
              Voltar
            </button>
            <button onClick={gerar} disabled={gerando} className="btn-gold">
              {gerando ? (
                <><Loader2 size={16} className="animate-spin" />Gerando...</>
              ) : (
                <><FileText size={16} />Gerar Contrato</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Etapa: Concluído */}
      {etapa === 'concluido' && resultado?.sucesso && resultado.contratoId && (
        <div className="card p-12 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a3050' }}>
            Contrato Gerado!
          </h2>
          <p className="text-gray-500 mb-2">
            <strong>{templateSelecionado?.nome}</strong> para{' '}
            <strong>{clienteSelecionado?.dados.NOME_CLIENTE}</strong>
          </p>
          <p className="text-sm text-gray-400 mb-8">
            O arquivo foi salvo na pasta do cliente em seu computador
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href={`/api/contratos/${resultado.contratoId}/download`}
              className="btn-primary"
            >
              <Download size={16} />
              Baixar DOCX
            </a>
            <Link
              href={`/clientes/${clienteSelecionado?.id}`}
              className="btn-outline"
            >
              <Users size={16} />
              Ver Cliente
            </Link>
            <button onClick={reiniciar} className="btn-ghost">
              <FileText size={16} />
              Novo Contrato
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContratosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    }>
      <ContratoGerador />
    </Suspense>
  );
}
