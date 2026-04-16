import { NextResponse } from 'next/server';
import { getPathsInfo } from '@/lib/storage';

export async function GET() {
  try {
    return NextResponse.json(getPathsInfo());
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}
