'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, FileText, FolderOpen, ArrowRight, Scale, Plus } from 'lucide-react';
import { Cliente } from '@/lib/types';
import { formatarDataHora } from '@/lib/utils';

export default function Dashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { carregarDados(); }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const res = await fetch('/api/clientes');
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch {
      setClientes([]);
    }
    setLoading(false);
  }

  const totalContratos = clientes.reduce((acc, c) => acc + (c.contratos?.length || 0), 0);
  const recentes = clientes.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent mx-auto mb-4 animate-spin"
            style={{ borderColor: '#1a3050', borderTopColor: 'transparent' }}
          />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c9a84c, #a88630)' }}
          >
            <Scale size={20} className="text-white" />
          </div>
          <h1 className="page-title">Bem-vindo ao Gestor Jurídico</h1>
        </div>
        <p className="text-gray-500 mt-2 ml-[52px]">
          Gerencie seus clientes e gere contratos com facilidade
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#e8edf4' }}>
              <Users size={22} style={{ color: '#1a3050' }} />
            </div>
            <span className="badge badge-navy">Total</span>
          </div>
          <div className="text-3xl font-bold mb-1" style={{ color: '#1a3050' }}>{clientes.length}</div>
          <div className="text-sm text-gray-500 font-medium">Clientes cadastrados</div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#fdf5e0' }}>
              <FileText size={22} style={{ color: '#c9a84c' }} />
            </div>
            <span className="badge badge-gold">Total</span>
          </div>
          <div className="text-3xl font-bold mb-1" style={{ color: '#1a3050' }}>{totalContratos}</div>
          <div className="text-sm text-gray-500 font-medium">Contratos gerados</div>
        </div>

        <Link
          href="/dados"
          className="card p-6 hover:border-gray-200 hover:shadow-md transition-all duration-200 group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 group-hover:scale-105 transition-transform">
              <FolderOpen size={22} className="text-emerald-600" />
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="text-sm font-semibold mb-1 text-gray-700">Dados &amp; Backup</div>
          <div className="text-xs text-gray-400">Gerenciar pasta e fazer backup</div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <Link
          href="/clientes/novo"
          className="card p-6 flex items-center gap-5 hover:border-blue-200 hover:shadow-md transition-all duration-200 group"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
            style={{ background: 'linear-gradient(135deg, #1a3050, #254268)' }}
          >
            <Plus size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-base mb-1" style={{ color: '#1a3050' }}>Cadastrar Cliente</div>
            <div className="text-sm text-gray-500">Adicionar novo cliente com leitura de documentos</div>
          </div>
          <ArrowRight size={18} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href="/contratos"
          className="card p-6 flex items-center gap-5 hover:border-yellow-200 hover:shadow-md transition-all duration-200 group"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
            style={{ background: 'linear-gradient(135deg, #c9a84c, #a88630)' }}
          >
            <FileText size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-base mb-1" style={{ color: '#1a3050' }}>Gerar Contrato</div>
            <div className="text-sm text-gray-500">Preencher e exportar documentos jurídicos</div>
          </div>
          <ArrowRight size={18} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Recent Clients */}
      {recentes.length > 0 && (
        <div className="card">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="section-title">Clientes Recentes</h2>
            <Link href="/clientes" className="btn-ghost text-xs">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentes.map((cliente) => (
              <Link
                key={cliente.id}
                href={`/clientes/${cliente.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1a3050, #254268)' }}
                >
                  {(cliente.dados.NOME_CLIENTE || 'C')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 truncate">
                    {cliente.dados.NOME_CLIENTE || 'Sem nome'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {cliente.dados.CPF_CLIENTE || 'CPF não informado'} ·{' '}
                    {formatarDataHora(cliente.criadoEm)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-navy">{cliente.contratos?.length || 0} contrato(s)</span>
                  <ArrowRight size={16} className="text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {clientes.length === 0 && (
        <div className="card p-16 text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: '#e8edf4' }}
          >
            <Users size={36} style={{ color: '#1a3050' }} />
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: '#1a3050' }}>Nenhum cliente ainda</h3>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">
            Comece cadastrando seu primeiro cliente. Você pode ler os dados diretamente dos documentos escaneados.
          </p>
          <Link href="/clientes/novo" className="btn-primary">
            <Plus size={16} />
            Cadastrar Primeiro Cliente
          </Link>
        </div>
      )}
    </div>
  );
}
