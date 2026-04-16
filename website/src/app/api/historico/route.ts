import { NextResponse } from 'next/server';
import { getHistorico } from '@/lib/storage';

export async function GET() {
  try {
    return NextResponse.json(getHistorico());
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}
