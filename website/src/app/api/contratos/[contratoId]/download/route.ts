import { NextResponse } from 'next/server';
import { buscarCliente, getContratoDOCXPath } from '@/lib/storage';
import fs from 'fs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contratoId: string }> }
) {
  const { contratoId } = await params;

  // Procura o contrato em todos os clientes
  const clientesDir = (await import('@/lib/storage')).getClientesDir();
  const clientes = (await import('@/lib/storage')).getClientes();

  for (const cliente of clientes) {
    const contrato = cliente.contratos?.find((c) => c.id === contratoId);
    if (contrato) {
      const filePath = getContratoDOCXPath(cliente.id, contratoId);
      if (filePath && fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${contrato.nomeArquivo || contratoId + '.docx'}"`,
          },
        });
      }
    }
  }

  return NextResponse.json({ erro: 'Contrato não encontrado' }, { status: 404 });
}
