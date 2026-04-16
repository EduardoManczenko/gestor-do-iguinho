'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit2, Save, X, Download, FileText, Trash2,
  FolderOpen, Plus, Loader2, AlertCircle, CheckCircle, Calendar,
  FileImage, Info
} from 'lucide-react';
import { Cliente, DadosCliente, Contrato } from '@/lib/types';
import ClienteFormFields from '@/components/ClienteFormFields';
import DocumentScanner from '@/components/DocumentScanner';
import { formatarDataHora, LABELS_CAMPOS, brDateToISO } from '@/lib/utils';

export default function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState<Partial<DadosCliente>>({});
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [deletandoContrato, setDeletandoContrato] = useState<string | null>(null);
  const [arquivosNovosScan, setArquivosNovosScan] = useState<string[]>([]);
  const [pastaNovosScan, setPastaNovosScan] = useState('');
  const [baixandoContrato, setBaixandoContrato] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const res = await fetch(`/api/clientes/${id}`);
    if (!res.ok) { router.push('/clientes'); return; }
    const data: Cliente = await res.json();
    setCliente(data);
    const dadosNorm = { ...data.dados };
    if (dadosNorm.DATA_NASCIMENTO_CLIENTE) dadosNorm.DATA_NASCIMENTO_CLIENTE = brDateToISO(dadosNorm.DATA_NASCIMENTO_CLIENTE);
    setDados(dadosNorm);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [id]);

  const salvar = async () => {
    if (!cliente) return;
    setSalvando(true);
    setMensagem(null);
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dados,
          arquivosScanner: arquivosNovosScan,
          pastaScanner: pastaNovosScan,
        }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      const atualizado: Cliente = await res.json();
      setCliente(atualizado);
      setDados(atualizado.dados);
      setEditando(false);
      setArquivosNovosScan([]);
      setMensagem({ tipo: 'ok', texto: 'Dados atualizados com sucesso!' });
      setTimeout(() => setMensagem(null), 3000);
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível salvar. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  };

  const cancelarEdicao = () => {
    setDados(cliente?.dados || {});
    setEditando(false);
  };

  const onDadosExtraidos = (dadosNovos: Partial<DadosCliente>, arquivos: string[], pasta: string) => {
    setDados((prev) => {
      const merged = { ...prev };
      for (const [k, v] of Object.entries(dadosNovos)) {
        if (v) (merged as Record<string, string>)[k] = v as string;
      }
      return merged;
    });
    setArquivosNovosScan((prev) => [...new Set([...prev, ...arquivos])]);
    if (pasta) setPastaNovosScan(pasta);
  };

  const deletarContrato = async (contrato: Contrato) => {
    if (!cliente) return;
    if (!confirm(`Excluir o contrato "${contrato.nomeTemplate}"?`)) return;
    setDeletandoContrato(contrato.id);
    try {
      const novosContratos = (cliente.contratos || []).filter((c) => c.id !== contrato.id);
      await fetch(`/api/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratos: novosContratos }),
      });
      setCliente((prev) => prev ? { ...prev, contratos: novosContratos } : prev);
    } catch {
      alert('Erro ao excluir contrato.');
    } finally {
      setDeletandoContrato(null);
    }
  };

  const baixarContrato = async (contrato: Contrato) => {
    setBaixandoContrato(contrato.id);
    try {
      const res = await fetch(`/api/contratos/${contrato.id}/download`);
      if (!res.ok) { alert('Arquivo não encontrado.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = contrato.nomeArquivo || `${contrato.id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao baixar contrato.');
    } finally {
      setBaixandoContrato(null);
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

  if (!cliente) return null;

  const inicial = (cliente.dados.NOME_CLIENTE || 'C')[0].toUpperCase();
  const camposPreenchidos = Object.values(cliente.dados).filter(Boolean).length;
  const totalCampos = 20;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/clientes" className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="page-title">{cliente.dados.NOME_CLIENTE || 'Cliente sem nome'}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-400">Cadastrado em {formatarDataHora(cliente.criadoEm)}</span>
            <span className="badge badge-navy text-xs">{camposPreenchidos}/{totalCampos} campos</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editando ? (
            <button onClick={() => setEditando(true)} className="btn-outline">
              <Edit2 size={15} />Editar
            </button>
          ) : (
            <>
              <button onClick={cancelarEdicao} className="btn-ghost">
                <X size={15} />Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="btn-primary">
                {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Salvar
              </button>
            </>
          )}
        </div>
      </div>

      {mensagem && (
        <div className={`mb-5 p-4 rounded-2xl flex items-center gap-3 animate-fade-in ${
          mensagem.tipo === 'ok' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
        }`}>
          {mensagem.tipo === 'ok'
            ? <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
            : <AlertCircle size={18} className="text-red-500 flex-shrink-0" />}
          <span className={`text-sm font-medium ${mensagem.tipo === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
            {mensagem.texto}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">
          {!editando && (
            <div className="card p-6">
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-2xl flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1a3050, #254268)' }}
                >
                  {inicial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xl text-gray-800 mb-2">{cliente.dados.NOME_CLIENTE || 'Sem nome'}</div>
                  <div className="flex flex-wrap gap-2">
                    {cliente.dados.CPF_CLIENTE && <span className="badge badge-navy">CPF: {cliente.dados.CPF_CLIENTE}</span>}
                    {cliente.dados.ESTADO_CIVIL_CLIENTE && <span className="badge badge-gold">{cliente.dados.ESTADO_CIVIL_CLIENTE}</span>}
                    {cliente.dados.PROFISSAO_CLIENTE && <span className="badge badge-navy">{cliente.dados.PROFISSAO_CLIENTE}</span>}
                    {cliente.dados.CIDADE_CLIENTE && <span className="badge badge-navy">{cliente.dados.CIDADE_CLIENTE}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {([
                  ['TELEFONE_CLIENTE', 'Telefone'],
                  ['NATURALIDADE_CLIENTE', 'Naturalidade'],
                  ['DATA_NASCIMENTO_CLIENTE', 'Nascimento'],
                  ['DOCUMENTO_TIPO_CLIENTE', 'Documento'],
                ] as [keyof DadosCliente, string][]).map(([campo, label]) => {
                  const val = cliente.dados[campo];
                  if (!val) return null;
                  return (
                    <div key={campo} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{label}</div>
                      <div className="text-sm font-medium text-gray-700">{val}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {editando && (
            <div className="card p-8">
              <div className="mb-6">
                <DocumentScanner onDadosExtraidos={onDadosExtraidos} />
              </div>
              {arquivosNovosScan.length > 0 && (
                <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
                  <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700">
                    <strong>{arquivosNovosScan.length} documento(s)</strong> serão salvos ao gravar:
                    {arquivosNovosScan.map(f => <div key={f} className="font-mono mt-0.5">{f}</div>)}
                  </div>
                </div>
              )}
              <ClienteFormFields dados={dados} onChange={(c, v) => setDados((prev) => ({ ...prev, [c]: v }))} />
            </div>
          )}

          {!editando && (
            <div className="card p-6">
              <h2 className="section-title mb-5">Dados Completos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(LABELS_CAMPOS).map(([campo, label]) => {
                  const val = (cliente.dados as Record<string, string>)[campo];
                  return (
                    <div key={campo} className="bg-gray-50/80 rounded-xl p-3">
                      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{label}</div>
                      <div className={`text-sm ${val ? 'font-medium text-gray-700' : 'text-gray-300 italic'}`}>
                        {val || 'Não informado'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen size={15} style={{ color: '#c9a84c' }} />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Pasta do Cliente</span>
            </div>
            <div className="text-xs text-gray-400 font-mono break-all leading-relaxed">
              clientes/{cliente.id}/
            </div>
          </div>

          <div className="card p-4">
            <Link href={`/contratos?clienteId=${cliente.id}`} className="btn-gold w-full justify-center">
              <Plus size={16} />
              Gerar Contrato
            </Link>
          </div>

          {(cliente.documentos?.length || 0) > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-sm" style={{ color: '#1a3050' }}>Documentos ({cliente.documentos.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {cliente.documentos.map((nome) => {
                  const ext = nome.split('.').pop()?.toUpperCase() || 'DOC';
                  return (
                    <div key={nome} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                        style={{ background: ext === 'PDF' ? '#e53e3e' : '#3182ce' }}>
                        {ext.slice(0, 3)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-700 truncate">{nome}</div>
                      </div>
                      <FileImage size={13} className="text-gray-300 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm" style={{ color: '#1a3050' }}>Contratos ({cliente.contratos?.length || 0})</h3>
            </div>

            {(!cliente.contratos || cliente.contratos.length === 0) ? (
              <div className="p-8 text-center">
                <FileText size={28} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Nenhum contrato gerado</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {cliente.contratos.map((contrato) => (
                  <div key={contrato.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#fdf5e0' }}>
                        <FileText size={14} style={{ color: '#c9a84c' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-700 leading-tight">{contrato.nomeTemplate}</div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <Calendar size={10} />
                          {formatarDataHora(contrato.geradoEm)}
                        </div>
                      </div>
                    </div>

                    <div className="ml-10 flex items-center gap-2">
                      <button
                        onClick={() => baixarContrato(contrato)}
                        disabled={baixandoContrato === contrato.id}
                        className="btn-ghost py-1.5 px-3 text-xs"
                      >
                        {baixandoContrato === contrato.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Download size={12} />}
                        DOCX
                      </button>
                      <button
                        onClick={() => deletarContrato(contrato)}
                        disabled={deletandoContrato === contrato.id}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        {deletandoContrato === contrato.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
