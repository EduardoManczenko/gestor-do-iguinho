import { NextResponse } from 'next/server';
import { lerConfig, salvarConfig } from '@/lib/storage';

export async function GET() {
  try {
    return NextResponse.json(lerConfig());
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const config = salvarConfig(body);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}
