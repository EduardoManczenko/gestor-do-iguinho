import { NextResponse } from 'next/server';
import { buscarCliente, listarClientes, lerContratoDOCX } from '@/lib/storage';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contratoId: string }> }
) {
  const { contratoId } = await params;

  try {
    // Buscar o contrato em todos os clientes
    const clientes = listarClientes();
    let clienteId = '';
    let templateId = '';
    let nomeContrato = '';

    for (const cliente of clientes) {
      const contrato = (cliente.contratos || []).find((c) => c.id === contratoId);
      if (contrato) {
        clienteId = cliente.id;
        templateId = contrato.template;
        nomeContrato = contrato.nomeTemplate;
        break;
      }
    }

    if (!clienteId) {
      return NextResponse.json({ erro: 'Contrato não encontrado' }, { status: 404 });
    }

    const buffer = lerContratoDOCX(clienteId, contratoId, templateId);
    if (!buffer) {
      return NextResponse.json({ erro: 'Arquivo do contrato não encontrado' }, { status: 404 });
    }

    const nomeArquivo = `${nomeContrato.replace(/\s+/g, '_')}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`,
      },
    });
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao baixar contrato', detalhe: String(error) }, { status: 500 });
  }
}
