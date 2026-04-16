import { NextResponse } from 'next/server';
import {
  buscarCliente, salvarCliente, deletarCliente,
  copiarArquivosScanner, registrarEvento
} from '@/lib/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = buscarCliente(id);
  if (!cliente) return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 });
  return NextResponse.json(cliente);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = buscarCliente(id);
  if (!cliente) return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 });

  const body = await req.json();
  const { dados, contratos, arquivosScanner, pastaScanner } = body;

  const atualizado = {
    ...cliente,
    dados: dados ?? cliente.dados,
    contratos: contratos ?? cliente.contratos,
    atualizadoEm: new Date().toISOString(),
  };

  salvarCliente(atualizado);

  // Copia novos documentos escaneados
  if (arquivosScanner?.length && pastaScanner) {
    const copiados = copiarArquivosScanner(id, arquivosScanner, pastaScanner);
    atualizado.documentos = [...new Set([...(atualizado.documentos || []), ...copiados])];
    salvarCliente(atualizado);
  }

  registrarEvento('CLIENTE_ATUALIZADO', `Cliente atualizado: ${atualizado.dados.NOME_CLIENTE || 'sem nome'}`, {
    nomeCliente: atualizado.dados.NOME_CLIENTE,
    clienteId: id,
  });

  return NextResponse.json(atualizado);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = buscarCliente(id);
  if (!cliente) return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 });

  deletarCliente(id);
  registrarEvento('CLIENTE_DELETADO', `Cliente excluído: ${cliente.dados.NOME_CLIENTE || 'sem nome'}`, {
    nomeCliente: cliente.dados.NOME_CLIENTE,
    clienteId: id,
  });

  return NextResponse.json({ sucesso: true });
}
