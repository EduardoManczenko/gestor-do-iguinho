import { NextResponse } from 'next/server';
import fs from 'fs';
import {
  getDataDir, setDataDir, getPathsInfo,
  copiarRecursivo, registrarEvento
} from '@/lib/storage';

export async function GET() {
  try {
    return NextResponse.json(getPathsInfo());
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { novoDir } = body as { novoDir?: string };

    if (!novoDir) {
      return NextResponse.json({ erro: 'novoDir é obrigatório' }, { status: 400 });
    }

    const antigoDir = getDataDir();
    if (antigoDir === novoDir) {
      return NextResponse.json({ info: 'Mesma pasta, nada foi alterado', ...getPathsInfo() });
    }

    fs.mkdirSync(novoDir, { recursive: true });

    const { migrados, ignorados } = copiarRecursivo(antigoDir, novoDir);
    setDataDir(novoDir);

    registrarEvento('PASTA_ALTERADA', `Pasta de dados alterada de "${antigoDir}" para "${novoDir}"`, {
      detalhes: { antigoDir, novoDir, migrados: String(migrados), ignorados: String(ignorados) },
    });

    return NextResponse.json({
      sucesso: true,
      migrados,
      ignorados,
      ...getPathsInfo(),
    });
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}
