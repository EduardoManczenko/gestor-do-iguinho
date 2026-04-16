import { NextResponse } from 'next/server';
import { getDataDir, registrarEvento } from '@/lib/storage';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('arquivo') as File | null;

    if (!file) {
      return NextResponse.json({ erro: 'Arquivo ZIP não enviado' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);
    const dataDir = getDataDir();

    fs.mkdirSync(dataDir, { recursive: true });

    // Extrair somente a pasta 'dados/' do ZIP
    const entries = zip.getEntries();
    let restaurados = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let entryName = entry.entryName;
      // Remove prefixo 'dados/' se existir
      if (entryName.startsWith('dados/')) {
        entryName = entryName.slice('dados/'.length);
      }

      const destPath = path.join(dataDir, entryName);
      const destDir = path.dirname(destPath);
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
      restaurados++;
    }

    registrarEvento('BACKUP_IMPORTADO', `Backup importado: ${file.name} (${restaurados} arquivos)`);

    return NextResponse.json({ sucesso: true, restaurados });
  } catch (error) {
    return NextResponse.json({ erro: String(error) }, { status: 500 });
  }
}
