import { NextResponse } from 'next/server';
import { listarArquivosScanner, SCANNER_DIR } from '@/lib/storage';
import { extrairDadosDocumento, extrairDadosMultiplosDocumentos } from '@/lib/ocr';
import path from 'path';

export async function GET() {
  try {
    const arquivos = listarArquivosScanner();
    return NextResponse.json({ arquivos, diretorio: SCANNER_DIR });
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao listar scanner', detalhe: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Suporte a múltiplos arquivos
    if (body.arquivos && Array.isArray(body.arquivos)) {
      const filePaths = body.arquivos.map((a: string) => path.join(SCANNER_DIR, a));
      const resultado = await extrairDadosMultiplosDocumentos(filePaths);
      return NextResponse.json(resultado);
    }

    // Retrocompatibilidade: um único arquivo
    const { arquivo, absolutePath, debug } = body;
    if (!arquivo && !absolutePath) {
      return NextResponse.json({ erro: 'arquivo ou arquivos é obrigatório' }, { status: 400 });
    }
    const filePath = absolutePath || path.join(SCANNER_DIR, arquivo);
    const resultado = await extrairDadosDocumento(filePath, debug === true);
    return NextResponse.json(resultado);
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao processar documento', detalhe: String(error) }, { status: 500 });
  }
}
