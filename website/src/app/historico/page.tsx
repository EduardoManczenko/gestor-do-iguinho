'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  History, UserPlus, UserCheck, UserX, FileText, Trash2,
  ScanLine, Filter, RefreshCw, ArrowRight, ChevronDown, ChevronUp,
  FolderOpen, Download, Upload,
} from 'lucide-react';
import { EventoHistorico, TipoEvento } from '@/lib/types';
import { cn, formatarDataHora } from '@/lib/utils';

// ─── Configuração visual por tipo de evento ───────────────────────────────

const TIPO_CONFIG: Record<TipoEvento, {
  label: string;
  icon: React.ElementType;
  cor: string;
  corBg: string;
  corBorda: string;
  corTexto: string;
}> = {
  CLIENTE_CRIADO: {
    label: 'Cliente cadastrado',
    icon: UserPlus,
    cor: 'bg-emerald-500',
    corBg: 'bg-emerald-50',
    corBorda: 'border-emerald-200',
    corTexto: 'text-emerald-700',
  },
  CLIENTE_ATUALIZADO: {
    label: 'Dados atualizados',
    icon: UserCheck,
    cor: 'bg-blue-500',
    corBg: 'bg-blue-50',
    corBorda: 'border-blue-200',
    corTexto: 'text-blue-700',
  },
  CLIENTE_DELETADO: {
    label: 'Cliente removido',
    icon: UserX,
    cor: 'bg-red-500',
    corBg: 'bg-red-50',
    corBorda: 'border-red-200',
    corTexto: 'text-red-700',
  },
  CONTRATO_GERADO: {
    label: 'Contrato gerado',
    icon: FileText,
    cor: 'bg-amber-500',
    corBg: 'bg-amber-50',
    corBorda: 'border-amber-200',
    corTexto: 'text-amber-700',
  },
  CONTRATO_DELETADO: {
    label: 'Contrato removido',
    icon: Trash2,
    cor: 'bg-orange-500',
    corBg: 'bg-orange-50',
    corBorda: 'border-orange-200',
    corTexto: 'text-orange-700',
  },
  DOCUMENTO_ESCANEADO: {
    label: 'Documento escaneado',
    icon: ScanLine,
    cor: 'bg-purple-500',
    corBg: 'bg-purple-50',
    corBorda: 'border-purple-200',
    corTexto: 'text-purple-700',
  },
  PASTA_ALTERADA: {
    label: 'Pasta de dados alterada',
    icon: FolderOpen,
    cor: 'bg-slate-500',
    corBg: 'bg-slate-50',
    corBorda: 'border-slate-200',
    corTexto: 'text-slate-700',
  },
  BACKUP_EXPORTADO: {
    label: 'Backup exportado',
    icon: Download,
    cor: 'bg-teal-500',
    corBg: 'bg-teal-50',
    corBorda: 'border-teal-200',
    corTexto: 'text-teal-700',
  },
  BACKUP_IMPORTADO: {
    label: 'Backup importado',
    icon: Upload,
    cor: 'bg-indigo-500',
    corBg: 'bg-indigo-50',
    corBorda: 'border-indigo-200',
    corTexto: 'text-indigo-700',
  },
};

// ─── Agrupamento por data ─────────────────────────────────────────────────

function agruparPorData(eventos: EventoHistorico[]): { label: string; eventos: EventoHistorico[] }[] {
  const grupos: Map<string, EventoHistorico[]> = new Map();

  for (const ev of eventos) {
    const d = new Date(ev.data);
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    const mesmodia = (a: Date, b: Date) =>
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear();

    let label: string;
    if (mesmodia(d, hoje)) label = 'Hoje';
    else if (mesmodia(d, ontem)) label = 'Ontem';
    else {
      label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }

    if (!grupos.has(label)) grupos.set(label, []);
    grupos.get(label)!.push(ev);
  }

  return Array.from(grupos.entries()).map(([label, eventos]) => ({ label, eventos }));
}

// ─── Componente principal ─────────────────────────────────────────────────

export default function HistoricoPage() {
  const [eventos, setEventos] = useState<EventoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento | ''>('');
  const [busca, setBusca] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [recarregando, setRecarregando] = useState(false);

  const carregar = async () => {
    setRecarregando(true);
    try {
      const res = await fetch('/api/historico');
      const data = await res.json();
      setEventos(Array.isArray(data) ? data : []);
    } catch {
      setEventos([]);
    } finally {
      setLoading(false);
      setRecarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [filtroTipo]);

  const toggleExpandido = (id: string) => {
    setExpandidos(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const eventosFiltrados = eventos.filter(ev => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      ev.descricao.toLowerCase().includes(q) ||
      ev.nomeCliente?.toLowerCase().includes(q) ||
      Object.values(ev.detalhes || {}).some(v => v.toLowerCase().includes(q))
    );
  });

  const grupos = agruparPorData(eventosFiltrados);

  const contadores = eventos.reduce((acc, ev) => {
    acc[ev.tipo] = (acc[ev.tipo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1a3050, #254268)' }}
          >
            <History size={22} className="text-white" />
          </div>
          <div>
            <h1 className="page-title">Histórico</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Registro de todas as atividades do sistema
            </p>
          </div>
        </div>
        <button
          onClick={carregar}
          disabled={recarregando}
          className="btn-ghost gap-2"
          title="Atualizar"
        >
          <RefreshCw size={15} className={cn(recarregando && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      {!loading && eventos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {(Object.entries(TIPO_CONFIG) as [TipoEvento, typeof TIPO_CONFIG[TipoEvento]][])
            .filter(([tipo]) => contadores[tipo])
            .map(([tipo, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={tipo}
                  onClick={() => setFiltroTipo(filtroTipo === tipo ? '' : tipo)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                    filtroTipo === tipo
                      ? `${cfg.corBg} ${cfg.corBorda}`
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  )}
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', cfg.cor)}>
                    <Icon size={14} className="text-white" />
                  </div>
                  <div>
                    <div className={cn('font-bold text-sm', filtroTipo === tipo ? cfg.corTexto : 'text-gray-800')}>
                      {contadores[tipo]}
                    </div>
                    <div className="text-xs text-gray-400 leading-tight">{cfg.label}</div>
                  </div>
                </button>
              );
            })}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Filtrar por nome, ação..."
            className="input-field text-sm"
            style={{ paddingLeft: '36px' }}
          />
        </div>
        {(filtroTipo || busca) && (
          <button
            onClick={() => { setFiltroTipo(''); setBusca(''); }}
            className="btn-ghost text-sm"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-gray-300" />
            <span className="text-sm text-gray-400">Carregando histórico...</span>
          </div>
        </div>
      ) : eventosFiltrados.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="font-semibold text-gray-700 mb-2">
            {eventos.length === 0 ? 'Nenhuma atividade ainda' : 'Nenhum resultado para o filtro'}
          </h3>
          <p className="text-sm text-gray-400">
            {eventos.length === 0
              ? 'O histórico será preenchido conforme você usar o sistema — cadastre clientes, gere contratos e tudo ficará registrado aqui.'
              : 'Tente remover os filtros para ver mais resultados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map(({ label, eventos: evs }) => (
            <div key={label}>
              {/* Separador de data */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
                  {label}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              {/* Timeline */}
              <div className="relative">
                {/* Linha vertical */}
                <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-100" />

                <div className="space-y-3">
                  {evs.map((ev) => {
                    const cfg = TIPO_CONFIG[ev.tipo];
                    const Icon = cfg.icon;
                    const expandido = expandidos.has(ev.id);
                    const temDetalhes = ev.detalhes && Object.keys(ev.detalhes).filter(k => ev.detalhes![k]).length > 0;

                    return (
                      <div key={ev.id} className="relative flex gap-4">
                        {/* Ícone na timeline */}
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-white shadow-sm',
                          cfg.cor
                        )}>
                          <Icon size={15} className="text-white" />
                        </div>

                        {/* Card do evento */}
                        <div className={cn(
                          'flex-1 rounded-xl border-2 overflow-hidden transition-all',
                          cfg.corBorda, cfg.corBg
                        )}>
                          <div className="flex items-start justify-between p-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn('text-xs font-bold uppercase tracking-wide', cfg.corTexto)}>
                                  {cfg.label}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-gray-800 mt-0.5 leading-snug">
                                {ev.descricao}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs text-gray-400">
                                  {new Date(ev.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                {ev.clienteId && (
                                  <Link
                                    href={`/clientes/${ev.clienteId}`}
                                    className={cn('flex items-center gap-1 text-xs font-medium hover:underline', cfg.corTexto)}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    Ver cliente <ArrowRight size={10} />
                                  </Link>
                                )}
                              </div>
                            </div>

                            {temDetalhes && (
                              <button
                                onClick={() => toggleExpandido(ev.id)}
                                className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                {expandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </button>
                            )}
                          </div>

                          {/* Detalhes expandíveis */}
                          {expandido && temDetalhes && (
                            <div className="px-4 pb-3 border-t border-white/60">
                              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                                {Object.entries(ev.detalhes!).map(([k, v]) => {
                                  if (!v) return null;
                                  const labels: Record<string, string> = {
                                    cpf: 'CPF',
                                    documentos: 'Documentos salvos',
                                    documentosAdicionados: 'Docs adicionados',
                                    template: 'Modelo de contrato',
                                    contratoId: 'ID do contrato',
                                  };
                                  return (
                                    <div key={k}>
                                      <span className="text-xs text-gray-400">{labels[k] || k}: </span>
                                      <span className="text-xs font-medium text-gray-700">{v}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {eventosFiltrados.length >= 200 && (
            <p className="text-center text-xs text-gray-400 py-4">
              Exibindo os 200 eventos mais recentes
            </p>
          )}
        </div>
      )}
    </div>
  );
}
