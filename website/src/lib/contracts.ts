import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { TEMPLATES_DIR } from './storage';
import { DadosCliente, DadosTestemunha } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function dataAtualFormatada(): string {
  return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function formatarDataParaExibicao(dataISO: string): string {
  try {
    if (dataISO.includes('/')) return dataISO; // já formatada
    const d = new Date(dataISO);
    return format(d, 'dd/MM/yyyy');
  } catch {
    return dataISO;
  }
}

export function gerarContratoDOCX(
  templateId: string,
  dadosCliente: Partial<DadosCliente>,
  dadosExtras: Record<string, string>,
  dadosTestemunha?: Partial<DadosTestemunha>
): Buffer {
  const templateFile = path.join(TEMPLATES_DIR, `${templateId}.docx`);

  if (!fs.existsSync(templateFile)) {
    throw new Error(`Template não encontrado: ${templateId}.docx`);
  }

  const content = fs.readFileSync(templateFile, 'binary');
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
    nullGetter() {
      return '';
    },
  });

  // Preparar data atual
  const dataAtual = dadosExtras['DATA_ATUAL']
    ? formatarDataParaExibicao(dadosExtras['DATA_ATUAL'])
    : dataAtualFormatada();

  // Formatar datas nos dados extras
  const extrasFormatados: Record<string, string> = {};
  for (const [k, v] of Object.entries(dadosExtras)) {
    if (k.startsWith('DATA_') && v && v.includes('-') && v.length === 10) {
      extrasFormatados[k] = formatarDataParaExibicao(v);
    } else {
      extrasFormatados[k] = v || '';
    }
  }
  extrasFormatados['DATA_ATUAL'] = dataAtual;

  // Formatar data de nascimento do cliente
  const dadosClienteFormatados: Record<string, string> = {};
  for (const [k, v] of Object.entries(dadosCliente)) {
    if (k === 'DATA_NASCIMENTO_CLIENTE' && v && v.includes('-')) {
      dadosClienteFormatados[k] = formatarDataParaExibicao(v as string);
    } else {
      dadosClienteFormatados[k] = (v as string) || '';
    }
  }

  const dados = {
    ...dadosClienteFormatados,
    ...extrasFormatados,
    ...(dadosTestemunha || {}),
  };

  doc.render(dados);

  const buf = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  return buf as Buffer;
}
