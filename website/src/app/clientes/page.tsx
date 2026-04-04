'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Search, Plus, ArrowRight, FileText, Trash2 } from 'lucide-react';
import { Cliente } from '@/lib/types';
import { formatarDataHora } from '@/lib/utils';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletando, setDeletando] = useState<string | null>(null);

  const carregar = async () => {
    const res = await fetch('/api/clientes');
    const data = await res.json();
    setClientes(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = clientes.filter((c) => {
    const termo = busca.toLowerCase();
    return (
      (c.dados.NOME_CLIENTE || '').toLowerCase().includes(termo) ||
      (c.dados.CPF_CLIENTE || '').includes(termo) ||
      (c.dados.CIDADE_CLIENTE || '').toLowerCase().includes(termo)
    );
  });

  const deletar = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeletando(id);
    await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
    await carregar();
    setDeletando(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-4 mx-auto mb-4 animate-spin"
            style={{ borderColor: '#1a3050', borderTopColor: 'transparent' }}
          />
          <p className="text-gray-500 text-sm">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title mb-1">Clientes</h1>
          <p className="text-gray-500 text-sm">
            {clientes.length} cliente(s) cadastrado(s)
          </p>
        </div>
        <Link href="/clientes/novo" className="btn-primary">
          <Plus size={16} />
          Novo Cliente
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou cidade..."
          className="input-field pl-12 text-base"
          style={{ paddingTop: '14px', paddingBottom: '14px' }}
        />
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="card p-16 text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: '#e8edf4' }}
          >
            <Users size={36} style={{ color: '#1a3050' }} />
          </div>
          {busca ? (
            <>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#1a3050' }}>
                Nenhum resultado encontrado
              </h3>
              <p className="text-gray-400 mb-6">
                Tente buscar por outro nome ou CPF
              </p>
              <button onClick={() => setBusca('')} className="btn-outline">
                Limpar busca
              </button>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#1a3050' }}>
                Nenhum cliente cadastrado
              </h3>
              <p className="text-gray-400 mb-8 max-w-sm mx-auto">
                Cadastre seu primeiro cliente e comece a gerenciar seus contratos
              </p>
              <Link href="/clientes/novo" className="btn-primary">
                <Plus size={16} />
                Cadastrar Primeiro Cliente
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtrados.map((cliente, idx) => {
              const inicial = (cliente.dados.NOME_CLIENTE || 'C')[0].toUpperCase();
              const cores = ['#1a3050', '#254268', '#c9a84c', '#a88630', '#2d6a4f'];
              const cor = cores[idx % cores.length];

              return (
                <div
                  key={cliente.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                    style={{ background: cor }}
                  >
                    {inicial}
                  </div>

                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                      {cliente.dados.NOME_CLIENTE || 'Sem nome'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3">
                      {cliente.dados.CPF_CLIENTE && (
                        <span>CPF: {cliente.dados.CPF_CLIENTE}</span>
                      )}
                      {cliente.dados.CIDADE_CLIENTE && (
                        <>
                          <span>·</span>
                          <span>{cliente.dados.CIDADE_CLIENTE}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>Cadastrado em {formatarDataHora(cliente.criadoEm)}</span>
                    </div>
                  </Link>

                  <div className="flex items-center gap-3">
                    {(cliente.contratos?.length || 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <FileText size={13} />
                        <span>{cliente.contratos.length}</span>
                      </div>
                    )}

                    <Link
                      href={`/clientes/${cliente.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost py-1.5 px-3 text-xs"
                    >
                      Ver
                      <ArrowRight size={13} />
                    </Link>

                    <button
                      onClick={() => deletar(cliente.id, cliente.dados.NOME_CLIENTE || 'este cliente')}
                      disabled={deletando === cliente.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                      title="Excluir cliente"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
