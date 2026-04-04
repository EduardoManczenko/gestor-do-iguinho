import { NextResponse } from 'next/server';
import { listarTemplates } from '@/lib/templates';

export async function GET() {
  try {
    const templates = listarTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao listar templates', detalhe: String(error) }, { status: 500 });
  }
}
