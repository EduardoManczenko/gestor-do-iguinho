import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { listarClientes, salvarCliente, copiarDocumentosParaCliente } from '@/lib/storage';
import { Cliente } from '@/lib/types';

export async function GET() {
  try {
    const clientes = listarClientes();
    return NextResponse.json(clientes);
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao listar clientes', detalhe: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const agora = new Date().toISOString();

    const cliente: Cliente = {
      id: uuidv4(),
      criadoEm: agora,
      atualizadoEm: agora,
      dados: body.dados || {},
      contratos: [],
      documentos: [],
    };

    salvarCliente(cliente);

    // Copiar documentos do scanner para a pasta do cliente
    if (body.arquivosScanner && Array.isArray(body.arquivosScanner) && body.arquivosScanner.length > 0) {
      const docsCopiados = copiarDocumentosParaCliente(cliente.id, body.arquivosScanner);
      cliente.documentos = docsCopiados;
      cliente.atualizadoEm = new Date().toISOString();
      salvarCliente(cliente);
    }

    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao criar cliente', detalhe: String(error) }, { status: 500 });
  }
}
