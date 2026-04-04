import { NextResponse } from 'next/server';
import { buscarCliente, salvarCliente, deletarCliente, copiarDocumentosParaCliente } from '@/lib/storage';

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

  try {
    const body = await req.json();
    const atualizado = {
      ...cliente,
      dados: { ...cliente.dados, ...body.dados },
      contratos: body.contratos ?? cliente.contratos,
      atualizadoEm: new Date().toISOString(),
    };

    // Adicionar novos documentos do scanner se enviados
    if (body.arquivosScanner && Array.isArray(body.arquivosScanner) && body.arquivosScanner.length > 0) {
      const docsNovos = copiarDocumentosParaCliente(id, body.arquivosScanner);
      const existentes = atualizado.documentos || [];
      atualizado.documentos = [...new Set([...existentes, ...docsNovos])];
    } else {
      atualizado.documentos = atualizado.documentos || [];
    }

    salvarCliente(atualizado);
    return NextResponse.json(atualizado);
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao atualizar cliente', detalhe: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deletarCliente(id);
  if (!ok) return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 });
  return NextResponse.json({ sucesso: true });
}
