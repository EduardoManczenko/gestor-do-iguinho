import { NextResponse } from 'next/server';
import { buscarTemplate } from '@/lib/templates';
import { gerarContratoDOCX } from '@/lib/contracts';
import {
  buscarCliente, salvarCliente, salvarContrato, registrarEvento
} from '@/lib/storage';
import { Contrato } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { templateId, clienteId, dadosExtras, dadosTestemunha } = body;

    if (!templateId || !clienteId) {
      return NextResponse.json(
        { erro: 'templateId e clienteId são obrigatórios' },
        { status: 400 }
      );
    }

    const template = buscarTemplate(templateId);
    if (!template) {
      return NextResponse.json({ erro: 'Template não encontrado' }, { status: 404 });
    }

    const cliente = buscarCliente(clienteId);
    if (!cliente) {
      return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 });
    }

    const buffer = gerarContratoDOCX(
      templateId,
      cliente.dados,
      dadosExtras || {},
      dadosTestemunha
    );

    const contratoId = uuidv4();
    const nomeArquivo = `${templateId}_${new Date().toISOString().slice(0, 10)}_${contratoId.slice(0, 8)}.docx`;

    const contrato: Contrato = {
      id: contratoId,
      templateId,
      nomeTemplate: template.nome,
      nomeArquivo,
      geradoEm: new Date().toISOString(),
    };

    // Salva o DOCX na pasta do cliente
    salvarContrato(clienteId, contrato, buffer);

    // Atualiza o cliente com o novo contrato
    const clienteAtualizado = {
      ...cliente,
      contratos: [...(cliente.contratos || []), contrato],
      atualizadoEm: new Date().toISOString(),
    };
    salvarCliente(clienteAtualizado);

    registrarEvento(
      'CONTRATO_GERADO',
      `Contrato "${template.nome}" gerado para ${cliente.dados.NOME_CLIENTE || 'cliente'}`,
      { nomeCliente: cliente.dados.NOME_CLIENTE, clienteId }
    );

    return NextResponse.json({ sucesso: true, contrato });
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao gerar contrato', detalhe: String(error) },
      { status: 500 }
    );
  }
}
