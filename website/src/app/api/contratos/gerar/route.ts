import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { buscarCliente, salvarCliente, salvarContrato } from '@/lib/storage';
import { buscarTemplate } from '@/lib/templates';
import { gerarContratoDOCX } from '@/lib/contracts';
import { Contrato } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clienteId, templateId, dadosExtras, dadosTestemunha } = body;

    if (!clienteId || !templateId) {
      return NextResponse.json({ erro: 'clienteId e templateId são obrigatórios' }, { status: 400 });
    }

    const cliente = buscarCliente(clienteId);
    if (!cliente) {
      return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 });
    }

    const template = buscarTemplate(templateId);
    if (!template) {
      return NextResponse.json({ erro: 'Template não encontrado' }, { status: 404 });
    }

    const buffer = gerarContratoDOCX(templateId, cliente.dados, dadosExtras || {}, dadosTestemunha);

    const contratoId = uuidv4();
    const contrato: Contrato = {
      id: contratoId,
      template: templateId,
      nomeTemplate: template.nome,
      criadoEm: new Date().toISOString(),
      dadosExtras: dadosExtras || {},
      arquivoDOCX: '',
      clienteId,
    };

    const arquivoPath = salvarContrato(clienteId, contrato, buffer);
    contrato.arquivoDOCX = arquivoPath;

    // Atualizar cliente com o novo contrato
    cliente.contratos = [...(cliente.contratos || []), contrato];
    cliente.atualizadoEm = new Date().toISOString();
    salvarCliente(cliente);

    return NextResponse.json({ sucesso: true, contrato }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao gerar contrato', detalhe: String(error) }, { status: 500 });
  }
}
