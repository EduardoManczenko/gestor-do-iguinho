import { NextResponse } from 'next/server';
import { getDataDir, registrarEvento } from '@/lib/storage';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const dataDir = getDataDir();

    if (!fs.existsSync(dataDir)) {
      return NextResponse.json({ erro: 'Pasta de dados não encontrada' }, { status: 404 });
    }

    const zip = new AdmZip();
    zip.addLocalFolder(dataDir, 'dados');
    const buffer = zip.toBuffer();

    const filename = `backup_${new Date().toISOString().slice(0, 10)}.zip`;

    registrarEvento('BACKUP_EXPORTADO', `Backup exportado: ${filename}`);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}
