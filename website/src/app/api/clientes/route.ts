import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getClientes, salvarCliente, copiarArquivosScanner, registrarEvento
} from '@/lib/storage';
import { Cliente } from '@/lib/types';

export async function GET() {
  try {
    return NextResponse.json(getClientes());
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { dados, arquivosScanner, pastaScanner } = body;

    const agora = new Date().toISOString();
    const cliente: Cliente = {
      id: uuidv4(),
      criadoEm: agora,
      atualizadoEm: agora,
      dados,
      contratos: [],
      documentos: [],
    };

    salvarCliente(cliente);

    // Copia documentos escaneados para a pasta do cliente
    if (arquivosScanner?.length && pastaScanner) {
      const copiados = copiarArquivosScanner(cliente.id, arquivosScanner, pastaScanner);
      cliente.documentos = copiados;
      salvarCliente(cliente);
    }

    registrarEvento('CLIENTE_CRIADO', `Cliente cadastrado: ${dados.NOME_CLIENTE || 'sem nome'}`, {
      nomeCliente: dados.NOME_CLIENTE,
      clienteId: cliente.id,
    });

    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}
