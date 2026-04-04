import fs from 'fs';
import os from 'os';
import path from 'path';
import { DadosCliente, PessoaCertidao, ResultadoExtracao } from './types';

// ─── Utilidades de texto ───────────────────────────────────────────────────

function normalizarTexto(t: string): string {
  return t.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ').trim();
}

// Remove linhas de ruído OCR (bordas, padrões de segurança)
function limparTextoOCR(texto: string): string {
  const linhas = texto.split('\n');
  return linhas
    .map(l => l.replace(/[|\\\/]{2,}/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(l => {
      if (l.length < 3) return false;
      // Sempre preservar linhas com dados numéricos estruturados:
      // — datas DD/MM/YYYY (ex: "ii 19/06/1966")
      if (/\d{2}\/\d{2}\/\d{4}/.test(l)) return true;
      // — CPF com pontos/traço (ex: "013.326.879-97")
      if (/\d{3}[\.\,\s]\d{3}[\.\,\s]\d{3}[\-\/\s]\d{2}/.test(l)) return true;
      // — sequências longas de dígitos — registros, RENACH, etc. (≥8 dígitos contíguos)
      if (/\b\d{8,}\b/.test(l)) return true;
      const letras = (l.match(/[a-záéíóúàèìòùãõâêîôûçA-ZÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÇ]/g) || []).length;
      return letras / l.replace(/\s/g, '').length > 0.28;
    })
    .join('\n');
}

// Converter data por extenso: "19 de junho de 1966" → "19/06/1966"
const MESES: Record<string, string> = {
  janeiro:'01', fevereiro:'02', março:'03', marco:'03', abril:'04',
  maio:'05', junho:'06', julho:'07', agosto:'08', setembro:'09',
  outubro:'10', novembro:'11', dezembro:'12',
};
function converterDataExtenso(texto: string): string | null {
  const m = texto.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (m) {
    const mes = MESES[m[2].toLowerCase()];
    if (mes) return `${m[1].padStart(2,'0')}/${mes}/${m[3]}`;
  }
  // "VINTE E UM DE FEVEREIRO DE DOIS MIL E SETE" — forma numerológica
  const numerais: Record<string, number> = {
    um:1, dois:2, tres:3, três:3, quatro:4, cinco:5, seis:6, sete:7, oito:8, nove:9,
    dez:10, onze:11, doze:12, treze:13, quatorze:14, quinze:15, dezesseis:16,
    dezessete:17, dezoito:18, dezenove:19, vinte:20, 'vinte e um':21, 'vinte e dois':22,
    'vinte e três':23, 'vinte e quatro':24, 'vinte e cinco':25, 'vinte e seis':26,
    'vinte e sete':27, 'vinte e oito':28, 'vinte e nove':29, trinta:30, 'trinta e um':31,
  };
  const mNumerais: Record<string, string> = {
    'dois mil e sete':'2007','dois mil e oito':'2008','dois mil e nove':'2009',
    'dois mil e dez':'2010','dois mil e onze':'2011','dois mil e doze':'2012',
    'dois mil e treze':'2013','dois mil e quatorze':'2014','dois mil e quinze':'2015',
    'dois mil e dezesseis':'2016','dois mil e dezessete':'2017','dois mil e dezoito':'2018',
    'dois mil e dezenove':'2019','dois mil e vinte':'2020','dois mil e vinte e um':'2021',
    'dois mil e vinte e dois':'2022','dois mil e vinte e três':'2023',
    'dois mil e vinte e quatro':'2024','dois mil e vinte e cinco':'2025',
    'dois mil e vinte e seis':'2026',
  };
  const t2 = texto.toLowerCase();
  for (const [nAno, ano] of Object.entries(mNumerais)) {
    for (const [nMes, mes] of Object.entries(MESES)) {
      for (const [nDia, dia] of Object.entries(numerais)) {
        if (t2.includes(nDia) && t2.includes(nMes) && t2.includes(nAno)) {
          return `${String(dia).padStart(2,'0')}/${mes}/${ano}`;
        }
      }
    }
  }
  return null;
}

function extrairDataNumerica(texto: string, contextos: string[] = []): string | null {
  let busca = texto;
  if (contextos.length > 0) {
    for (const ctx of contextos) {
      const idx = texto.toLowerCase().indexOf(ctx.toLowerCase());
      if (idx >= 0) { busca = texto.substring(idx, idx + 300); break; }
    }
  }
  const m = busca.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : null;
}

function extrairCPF(texto: string): string | null {
  // Padrão 1: formato padrão com pontos e traço (com tolerância a espaços e OCR noise)
  const padrao1 = /\b(\d{3})\s*[\.\,]\s*(\d{3})\s*[\.\,]\s*(\d{3})\s*[\-\/]\s*(\d{2})\b/g;
  // Padrão 2: apenas dígitos (pode ter espaços entre grupos por ruído OCR)
  const padrao2 = /\bCPF\s*[:\-]?\s*(\d[\d\s]{9,14}\d)\b/i;
  // Padrão 3: 11 dígitos contíguos
  const padrao3 = /\b(\d{3})[\.\s]?(\d{3})[\.\s]?(\d{3})[\-\s]?(\d{2})\b/g;

  // Tenta padrão 1 (mais preciso)
  let m: RegExpExecArray | null;
  padrao1.lastIndex = 0;
  while ((m = padrao1.exec(texto)) !== null) {
    const d = `${m[1]}${m[2]}${m[3]}${m[4]}`;
    if (d.length === 11 && !/^(\d)\1{10}$/.test(d)) {
      return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    }
  }

  // Tenta padrão 2 (após "CPF:")
  const m2 = padrao2.exec(texto);
  if (m2) {
    const d = m2[1].replace(/\s/g, '');
    if (d.length === 11 && !/^(\d)\1{10}$/.test(d)) {
      return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    }
  }

  // Tenta padrão 3 (fallback tolerante)
  padrao3.lastIndex = 0;
  while ((m = padrao3.exec(texto)) !== null) {
    const d = `${m[1]}${m[2]}${m[3]}${m[4]}`;
    if (d.length === 11 && !/^(\d)\1{10}$/.test(d)) {
      return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    }
  }

  return null;
}

function extrairCEP(texto: string): string | null {
  const m = texto.match(/\bCEP[:\s]+(\d{5})[\-\s]?(\d{3})\b/i)
    || texto.match(/\b(\d{5})[\-](\d{3})\b/);
  if (m) return m[1] ? `${m[1]}-${m[2]}` : null;
  return null;
}

function extrairTelefone(texto: string): string | null {
  const m = texto.match(/\(?\d{2}\)?[\s\-]?9?\d{4}[\s\-]\d{4}/);
  return m ? m[0].trim() : null;
}

function validarNome(nome: string): boolean {
  if (!nome || nome.trim().length < 5) return false;
  // Rejeitar frases conhecidas que não são nomes
  const frases = ['nao mudou seu nome', 'não mudou seu nome', 'expedida pelo', 'separacao legal',
    'registro civil', 'republica federativa', 'dados pessoais', 'sem informacao'];
  const lower = nome.toLowerCase().trim();
  if (frases.some(f => lower.includes(f))) return false;
  const palavras = lower.split(/\s+/).filter(p => p.length > 1);
  if (palavras.length < 2) return false;
  for (const p of palavras) {
    if (p.length <= 2) continue;
    const vogais = (p.match(/[aeiouáéíóúãõâêîôûàèìòùy]/g) || []).length;
    if (p.length > 3 && vogais === 0) return false;
    if (p.length > 4 && vogais / p.length < 0.15) return false;
  }
  if (/\d/.test(nome)) return false;
  return true;
}

function limparNome(nome: string): string {
  return nome.replace(/\s*,.*$/, '').replace(/[^a-záéíóúàèìòùãõâêîôûçA-ZÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÇ\s]/g, '').trim().toUpperCase();
}

// Junta fragmentos de 2 letras que o OCR dividiu incorretamente em nomes CAIXA ALTA.
// Ex: "AGO ME DUNJANIN" → "AGO MEDUNJANIN"  (ME=2 letras, não é partícula → une com DUNJANIN)
// Ex: "JOSE DA SILVA"   → "JOSE DA SILVA"   (DA é partícula → mantém)
// Ex: "AGO MEDUNJANIN"  → "AGO MEDUNJANIN"  (AGO=3 letras → não une, pois pode ser nome próprio)
function juntarFragmentosOCR(nome: string): string {
  const PARTICULAS = /^(DE|DA|DO|DOS|DAS|DI|DU|E|Y|EL|AL|VAN|VON|O|A|OS|AS|EM|EN|LE|LA|LOS|LAS)$/i;
  // Só une fragmentos de EXATAMENTE 2 letras (não 3, pois 3 letras pode ser nome próprio como AGO)
  return nome.replace(
    /\b([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2})\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{3,})\b/g,
    (match, w1, w2) => PARTICULAS.test(w1) ? match : w1 + w2
  );
}

// ─── Preprocessamento de imagem ───────────────────────────────────────────

async function preprocessarAdaptativo(jpegBuffer: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    // Threshold 120: melhor para CNH (revela CPF, N° registro e data de nascimento claramente)
    // Thresholds mais altos (130+) tendem a garble números com pontos/traços na CNH
    return await sharp(jpegBuffer).grayscale().threshold(120).png().toBuffer();
  } catch {
    return jpegBuffer;
  }
}

async function preprocessarNormalize(jpegBuffer: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(jpegBuffer).grayscale().normalize().sharpen({ sigma: 1.5 }).png().toBuffer();
  } catch {
    return jpegBuffer;
  }
}

// ─── OCR via Tesseract ─────────────────────────────────────────────────────

async function ocrBuffer(imageBuffer: Buffer, tmpSuffix = ''): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const workerPath = path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
  const tmpPath = path.join(os.tmpdir(), `ocr_${Date.now()}${tmpSuffix}.png`);
  fs.writeFileSync(tmpPath, imageBuffer);
  const worker = await createWorker('por', 1, { workerPath });
  try {
    const { data: { text } } = await worker.recognize(tmpPath);
    return normalizarTexto(text);
  } finally {
    await worker.terminate();
    try { fs.unlinkSync(tmpPath); } catch { /* ok */ }
  }
}

// Roda OCR nos dois modos e retorna ambos concatenados (melhor cobertura)
async function ocrDuplo(jpegBuffer: Buffer): Promise<string> {
  const [binBuf, normBuf] = await Promise.all([
    preprocessarAdaptativo(jpegBuffer),
    preprocessarNormalize(jpegBuffer),
  ]);
  const [textBin, textNorm] = await Promise.all([
    ocrBuffer(binBuf, '_bin'),
    ocrBuffer(normBuf, '_norm'),
  ]);
  // normalize geralmente tem texto mais limpo para docs claros; bin funciona melhor para CNH
  // retorna ambos concatenados para que os regex possam encontrar padrões em qualquer versão
  return textNorm + '\n\n' + textBin;
}

// Verifica se o texto extraído tem dados úteis (não apenas cabeçalhos)
function textoTemDadosUteis(texto: string): boolean {
  if (texto.length < 80) return false;
  const linhasUteis = texto.split('\n').filter(l => l.trim().length > 10 && /[a-zA-ZÀ-ú]{4,}/.test(l));
  if (linhasUteis.length < 4) return false;
  // Verificar se não é apenas cabeçalho de app digital (gov.br, QR Code, etc.)
  const isAppHeader = /QR Code|aplicativo.*gov|autenticidade da Carteira|assinatura eletrônica/i.test(texto);
  if (isAppHeader && !/CPF|nascimento|naturalidade/i.test(texto)) return false;
  return true;
}

// ─── Extração de JPEG do PDF ──────────────────────────────────────────────

function extrairJPEGsDoPDF(buffer: Buffer): Buffer[] {
  const results: Buffer[] = [];
  let pos = 0;
  while (pos < buffer.length - 3) {
    if (buffer[pos] === 0xFF && buffer[pos+1] === 0xD8 && buffer[pos+2] === 0xFF) {
      let end = -1;
      for (let i = buffer.length - 2; i > pos; i--) {
        if (buffer[i] === 0xFF && buffer[i+1] === 0xD9) { end = i + 2; break; }
      }
      if (end > pos) {
        results.push(buffer.slice(pos, end));
        pos = end;
      } else break;
    } else pos++;
  }
  return results;
}

// ─── Extractores por tipo de documento ───────────────────────────────────

function detectarTipo(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes('declaração de residência') || t.includes('declaracao de residencia')) return 'DECLARAÇÃO DE RESIDÊNCIA';
  if (t.includes('certidão de casamento') || t.includes('certidao de casamento') || (t.includes('certidão') && t.includes('casamento'))) return 'CERTIDÃO DE CASAMENTO';
  if (t.includes('certidão de nascimento') || t.includes('certidao de nascimento') || (t.includes('certidão') && t.includes('nascimento'))) return 'CERTIDÃO DE NASCIMENTO';
  // CNH: detectar ANTES de comprovante (background da CNH pode gerar noise como "saae")
  if (t.includes('carteira nacional') || t.includes('driver license') || t.includes('permiso de conducción') || t.includes('permiso de conduccion') || (t.includes('habilitação') && t.includes('detran'))) return 'CNH';
  // RG: detectar ANTES de comprovante (background de RG pode conter "saae" como ruído OCR)
  if (t.includes('carteira de identidade') || (t.includes('registro geral') && (t.includes('cpf') || t.includes('personal')))) return 'RG';
  if (t.includes('carteira de trabalho') || t.includes('ctps')) return 'CARTEIRA DE TRABALHO';
  if (t.includes('passaporte') || t.includes('passport')) return 'PASSAPORTE';
  if (t.includes('celesc') || t.includes('cemig') || t.includes('copel') || t.includes('cpfl') || t.includes('enel') || t.includes('coelba') || t.includes('kwh') || t.includes('danf3e') || (t.includes('nota fiscal') && t.includes('energia'))) return 'COMPROVANTE DE ENERGIA';
  if (t.includes('comprovante de residência') || t.includes('conta de água') || t.includes('sabesp') || t.includes('saae')) return 'COMPROVANTE DE RESIDÊNCIA';
  return 'DOCUMENTO';
}

// Certidão de Casamento — extrai AMBAS as pessoas
function extrairCertidaoCasamento(texto: string): { dados: Partial<DadosCliente>; pessoasCertidao: PessoaCertidao[] } {
  const pessoasCertidao: PessoaCertidao[] = [];

  // Flatten agressivo: remover pipes, símbolos de ruído e quebras de linha
  const textoUnico = texto
    .replace(/[|>é<\=\[\]!]/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ');

  // Padrão: "Ele: NOME, natural de X, nascido em DATA, de nacionalidade Y, filho de PAI e MAE."
  //          "Ela: NOME, natural de X, nascida em DATA, de nacionalidade Y, filha de PAI e MAE."
  const padraoPessoa = /(?:Ele:|Ela[;:])\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\,\.]{3,60}),\s*natural de\s+([^\,]+),\s*nascid[oa]\s+em\s+(\d+\s+de\s+\w+\s+de\s+\d{4})[^,]*,\s*de\s+nacionalidade\s+([^\,]+),\s*filh[oa]\s+de\s+(.+?)\s+e\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\.x]{3,60})/gi;

  let m;
  while ((m = padraoPessoa.exec(textoUnico)) !== null) {
    const papel = m[0].toLowerCase().startsWith('ele') ? 'ele' : 'ela';
    // Limpar ruído OCR dos campos capturados
    const limparCampo = (s: string) => s.trim().replace(/^[^A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]+/, '').replace(/\s+/g, ' ').toUpperCase();
    const pessoa: PessoaCertidao = {
      papel,
      nome: limparNome(m[1]),
      naturalidade: limparCampo(m[2]),
      dataNascimento: converterDataExtenso(m[3]) || m[3],
      nacionalidade: limparCampo(m[4]).replace(/^[Éé]\s+[A-Za-z]\s+/, ''), // remove ruído OCR "É f "
      nomePai: limparCampo(m[5]).replace(/^[^A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]+/, ''),
      nomeMae: limparNome(m[6]),
    };
    if (validarNome(pessoa.nome)) pessoasCertidao.push(pessoa);
  }

  // Fallback: busca linear por padrão mais simples
  if (pessoasCertidao.length === 0) {
    const linhas = textoUnico.split('.');
    for (const linha of linhas) {
      const m2 = linha.match(/([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇa-záéíóúãõâêîôûàèìòùç\s]{8,50}),\s*natural de\s+([^\,]+),\s*nascid[oa]\s+em\s+(\d+\s+de\s+\w+)/i);
      if (m2 && validarNome(m2[1])) {
        pessoasCertidao.push({ papel: pessoasCertidao.length === 0 ? 'ele' : 'ela', nome: limparNome(m2[1]), naturalidade: m2[2].trim().toUpperCase(), dataNascimento: converterDataExtenso(m2[3]) || m2[3] });
      }
    }
  }

  // Dados primários = primeira pessoa encontrada
  const dados: Partial<DadosCliente> = {};
  if (pessoasCertidao.length > 0) {
    const p = pessoasCertidao[0];
    dados.NOME_CLIENTE = p.nome;
    dados.NATURALIDADE_CLIENTE = p.naturalidade;
    dados.DATA_NASCIMENTO_CLIENTE = p.dataNascimento;
    dados.NACIONALIDADE_CLIENTE = p.nacionalidade;
    dados.NOME_PAI_CLIENTE = p.nomePai;
    dados.NOME_MAE_CLIENTE = p.nomeMae;
    dados.ESTADO_CIVIL_CLIENTE = 'CASADO(A)';
  }
  dados.CPF_CLIENTE = extrairCPF(texto) || undefined;

  return { dados, pessoasCertidao };
}

// Certidão de Nascimento
function extrairCertidaoNascimento(texto: string): Partial<DadosCliente> {
  const dados: Partial<DadosCliente> = {};

  // Nome: aparece após "NOME" em linha própria (aceita ruído antes do nome)
  const blocoNome = texto.match(/NOME\s*[^\n]*\n\s*[^A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ\s]{5,60})/i);
  if (blocoNome && validarNome(blocoNome[1])) dados.NOME_CLIENTE = limparNome(blocoNome[1]);

  // Data por extenso — busca em toda a área de nascimento
  const blocoData = texto.match(/DATA DE NASCIMENTO[^\n]{0,20}\n([^\n]+(?:\n[^\n]+){0,3})/i);
  if (blocoData) {
    const dt = converterDataExtenso(blocoData[1]);
    if (dt) dados.DATA_NASCIMENTO_CLIENTE = dt;
  }
  // Fallback numérico: "| 21 | [ 02 ] [ 2007 ]" ou "| 21 | | 02 | | 2007 |"
  if (!dados.DATA_NASCIMENTO_CLIENTE) {
    const dm = texto.match(/\|\s*(\d{2})\s*\|\s*[\[\|]\s*(\d{2})\s*[\]\|]\s*[\[\|]\s*(\d{4})\s*[\]\|]/);
    if (dm) dados.DATA_NASCIMENTO_CLIENTE = `${dm[1]}/${dm[2]}/${dm[3]}`;
  }
  if (!dados.DATA_NASCIMENTO_CLIENTE) {
    const dm2 = texto.match(/\b(\d{2})\s*\|\s*(\d{2})\s*\|\s*(\d{4})\b/);
    if (dm2) dados.DATA_NASCIMENTO_CLIENTE = `${dm2[1]}/${dm2[2]}/${dm2[3]}`;
  }

  // Naturalidade: aparece no bloco de hora de nascimento "| 17:50 | | MAGÉ - RJ |"
  const natM = texto.match(/HORA DE NASCIMENTO[^\n]*\n[^\n]*\|\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n|]{2,30})\s*\|/i)
    || texto.match(/NATURALIDADE\s*\n\s*\|\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n|]{2,30})\s*\|/i);
  if (natM) dados.NATURALIDADE_CLIENTE = natM[1].trim().toUpperCase();

  // Filiação: múltiplas estratégias (texto original não limpo para preservar letras minúsculas)
  const textoFlat = texto.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');

  // Padrão 1 (mais preciso): "NOME_PAI, NATURAL DE X E NOME_MÃE" (certidão de nascimento ARPEN)
  // Ex: "PAULO ROGERIO DE SOUZA, NATURAL DO RIO DE JANEIRO-RJ E CLEDIANE CORRÊA BASILIO, NATURAL..."
  // Usa \bE\b para a conjunção "E" (não casa "DE", "JANEIRO", etc.)
  const filM1 = textoFlat.match(
    /FILIA[ÇC][ÃA]O\s*[:\-]?\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^,]{4,60}),\s*(?:NATURAL\b[^,]{0,80}?)?\s*\bE\b\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^,\.]{4,60}?)(?:,\s*NATURAL|\s*RESIDENT|$)/i
  );

  // Padrão 2: "filho(a) de PAI e MÃE"
  const filM2 = textoFlat.match(/filh[oa]\s+de\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^,]{5,60})\s+e\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^,\.]{5,60})/i);

  // Padrão 3: separados por "|" após FILIAÇÃO
  const filM3 = textoFlat.match(/FILIA[ÇC][ÃA]O[^|]*\|\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^|]{5,50})\s*\|\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^|]{5,50})\s*\|/i);

  // Padrão 4: labels "PAI:" e "MÃE:"
  const paiM = texto.match(/\bPAI\b[:\s|]*\n?\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n|]{5,50})/i);
  const maeM = texto.match(/\bM[ÃA]E\b[:\s|]*\n?\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n|]{5,50})/i);

  const filM = filM1 || filM2 || filM3;
  if (filM) {
    const nomePai = filM[1].replace(/[,\s]*NATURAL[^,]*/i, '').replace(/^\W+/, '').trim().replace(/\s*\|.*$/, '');
    const nomeMae = filM[2].replace(/[,\s]*NATURAL[^,]*/i, '').replace(/^\W+/, '').trim().replace(/\s*\|.*$/, '').replace(/,.*$/, '');
    if (validarNome(nomePai)) dados.NOME_PAI_CLIENTE = limparNome(nomePai);
    if (validarNome(nomeMae)) dados.NOME_MAE_CLIENTE = limparNome(nomeMae);
  }
  if (!dados.NOME_PAI_CLIENTE && paiM && validarNome(paiM[1])) dados.NOME_PAI_CLIENTE = limparNome(paiM[1]);
  if (!dados.NOME_MAE_CLIENTE && maeM && validarNome(maeM[1])) dados.NOME_MAE_CLIENTE = limparNome(maeM[1]);

  dados.CPF_CLIENTE = extrairCPF(texto) || undefined;
  dados.NACIONALIDADE_CLIENTE = 'BRASILEIRO(A)';

  return dados;
}

// CNH — funciona bem com preprocessamento binarize
function extrairCNH(texto: string): Partial<DadosCliente> {
  const dados: Partial<DadosCliente> = {};

  const RUIDO_CNH = new Set([
    'CARTEIRA','HABILITAÇÃO','NACIONAL','BRASIL','MINISTÉRIO','SECRETARIA',
    'DRIVER','LICENSE','REPÚBLICA','FEDERATIVA','TRÂNSITO','PERMISO',
    'CONDUCCIÓN','CONDUCCION','NOME','SOBRENOME','FILIAÇÃO','PERO','LOCAL',
    'DATA','NASCIMENTO','VALIDADE','REGISTRO','CATEGORIA','RENACH','ACC',
  ]);

  // Limpar nome de ruído de prefixo OCR (ex: "PERO AMIR MEDUNJANIN" → "AMIR MEDUNJANIN")
  function limparNomeCNH(nome: string): string {
    const palavras = nome.trim().split(/\s+/);
    // Remover palavras conhecidas como ruído da frente
    while (palavras.length > 2 && RUIDO_CNH.has(palavras[0].toUpperCase())) palavras.shift();
    // Remover primeira palavra se for ≤4 letras e o resto ainda for nome válido
    if (palavras.length > 2 && palavras[0].length <= 4) {
      const semPrimeira = palavras.slice(1).join(' ');
      if (validarNome(semPrimeira)) return limparNome(semPrimeira);
    }
    return limparNome(palavras.join(' '));
  }

  // Nome: padrão após "NOME SOBRENOME" ou "NOME" header
  const nomeHeader = texto.match(/NOME\s*SOBRENOME?\s*[^\n]*\n+\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n,]{5,50})/i)
    || texto.match(/NOME\s*[^\n]*\n\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][A-Za-záéíóúãõâêîôûàèìòùçA-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ\s]{5,40})\s*(?:\n|\d)/i);
  if (nomeHeader && validarNome(nomeHeader[1])) dados.NOME_CLIENTE = limparNomeCNH(nomeHeader[1]);

  // Nome: padrão NOME + DATA imediatamente antes da data de nascimento
  if (!dados.NOME_CLIENTE) {
    const nomeDataM = texto.match(/([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2,}(?:\s+[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2,})+)\s+\d{2}\/\d{2}\/\d{4}/);
    if (nomeDataM) {
      const palavras = nomeDataM[1].trim().split(/\s+/).filter(p => !RUIDO_CNH.has(p.toUpperCase()));
      const nomeCandidato = palavras.join(' ');
      if (validarNome(nomeCandidato)) dados.NOME_CLIENTE = limparNomeCNH(nomeCandidato);
    }
  }

  // CPF — busca com tolerância a ruído OCR
  dados.CPF_CLIENTE = extrairCPF(texto) || undefined;

  // ── Data de nascimento na CNH ──────────────────────────────────────────
  // Layout real observado no OCR (threshold 120):
  //   "AMIR MEDUNJANIN 16/11/2015"   ← nome + 1ª habilitação (mesma linha)
  //   linhas com noise sem data
  //   "ii 19/06/1966"                ← data de nascimento: linha com APENAS data + ruído curto
  //
  // Estratégia: coletar todas as datas por linha.
  // Datas em linhas COM nome (caps ≥5 letras) = habilitação/validade → excluir
  // Datas em linhas SEM nome, passadas, ano 1900-2010 = candidatas a nascimento

  {
    const toTs = (d: string) => { const p = d.split('/'); return new Date(+p[2], +p[1]-1, +p[0]).getTime(); };
    const hoje = Date.now();
    const linhas = texto.split('\n');

    // Padrão 1: label explícito "DATA DE NASCIMENTO" ou "NASCIMENTO:"
    const labelNasc =
      texto.match(/DATA\s*D[EO]\s*NASC[^\n]{0,30}?(\d{2}\/\d{2}\/\d{4})/i) ||
      texto.match(/NASC(?:IMENTO)?\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i);

    if (labelNasc) {
      dados.DATA_NASCIMENTO_CLIENTE = labelNasc[1];
    } else {
      // Padrão 2: data sozinha em linha sem nome em caps
      const candidatas: string[] = [];
      for (const linha of linhas) {
        const datas = [...linha.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)].map(m => m[1]);
        if (datas.length === 0) continue;
        // Se a linha tem sequência de caps com ≥5 letras, é linha de nome/label → pular
        if (/[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{5,}/.test(linha)) continue;
        for (const d of datas) {
          const ts = toTs(d);
          const ano = +d.split('/')[2];
          if (ts < hoje && ano >= 1900 && ano <= 2010) candidatas.push(d);
        }
      }
      if (candidatas.length > 0) {
        candidatas.sort((a, b) => toTs(a) - toTs(b));
        dados.DATA_NASCIMENTO_CLIENTE = candidatas[0];
      }
      // Se nada encontrou, deixa vazio — melhor vazio do que data errada
    }
  }

  // ── N° Registro da CNH (11 dígitos contíguos, campo ao lado do CPF) ─
  {
    const cpfDigitos = dados.CPF_CLIENTE?.replace(/\D/g, '') || '';
    const todosOnze = texto.match(/\b(\d{11})\b/g) || [];
    const candidato = todosOnze.find(n => n !== cpfDigitos);
    if (candidato) dados.DOCUMENTO_NUMERO_CLIENTE = candidato;
  }

  // ── Filiação da CNH ───────────────────────────────────────────────────
  // A filiação aparece DEPOIS do label "FILIAÇÃO" (pode estar garbled: FIVAÇÃO, FLIAÇÃO, etc.)
  // Layout OCR: "... FIVAÇÃO ... AGO ME DUNJANIN\nSAVICA ME DUNJANIN"
  // NUNCA usa busca global no documento (background da CNH tem texto noise parecido com nomes)
  {
    // Localizar seção FILIAÇÃO pelo label (aceita variações de OCR noise)
    const filIdx = texto.search(/FIL?[IV][AÃ][ÇC][AÃ]O|FILIA[ÇC][ÃA]O|FIVA[ÇC][ÃA]O|FILI\w{0,4}O/i);
    if (filIdx >= 0) {
      // Pega texto a partir do label, ignora o próprio label
      const textoAposFil = texto.substring(filIdx).replace(/^[^\n]*\n?/, '');
      // Considera a linha do label e as 3 seguintes
      const linhasRegiao = texto.substring(filIdx).split('\n').slice(0, 5);

      // Extrai nomes da linha do label e das seguintes
      const nomesEncontrados: string[] = [];
      for (const linha of linhasRegiao) {
        // Remove o label de filiação da linha
        const semLabel = linha.replace(/FIL?[IV][AÃ][ÇC][AÃ]O\w*/gi, '');
        // Na linha do label, o nome vem no FINAL (após noise de separador)
        // Pega o último trecho que parece um nome: ≥3 letras caps + palavras adicionais
        const ultimoNomeM = semLabel.match(
          /([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{3,}(?:\s+[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2,}){1,5})\s*$/
        );
        if (ultimoNomeM && validarNome(ultimoNomeM[1])) {
          nomesEncontrados.push(juntarFragmentosOCR(limparNome(ultimoNomeM[1])));
          continue;
        }
        // Para linhas sem o label, pega o trecho de caps removendo noise do início
        const candidatoRaw = semLabel
          .replace(/^[^A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]+/, '')
          .replace(/[^A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇA-Za-záéíóúãõâêîôûàèìòùç\s]/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        if (candidatoRaw.length > 4 && validarNome(candidatoRaw)) {
          nomesEncontrados.push(juntarFragmentosOCR(limparNome(candidatoRaw)));
        }
      }

      if (nomesEncontrados.length >= 1) dados.NOME_PAI_CLIENTE = nomesEncontrados[0];
      if (nomesEncontrados.length >= 2) dados.NOME_MAE_CLIENTE = nomesEncontrados[1];
    }

    // Fallback com delimitadores [] ou ! (formato do OCR normalize)
    if (!dados.NOME_PAI_CLIENTE) {
      const filM = texto.match(/[\[!]\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\[\]!|]{5,50})\s*[\]!]/g);
      if (filM && filM.length >= 2) {
        const p1 = filM[0].replace(/[\[\]!]/g, '').trim();
        const p2 = filM[1].replace(/[\[\]!]/g, '').trim();
        if (validarNome(p1)) dados.NOME_PAI_CLIENTE = limparNome(p1);
        if (validarNome(p2)) dados.NOME_MAE_CLIENTE = limparNome(p2);
      }
    }
  }

  // Nacionalidade
  if (/estrangeiro/i.test(texto)) dados.NACIONALIDADE_CLIENTE = 'ESTRANGEIRO(A)';
  else dados.NACIONALIDADE_CLIENTE = 'BRASILEIRO(A)';

  // Estado (UF) como naturalidade
  const ufM = texto.match(/(?:SANTA CATARINA|SÃO PAULO|RIO DE JANEIRO|MINAS GERAIS|PARANÁ|BAHIA|GOIÁS|PERNAMBUCO|CEARÁ|MARANHÃO|PARÁ|AMAZONAS|MATO GROSSO(?:\s+DO\s+SUL)?|RIO GRANDE DO SUL|ESPÍRITO SANTO|PIAUÍ|ALAGOAS|SERGIPE|RIO GRANDE DO NORTE|PARAÍBA|TOCANTINS|RORAIMA|RONDÔNIA|ACRE|AMAPÁ|DISTRITO FEDERAL)/i);
  if (ufM) dados.NATURALIDADE_CLIENTE = ufM[0].toUpperCase();

  // Documento
  dados.DOCUMENTO_TIPO_CLIENTE = 'CNH';
  dados.DOCUMENTO_ORGAO_CLIENTE = 'DETRAN';

  return dados;
}

// RG (Carteira de Identidade — físico e digital gov.br)
// Mapa: nome do estado → sigla UF (para o campo DOCUMENTO_ORGAO_CLIENTE do RG)
const ESTADOS_UF: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amapa': 'AP', 'amazonas': 'AM',
  'bahia': 'BA', 'ceará': 'CE', 'ceara': 'CE', 'distrito federal': 'DF',
  'espírito santo': 'ES', 'espirito santo': 'ES', 'goiás': 'GO', 'goias': 'GO',
  'maranhão': 'MA', 'maranhao': 'MA', 'mato grosso do sul': 'MS', 'mato grosso': 'MT',
  'minas gerais': 'MG', 'pará': 'PA', 'para': 'PA', 'paraíba': 'PB', 'paraiba': 'PB',
  'paraná': 'PR', 'parana': 'PR', 'pernambuco': 'PE', 'piauí': 'PI', 'piaui': 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  'rondônia': 'RO', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
  'são paulo': 'SP', 'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO',
};

function ufDoEstado(nome: string): string {
  // Limpa ruído OCR: mantém apenas letras e espaços, normaliza
  const n = nome.toLowerCase().replace(/[^a-záéíóúàèìòùãõâêîôûç\s]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // Busca exata
  if (ESTADOS_UF[n]) return ESTADOS_UF[n];
  // Busca parcial: nome da captura pode ter ruído após o estado
  for (const [estado, uf] of Object.entries(ESTADOS_UF)) {
    if (n.startsWith(estado)) return uf;
  }
  // Último recurso: primeiras 2 letras
  return n.substring(0, 2).toUpperCase();
}

function extrairCarteiraTrabalho(texto: string): Partial<DadosCliente> {
  const dados: Partial<DadosCliente> = {};

  // ── CTPS Digital: layout com duas colunas embaralhadas pelo OCR ────────────
  // O texto nativo do PDF é extraído em ordem de coluna, por isso:
  //   "Nome civil\nCPF\nCHRISTYANY ALVES SETUBAL\n100.533.029-82"
  // e para a mãe:
  //   "MARILENE TAVARES\nNome da mãe"  ← valor ANTES do label
  //
  // Estratégia: buscar linhas com all-caps de 8+ chars (nomes) em contexto próximo

  // Palavras que parecem nome mas são labels/abreviações — a ignorar no início do nome
  const NAO_NOME_CTPS = /^(CPF|RG|PIS|NIS|CNPJ|SEXO|CARGO|UF|CEP|BR|CTPS)\b/i;

  // Nome civil — pode estar 1-3 linhas após "Nome civil" por causa das colunas
  const nomeCivilArea = texto.match(/Nome civil\n((?:[^\n]+\n){0,4})/i);
  if (nomeCivilArea) {
    const linhas = nomeCivilArea[1].split('\n');
    for (const linha of linhas) {
      const l = linha.trim();
      if (NAO_NOME_CTPS.test(l)) continue; // pula labels
      // Verifica se a linha tem padrão de nome: 2+ palavras em maiúsculas ≥2 chars
      const nomeM = l.match(/^([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2,}(?:\s+[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2,}){1,5})$/);
      if (nomeM && validarNome(nomeM[1])) { dados.NOME_CLIENTE = limparNome(nomeM[1]); break; }
    }
  }
  // Fallback para CTPS físico/antigo: "Nome: FULANO"
  if (!dados.NOME_CLIENTE) {
    const nomeM2 = texto.match(/Nome:\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{5,60})/i);
    if (nomeM2 && validarNome(nomeM2[1])) dados.NOME_CLIENTE = limparNome(nomeM2[1]);
  }

  // CPF
  dados.CPF_CLIENTE = extrairCPF(texto) || undefined;

  // Data nascimento
  const dataN = texto.match(/Data de nascimento\s*\n\s*(\d{2}\/\d{2}\/\d{4})/i)
    || texto.match(/Nascimento[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
  if (dataN) dados.DATA_NASCIMENTO_CLIENTE = dataN[1];

  // Nacionalidade (linha após "Nacionalidade")
  const nacM = texto.match(/Nacionalidade\s*\n\s*([^\n]{4,30})/i);
  if (nacM) {
    const n = nacM[1].trim().toLowerCase();
    if (n.includes('brasil') || n === 'brasileira' || n === 'brasileiro') {
      dados.NACIONALIDADE_CLIENTE = 'BRASILEIRO(A)';
    } else {
      dados.NACIONALIDADE_CLIENTE = nacM[1].trim().toUpperCase();
    }
  }

  // Nome da mãe — CTPS Digital: valor aparece na linha ANTES do label "Nome da mãe"
  const maeAntes = texto.match(/([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{5,60})\nNome da m[aã]e/i);
  const maeDepois = texto.match(/Nome da m[aã]e\s*\n\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{5,60})/i);
  const maeM = maeAntes || maeDepois;
  if (maeM && validarNome(maeM[1])) dados.NOME_MAE_CLIENTE = limparNome(maeM[1]);

  // Profissão (primeiro cargo mencionado no histórico empregatício)
  const profM = texto.match(/Cargo\s*\n\s*([^\n]{3,60})/i)
    || texto.match(/Fun[çc][aã]o\s*\n\s*([^\n]{3,60})/i);
  if (profM) dados.PROFISSAO_CLIENTE = profM[1].trim().toUpperCase();

  return dados;
}

function extrairRG(texto: string): Partial<DadosCliente> {
  const dados: Partial<DadosCliente> = {};

  // Nome: após "Nome / Name" — pode estar na mesma linha ou na próxima
  // RG digital: "Nome / Name.\n(SARA KRENKEL S S" — o "S S" é ruído do padrão de segurança
  // RG digital 2ª leitura: "Nome: tamo\nSARA KRENKEL" — "tamo" é ruído, nome na próxima linha
  const nomeM = texto.match(/Nome\s*\/\s*Name[.\s]*\n[^\n]{0,5}\(?\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n(]{3,60})\s*\)?/i)
    || texto.match(/Nome:\s*(?:[^\n]{0,10}\n)?\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n(]{5,60})/i)
    || texto.match(/\(\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2,}\s+[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2,}[^\n(]*)\s*\)/);

  if (nomeM) {
    let nome = nomeM[1].trim();
    // Remover fragmentos de ruído: tokens finais de 1-2 letras (ex: "S S", "S", "Ss")
    nome = nome.replace(/(\s+[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{1,2})+\s*$/g, '').trim();
    if (validarNome(nome)) dados.NOME_CLIENTE = limparNome(nome);
  }

  // CPF
  dados.CPF_CLIENTE = extrairCPF(texto) || undefined;

  // Data nascimento
  const dataN = texto.match(/Data de Nascimento[^\n]*\n[^\n]*\b(\d{2}\/\d{2}\/\d{4})\b/i)
    || texto.match(/Date of Birth[^\n]*[\n\s]+(\d{2}\/\d{2}\/\d{4})/i)
    || texto.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if (dataN) dados.DATA_NASCIMENTO_CLIENTE = dataN[1];

  // Naturalidade (Place of Birth) — pode estar na mesma linha que a data de validade
  // Padrão RG digital: "CAMBORIÚ/SC 17/01/2035" → extrair cidade antes da data
  const natM = texto.match(/Naturalidade\s*\/[^\n]*\n\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{2,40})/i)
    || texto.match(/Place of Birth[^\n]*\n\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{2,40})/i)
    || texto.match(/([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ\s]{3,30}\/[A-Z]{2})\s+\d{2}\/\d{2}\/\d{4}/);
  if (natM) {
    // Remove data de validade que pode estar colada
    const nat = natM[1].trim().toUpperCase().replace(/\s+\d{2}\/\d{2}\/\d{4}.*$/, '').trim();
    if (nat.length > 2) dados.NATURALIDADE_CLIENTE = nat;
  }

  // Nacionalidade: BRA → BRASILEIRO(A)
  if (/\bBRA\b/.test(texto) || /brasileiro/i.test(texto)) dados.NACIONALIDADE_CLIENTE = 'BRASILEIRO(A)';

  dados.DOCUMENTO_TIPO_CLIENTE = 'RG';

  // Órgão emissor — usa mapa de estados para obter a sigla correta
  const estadoM = texto.match(/Estado (?:do|da|de) ([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]+)/i)
    || texto.match(/Governo (?:do|da|de) ([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]+)/i)
    || texto.match(/Secretaria da Segurança Pública\s*(?:\n[^\n]+)?\s*(?:Estado|—)\s*(?:do|da|de)?\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]+)/i);
  if (estadoM) {
    dados.DOCUMENTO_ORGAO_CLIENTE = `SSP-${ufDoEstado(estadoM[1].split('\n')[0].trim())}`;
  }

  // Filiação: "Nome do pai / Father's Name" e "Nome da mãe / Mother's Name"
  const paiM = texto.match(/(?:Nome do )?[Pp]ai\s*(?:\/[^\n]*)?\n\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{5,60})/i);
  const maeM = texto.match(/(?:Nome da )?[Mm][aã]e\s*(?:\/[^\n]*)?\n\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{5,60})/i);
  if (paiM && validarNome(paiM[1])) dados.NOME_PAI_CLIENTE = limparNome(paiM[1]);
  if (maeM && validarNome(maeM[1])) dados.NOME_MAE_CLIENTE = limparNome(maeM[1]);

  return dados;
}

// Comprovante de energia elétrica (Celesc, Cemig, CPFL, etc.)
function extrairComprovanteEnergia(texto: string): Partial<DadosCliente> {
  const dados: Partial<DadosCliente> = {};

  // Palavras que não são parte do nome do cliente em contas de energia
  const RUIDO_NOME = /\b(UNIDADE\s+CONSUMIDORA|CNPJ|CPF|CLIENTE|FATURA|CONTA|SERVI[ÇC]OS?|COBRAN[ÇC]A|PAGAMENTO|VENCIMENTO|REFER[EÊ]NCIA)\b/i;

  // Nome: "Nome: FULANO" ou "Nome:\nFULANO"
  const nomeM = texto.match(/Nome:\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n\d]{5,80})/i);
  if (nomeM) {
    let nome = nomeM[1].trim().replace(/\s+/g, ' ');
    // Truncar em palavras de ruído (ex: "NEDJELJKA ZIBERT UNIDADE CONSUMIDORA" → "NEDJELJKA ZIBERT")
    const ruidoIdx = nome.search(RUIDO_NOME);
    if (ruidoIdx > 3) nome = nome.substring(0, ruidoIdx).trim();
    dados.NOME_CLIENTE = nome.toUpperCase();
  }

  // CPF: "CPF/CNPJ: " ou contém só o número
  const cpf = extrairCPF(texto);
  if (cpf) dados.CPF_CLIENTE = cpf;

  // Endereço: padrão Celesc "EnderecoDR HUMBERTO 93 - BAIRRO" (sem espaço após "Endereco")
  // ou padrão normal "Endereco: RUA X 93 - BAIRRO"
  const endM = texto.match(/Endere[cç]o[:\s]*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{5,100})/i);
  if (endM) {
    const end = endM[1].trim();
    // Extrair número (dígitos precedidos por espaço e seguidos de espaço+letra ou "-")
    const numM = end.match(/\s(\d{1,5})\s*[-\s]/);
    if (numM) dados.NUMERO_CLIENTE = numM[1];
    // Logradouro = tudo antes do número
    const idx = numM ? end.indexOf(numM[0]) : -1;
    dados.LOGRADOURO_CLIENTE = (idx > 0 ? end.substring(0, idx) : end).toUpperCase().trim();
    // Bairro = depois do número e do "-"
    const bairroM = end.match(/\d+\s*[-]\s*([^(\n]+)/);
    if (bairroM) dados.BAIRRO_CLIENTE = bairroM[1].trim().toUpperCase().split(/\n|\s{3,}/)[0].trim();
  }

  // Cidade: "Cidade: NAVEGANTES SC" ou "Cldade: NAVEGANTES SC" (OCR noise em Celesc)
  // Aceita SOMENTE letras maiúsculas e espaço — para ao primeiro caractere minúsculo/ruidoso
  const cidM = texto.match(/C[il]dade:\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ\s]{2,35})/);
  if (cidM) {
    const UF_SIGLAS = /\s+(?:SC|RJ|SP|PR|MG|RS|BA|PE|CE|GO|MS|MT|AM|PA|MA|PI|RN|PB|AL|SE|ES|RO|AC|AP|RR|TO|DF)(?:\s.*)?$/i;
    dados.CIDADE_CLIENTE = cidM[1].trim()
      .replace(UF_SIGLAS, '')  // remove sigla UF e tudo após ela
      .trim();
  }

  // CEP: padrão brasileiro
  dados.CEP_CLIENTE = extrairCEP(texto) || undefined;

  return dados;
}

// Declaração de Residência
function extrairDeclaracaoResidencia(texto: string): Partial<DadosCliente> {
  const dados: Partial<DadosCliente> = {};

  const t = texto.replace(/,\s*\./g, ',').replace(/\.\s+(?=[a-záéíóúãõâêîôûàèìòùç])/g, ', ');
  const tFlat = t.replace(/\n/g, ' ').replace(/\|\s*/g, ' ').replace(/=\s*/g, ' ').replace(/\s{2,}/g, ' ');

  // ── Identificar DECLARANTE ("Eu, NOME...") vs BENEFICIÁRIO (nome após "DECLARO... à/ao NOME") ──

  const sep = '[,\\.;]\\s*';
  const nomePattern = '[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][a-záéíóúãõâêîôûàèìòùçA-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]+(?:\\s+[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][a-záéíóúãõâêîôûàèìòùçA-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]+)+';
  const field = '[a-záéíóúãõâêîôûàèìòùç]+(?:\\s+[a-záéíóúãõâêîôûàèìòùç]+)?';

  // Declarante ("Eu, NOME, NAC, EC, PROF, portador...")
  const euM = tFlat.match(new RegExp(`[Ee]u[,\\.;]?\\s+(${nomePattern})${sep}(${field})${sep}(${field})${sep}(${field})[,\\.;]?\\s*portad`, 'i'));
  const nomDeclarante = euM?.[1]?.toUpperCase().trim() || '';

  // Beneficiário: nome que aparece depois de "DECLARO que ... à/ao NOME" ou "locação... à NOME"
  const benM = tFlat.match(/DECLAR[OA][^à]*?[àa]\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ\s]{5,40?}),/i);
  const nomBeneficiario = benM?.[1]?.trim().toUpperCase() || '';

  // Determinar se é autodeclaração ou declaração de terceiro
  // Autodeclaração: declarante e beneficiário são a mesma pessoa (ou não há beneficiário)
  const ehAutodeclaracao = !nomBeneficiario || nomesCompativeisOCR(nomDeclarante, nomBeneficiario);

  // O NOME_CLIENTE é o beneficiário (se declaração de terceiro) ou o próprio declarante
  if (nomBeneficiario && !ehAutodeclaracao) {
    if (validarNome(nomBeneficiario)) dados.NOME_CLIENTE = nomBeneficiario;
    // Dados do beneficiário: extrair da seção "à NOME, NAC, EC, PROF, portador..."
    const benDadosM = tFlat.match(new RegExp(
      `[àa]\\s+(${nomePattern})${sep}(${field})${sep}(${field})${sep}(${field})[,\\.;]?\\s*portad`, 'i'
    ));
    if (benDadosM) {
      dados.NACIONALIDADE_CLIENTE = benDadosM[2]?.trim().toUpperCase();
      dados.ESTADO_CIVIL_CLIENTE = benDadosM[3]?.trim().toUpperCase();
      dados.PROFISSAO_CLIENTE = benDadosM[4]?.trim().toUpperCase();
    }
    // CPF e documento do beneficiário: extrair da parte após DECLARO
    const posDecl = tFlat.search(/DECLAR[OA]/i);
    const textoAposDecl = posDecl >= 0 ? tFlat.substring(posDecl) : tFlat;
    dados.CPF_CLIENTE = extrairCPF(textoAposDecl) || undefined;
    const cnhBenM = textoAposDecl.match(/CNH[^\d]*n[º°]?\s*([\d\.]{8,15})/i);
    if (cnhBenM) {
      dados.DOCUMENTO_TIPO_CLIENTE = 'CNH';
      dados.DOCUMENTO_NUMERO_CLIENTE = cnhBenM[1].replace(/\./g, '').trim();
      dados.DOCUMENTO_ORGAO_CLIENTE = 'DETRAN';
    }
  } else {
    // Autodeclaração: o próprio declarante é o cliente
    if (euM && validarNome(nomDeclarante)) {
      dados.NOME_CLIENTE = nomDeclarante;
      dados.NACIONALIDADE_CLIENTE = euM[2]?.trim().toUpperCase();
      dados.ESTADO_CIVIL_CLIENTE = euM[3]?.trim().toUpperCase();
      dados.PROFISSAO_CLIENTE = euM[4]?.trim().toUpperCase();
    }
    dados.CPF_CLIENTE = extrairCPF(t) || undefined;
    dados.TELEFONE_CLIENTE = extrairTelefone(t) || undefined;
    const cnhM = t.match(/Carteira Nacional de Habilita[çc][aã]o[^,\d\n]*(?:registro\s+n[\.º]?\s*|nº\s*)([0-9\.]{8,15})/i);
    if (cnhM) {
      dados.DOCUMENTO_TIPO_CLIENTE = 'CNH';
      dados.DOCUMENTO_NUMERO_CLIENTE = cnhM[1].replace(/\./g, '').trim();
      dados.DOCUMENTO_ORGAO_CLIENTE = 'DETRAN';
    }
  }

  // ── Endereço ─────────────────────────────────────────────────────────────
  // Para declaração de terceiro: o endereço relevante é o IMÓVEL (onde o cliente reside),
  // que aparece na declaração como "imóvel localizado na..." ou "do imóvel sito à..."
  // Para autodeclaração: é o endereço do declarante ("residente e domiciliad[oa] na...")

  // Padrão para imóvel declarado (declaração de terceiro)
  const endImovelM = tFlat.match(
    /im[oó]vel\s+(?:localizado|situado|sito|sita)\s+(?:na|em|no|à?)\s+([^\,]{5,80}?),\s*(\d+),\s*([^\,]{3,40}),\s*munic[íi]pio de\s+([^\/\,]{3,40})\/([A-Z]{2})[,\.]?\s*CEP:?\s*(\d{5}-?\d{3})/i
  ) || tFlat.match(
    /im[oó]vel\s+(?:localizado|situado|sito|sita)\s+(?:na|em|no|à?)\s+([^\,]{5,80}?),\s*(\d+),\s*([^\,]{3,40})[,\.]\s*([^\,\/]{3,40})\/([A-Z]{2})[,\.]?\s*CEP:?\s*(\d{5}-?\d{3})/i
  );

  // Padrão para endereço do declarante (autodeclaração)
  const endResM = tFlat.match(
    /residente e domiciliad[oa]\s+na\s+([^\,\n\|]{3,80}?),\s*(\d+),\s*([^\,]{3,30}),\s*cidade de\s+([^\/\,]{3,30})\/([A-Z]{2})[,\.]?\s*CEP:?\s*(\d{5}-?\d{3})/i
  );

  // Priorizar: imóvel declarado (para terceiro) > endereço do declarante (para autodecl)
  const endM = (!ehAutodeclaracao && endImovelM) ? endImovelM : (endResM || endImovelM);

  if (endM) {
    dados.LOGRADOURO_CLIENTE = endM[1].trim().toUpperCase();
    dados.NUMERO_CLIENTE = endM[2];
    dados.BAIRRO_CLIENTE = endM[3].trim().toUpperCase();
    dados.CIDADE_CLIENTE = endM[4].trim().toUpperCase();
    dados.CEP_CLIENTE = endM[6]?.includes('-') ? endM[6] : endM[6] ? `${endM[6].slice(0,5)}-${endM[6].slice(5)}` : undefined;
  } else {
    dados.CEP_CLIENTE = extrairCEP(t) || undefined;
  }

  // Telefone sempre do texto todo (pode estar em qualquer posição)
  if (!dados.TELEFONE_CLIENTE) dados.TELEFONE_CLIENTE = extrairTelefone(t) || undefined;

  return dados;
}

// ─── Função principal ──────────────────────────────────────────────────────

export async function extrairDadosDocumento(filePath: string, debug = false): Promise<ResultadoExtracao & { debugTexto?: string }> {
  const ext = path.extname(filePath).toLowerCase();
  let textoFinal = '';

  try {
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);

      // 1) Tentar texto nativo primeiro
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const r = await pdfParse(buffer);
        const t = normalizarTexto(r.text);
        if (textoTemDadosUteis(t)) { textoFinal = t; }
      } catch { /* continuar */ }

      // 2) Se não tem texto nativo, extrair JPEGs e fazer OCR
      if (!textoFinal) {
        const jpegs = extrairJPEGsDoPDF(buffer);
        if (jpegs.length > 0) {
          // OCR duplo na primeira (e possivelmente única) página
          textoFinal = await ocrDuplo(jpegs[0]);
          // Se há segunda página, OCR também
          if (jpegs.length > 1) {
            const texto2 = await ocrDuplo(jpegs[1]);
            textoFinal = textoFinal + '\n' + texto2;
          }
        }
      }
    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      const buffer = fs.readFileSync(filePath);
      textoFinal = await ocrDuplo(buffer);
    } else {
      return { sucesso: false, dados: {}, confianca: 'baixa', mensagem: 'Formato não suportado.' };
    }
  } catch (e) {
    return { sucesso: false, dados: {}, confianca: 'baixa', mensagem: `Erro ao processar: ${String(e)}` };
  }

  if (!textoFinal || textoFinal.trim().length < 15) {
    return { sucesso: false, dados: {}, confianca: 'baixa', mensagem: 'Documento sem texto legível. Preencha manualmente.' };
  }

  const textLimpo = limparTextoOCR(textoFinal);
  const tipoDocumento = detectarTipo(textLimpo);
  let dados: Partial<DadosCliente> = {};
  let pessoasCertidao: PessoaCertidao[] | undefined;

  switch (tipoDocumento) {
    case 'CERTIDÃO DE CASAMENTO': {
      const r = extrairCertidaoCasamento(textLimpo);
      dados = r.dados;
      if (r.pessoasCertidao.length > 0) pessoasCertidao = r.pessoasCertidao;
      break;
    }
    case 'CERTIDÃO DE NASCIMENTO': dados = extrairCertidaoNascimento(textLimpo); break;
    case 'CNH': dados = extrairCNH(textLimpo); break;
    case 'RG': dados = extrairRG(textLimpo); break;
    case 'CARTEIRA DE TRABALHO': dados = extrairCarteiraTrabalho(textLimpo); break;
    case 'COMPROVANTE DE ENERGIA':
    case 'COMPROVANTE DE RESIDÊNCIA': dados = extrairComprovanteEnergia(textLimpo); break;
    case 'DECLARAÇÃO DE RESIDÊNCIA': dados = extrairDeclaracaoResidencia(textLimpo); break;
    default: {
      dados.CPF_CLIENTE = extrairCPF(textLimpo) || undefined;
      dados.CEP_CLIENTE = extrairCEP(textLimpo) || undefined;
      dados.TELEFONE_CLIENTE = extrairTelefone(textLimpo) || undefined;
    }
  }

  // Limpar campos vazios
  const dadosLimpos: Partial<DadosCliente> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (v && typeof v === 'string' && v.trim().length > 1) {
      (dadosLimpos as Record<string, string>)[k] = v.trim();
    }
  }

  const qtd = Object.keys(dadosLimpos).length;
  const confianca = qtd >= 5 ? 'alta' : qtd >= 2 ? 'media' : 'baixa';

  return {
    sucesso: qtd > 0,
    dados: dadosLimpos,
    confianca,
    tipoDocumento,
    pessoasCertidao,
    mensagem: qtd === 0
      ? 'Nenhum dado identificado. Preencha manualmente.'
      : `${qtd} campo(s) extraído(s) de ${tipoDocumento}.`,
    ...(debug ? { debugTexto: textLimpo } : {}),
  };
}

// Mesclar dados de múltiplos documentos (sem sobrescrever)
// Campos pessoais: só mesclam quando o documento é da mesma pessoa
const CAMPOS_PESSOAIS_OCR = new Set([
  'NOME_CLIENTE', 'CPF_CLIENTE', 'DATA_NASCIMENTO_CLIENTE', 'NOME_PAI_CLIENTE',
  'NOME_MAE_CLIENTE', 'NATURALIDADE_CLIENTE', 'NACIONALIDADE_CLIENTE',
  'ESTADO_CIVIL_CLIENTE', 'PROFISSAO_CLIENTE', 'TELEFONE_CLIENTE',
  'DOCUMENTO_TIPO_CLIENTE', 'DOCUMENTO_NUMERO_CLIENTE', 'DOCUMENTO_ORGAO_CLIENTE',
]);

// Campos de endereço: sempre mesclam (conta de luz pode estar no nome do cônjuge)
const CAMPOS_ENDERECO_OCR = new Set([
  'LOGRADOURO_CLIENTE', 'NUMERO_CLIENTE', 'COMPLEMENTO_CLIENTE',
  'BAIRRO_CLIENTE', 'CIDADE_CLIENTE', 'CEP_CLIENTE',
]);

function nomesCompativeisOCR(a: string, b: string): boolean {
  if (!a || !b) return true;
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().split(/\s+/);
  const pa = norm(a).filter(w => w.length > 3);
  const pb = norm(b).filter(w => w.length > 3);
  return pa.some(w => pb.includes(w));
}

function mesclar(
  base: Partial<DadosCliente>,
  novo: Partial<DadosCliente>,
  tipoDocumento?: string
): Partial<DadosCliente> {
  const r = { ...base };
  const nomePrimario = (r.NOME_CLIENTE as string) || '';
  const nomeDocumento = (novo.NOME_CLIENTE as string) || '';
  const mesmaPessoa = nomesCompativeisOCR(nomePrimario, nomeDocumento);

  // Comprovantes de utilidade (energia/água) podem ter endereço em nome de terceiro → sempre mescla
  const tipoDoc = tipoDocumento || '';
  const ehComprovante = tipoDoc.includes('ENERGIA') || tipoDoc === 'COMPROVANTE DE RESIDÊNCIA';

  for (const [k, v] of Object.entries(novo)) {
    if (!v || (r as Record<string, string>)[k]) continue;
    if (CAMPOS_PESSOAIS_OCR.has(k)) {
      if (!nomePrimario || !nomeDocumento || mesmaPessoa) {
        (r as Record<string, string>)[k] = v as string;
      }
    } else if (CAMPOS_ENDERECO_OCR.has(k)) {
      if (ehComprovante || !nomePrimario || !nomeDocumento || mesmaPessoa) {
        (r as Record<string, string>)[k] = v as string;
      }
    }
  }
  return r;
}

export async function extrairDadosMultiplosDocumentos(
  filePaths: string[]
): Promise<{ dadosMesclados: Partial<DadosCliente>; resultados: (ResultadoExtracao & { arquivo: string })[] }> {
  const resultados: (ResultadoExtracao & { arquivo: string })[] = [];
  let dadosMesclados: Partial<DadosCliente> = {};

  for (const fp of filePaths) {
    const r = await extrairDadosDocumento(fp);
    resultados.push({ ...r, arquivo: path.basename(fp) });
    if (r.sucesso) dadosMesclados = mesclar(dadosMesclados, r.dados, r.tipoDocumento);
  }

  return { dadosMesclados, resultados };
}
