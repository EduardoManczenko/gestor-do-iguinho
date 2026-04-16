import { NextResponse } from 'next/server';
import { listarArquivosScanner, getScannerDir } from '@/lib/storage';
import { extrairDadosDocumento } from '@/lib/ocr';
import path from 'path';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pasta = searchParams.get('pasta') || getScannerDir();
    const arquivos = listarArquivosScanner(pasta);
    return NextResponse.json({ arquivos, diretorio: pasta });
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao listar scanner', detalhe: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pastaScanner = body.pastaScanner || getScannerDir();
    const { arquivo, debug } = body;

    if (!arquivo) {
      return NextResponse.json({ erro: 'arquivo é obrigatório' }, { status: 400 });
    }

    const filePath = path.join(pastaScanner, arquivo);
    const resultado = await extrairDadosDocumento(filePath, debug === true);
    return NextResponse.json(resultado);
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao processar documento', detalhe: String(error) },
      { status: 500 }
    );
  }
}
