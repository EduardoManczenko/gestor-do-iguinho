/**
 * Script de teste do OCR - executa sem servidor Next.js
 * node test_ocr.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const __dir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const workerPath = path.join(__dir, 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');

// ── helpers ──────────────────────────────────────────────────────────────────

const MESES = { janeiro:'01',fevereiro:'02','março':'03',marco:'03',abril:'04',maio:'05',junho:'06',julho:'07',agosto:'08',setembro:'09',outubro:'10',novembro:'11',dezembro:'12' };
const MESES_NUM = { 'ZERO':0,'UM':1,'DOIS':2,'TRÊS':3,'TRES':3,'QUATRO':4,'CINCO':5,'SEIS':6,'SETE':7,'OITO':8,'NOVE':9,'DEZ':10,'ONZE':11,'DOZE':12,'TREZE':13,'QUATORZE':14,'QUINZE':15,'DEZESSEIS':16,'DEZESSETE':17,'DEZOITO':18,'DEZENOVE':19,'VINTE':20,'VINTE E UM':21,'VINTE E DOIS':22,'VINTE E TRÊS':23,'VINTE E QUATRO':24,'VINTE E CINCO':25,'VINTE E SEIS':26,'VINTE E SETE':27,'VINTE E OITO':28,'VINTE E NOVE':29,'TRINTA':30,'TRINTA E UM':31 };
const ANOS_EXT = { 'DOIS MIL E SETE':'2007','DOIS MIL E OITO':'2008','DOIS MIL E NOVE':'2009','DOIS MIL E DEZ':'2010','DOIS MIL E ONZE':'2011','DOIS MIL E DOZE':'2012','DOIS MIL E TREZE':'2013','DOIS MIL E QUATORZE':'2014','DOIS MIL E QUINZE':'2015','DOIS MIL E DEZESSEIS':'2016','DOIS MIL E DEZESSETE':'2017','DOIS MIL E DEZOITO':'2018','DOIS MIL E DEZENOVE':'2019','DOIS MIL E VINTE':'2020','DOIS MIL E VINTE E UM':'2021','DOIS MIL E VINTE E DOIS':'2022','DOIS MIL E VINTE E TRÊS':'2023','DOIS MIL E VINTE E QUATRO':'2024','DOIS MIL E VINTE E CINCO':'2025','DOIS MIL E VINTE E SEIS':'2026' };

function converterDataExtenso(texto) {
  const m = texto.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (m) { const mes = MESES[m[2].toLowerCase()]; if (mes) return `${m[1].padStart(2,'0')}/${mes}/${m[3]}`; }
  const up = texto.toUpperCase();
  for (const [nAno, ano] of Object.entries(ANOS_EXT))
    for (const [nMes, mes] of Object.entries(MESES))
      for (const [nDia, dia] of Object.entries(MESES_NUM))
        if (nDia !== 'ZERO' && up.includes(nDia) && up.includes(nMes.toUpperCase()) && up.includes(nAno))
          return `${String(dia).padStart(2,'0')}/${mes}/${ano}`;
  return null;
}

function extrairCPF(t) {
  const ms = t.match(/\b\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2}\b/g);
  if (!ms) return null;
  for (const m of ms) { const d = m.replace(/\D/g,''); if (d.length===11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`; }
  return null;
}
function extrairCEP(t) {
  const m = t.match(/CEP[:\s]+(\d{5})[\-\s]?(\d{3})/i) || t.match(/\b(\d{5})-(\ d{3})\b/);
  return m ? `${m[1]}-${m[2]}` : null;
}
function extrairTel(t) { const m = t.match(/\(?\d{2}\)?[\s\-]?9?\d{4}[\s\-]\d{4}/); return m ? m[0].trim() : null; }

function validarNome(nome) {
  if (!nome || nome.trim().length < 5) return false;
  const ruido = ['nao mudou seu nome','não mudou seu nome','expedida pelo','separacao legal','registro civil','republica federativa','poder judiciario','informacao','sem informação'];
  const lower = nome.toLowerCase().trim();
  if (ruido.some(r => lower.includes(r))) return false;
  const palavras = lower.split(/\s+/).filter(p=>p.length>1);
  if (palavras.length < 2) return false;
  for (const p of palavras) {
    if (p.length<=2) continue;
    const v = (p.match(/[aeiouáéíóúãõâêîôûàèìòùy]/g)||[]).length;
    if (p.length>3 && v===0) return false;
  }
  return !/\d/.test(nome);
}
function limparNome(nome) {
  return nome.replace(/\s*,.*$/,'').replace(/[^a-záéíóúàèìòùãõâêîôûçA-ZÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÇ\s]/g,'').trim().toUpperCase();
}

function detectarTipo(t) {
  const l = t.toLowerCase();
  if (l.includes('declaração de residência') || l.includes('declaracao de residencia')) return 'DECLARAÇÃO DE RESIDÊNCIA';
  if ((l.includes('certidão')&&l.includes('casamento'))||(l.includes('certidao')&&l.includes('casamento'))) return 'CERTIDÃO DE CASAMENTO';
  if ((l.includes('certidão')&&l.includes('nascimento'))||(l.includes('certidao')&&l.includes('nascimento'))) return 'CERTIDÃO DE NASCIMENTO';
  if (l.includes('celesc')||l.includes('kwh')||l.includes('danf3e')||l.includes('energia elétrica')) return 'COMPROVANTE DE ENERGIA';
  if (l.includes('carteira nacional')||l.includes('driver license')||l.includes('permiso de conducción')||(l.includes('habilitação')&&l.includes('detran'))) return 'CNH';
  if (l.includes('carteira de identidade')||(l.includes('registro geral')&&l.includes('cpf / personal'))) return 'RG';
  return 'DOCUMENTO';
}

function limparTexto(texto) {
  return texto.split('\n')
    .map(l => l.replace(/[|\\\/]{2,}/g,' ').replace(/\s+/g,' ').trim())
    .filter(l => { if (l.length<3) return false; const let2 = (l.match(/[a-záéíóúàèìòùãõâêîôûçA-ZÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÇ]/g)||[]).length; return let2/l.replace(/\s/g,'').length > 0.28; })
    .join('\n');
}

function extrairJPEGs(buf) {
  const res=[]; let pos=0;
  while (pos<buf.length-3) {
    if (buf[pos]===0xFF&&buf[pos+1]===0xD8&&buf[pos+2]===0xFF) {
      let end=-1;
      for (let i=buf.length-2;i>pos;i--) if (buf[i]===0xFF&&buf[i+1]===0xD9) { end=i+2; break; }
      if (end>pos) { res.push(buf.slice(pos,end)); pos=end; } else break;
    } else pos++;
  }
  return res;
}

async function ocrJpeg(jpeg, mode) {
  let processed;
  if (mode==='bin') processed = await sharp(jpeg).grayscale().threshold(130).png().toBuffer();
  else processed = await sharp(jpeg).grayscale().normalize().sharpen({sigma:1.5}).png().toBuffer();
  const tmp = path.join(os.tmpdir(), `t_${Date.now()}_${mode}.png`);
  fs.writeFileSync(tmp, processed);
  const w = await createWorker('por',1,{workerPath});
  const {data:{text}} = await w.recognize(tmp);
  await w.terminate(); fs.unlinkSync(tmp);
  return text.replace(/\r/g,'');
}

async function obterTexto(filePath) {
  const buf = fs.readFileSync(filePath);
  // Tentar texto nativo
  try {
    const r = await pdfParse(buf);
    const t = r.text.replace(/\r/g,'').trim();
    const linhas = t.split('\n').filter(l=>l.trim().length>10&&/[a-zA-ZÀ-ú]{4,}/.test(l));
    const isAppHeader = /QR Code|aplicativo.*gov|autenticidade da Carteira|assinatura eletrônica/i.test(t);
    const temDados = linhas.length>=4&&(!isAppHeader||/CPF|nascimento|naturalidade/i.test(t));
    if (temDados) return t;
  } catch {}
  // JPEG OCR — ambos os modos concatenados
  const jpegs = extrairJPEGs(buf);
  if (jpegs.length===0) return '';
  const textos = await Promise.all(jpegs.slice(0,2).map(async j => {
    const [norm, bin] = await Promise.all([ocrJpeg(j,'norm'), ocrJpeg(j,'bin')]);
    return norm + '\n\n' + bin;
  }));
  return textos.join('\n');
}

// ── extratores ───────────────────────────────────────────────────────────────

function extrairDeclaracao(t) {
  const dados = {};
  // Normalizar separadores (OCR pode confundir vírgulas com pontos)
  const tx = t.replace(/,\s*\./g,',').replace(/\.\s+(?=[a-záéíóúãõâêîôûàèìòùç])/g,', ');
  const sep = '[,\\.;]\\s*';
  const nomeP = '[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][a-záéíóúãõâêîôûàèìòùçA-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]+(?:\\s+[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][a-záéíóúãõâêîôûàèìòùçA-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]+)+';
  const campo = '[a-záéíóúãõâêîôûàèìòùç]+(?:\\s+[a-záéíóúãõâêîôûàèìòùç]+)?';
  const re = new RegExp(`[Ee]u[,\\.;]?\\s+(${nomeP})${sep}(${campo})${sep}(${campo})${sep}(${campo})[,\\.;]?\\s*portad`,'i');
  const m = tx.match(re);
  if (m&&validarNome(m[1])) { dados.NOME_CLIENTE=m[1].toUpperCase().trim(); dados.NACIONALIDADE_CLIENTE=m[2].trim().toUpperCase(); dados.ESTADO_CIVIL_CLIENTE=m[3].trim().toUpperCase(); dados.PROFISSAO_CLIENTE=m[4].trim().toUpperCase(); }
  dados.CPF_CLIENTE=extrairCPF(tx);
  dados.TELEFONE_CLIENTE=extrairTel(tx);
  const endM = tx.match(/residente e domiciliad[oa]\s+na\s+([^\,\n\|]{3,80})[,\|]\s*(\d+)[,\|]?\s*([^\,\.]+)[,\.]\s*cidade de\s+([^\/\,\.]+)\/([A-Z]{2})[,\.]?\s*CEP:?\s*(\d{5}-?\d{3})/i);
  if (endM) { dados.LOGRADOURO_CLIENTE=endM[1].trim().toUpperCase().replace(/\s*[=\|]\s*/g,' '); dados.NUMERO_CLIENTE=endM[2]; dados.BAIRRO_CLIENTE=endM[3].trim().toUpperCase(); dados.CIDADE_CLIENTE=endM[4].trim().toUpperCase(); dados.CEP_CLIENTE=endM[6].includes('-')?endM[6]:`${endM[6].slice(0,5)}-${endM[6].slice(5)}`; }
  else dados.CEP_CLIENTE=extrairCEP(tx);
  const cnhM = tx.match(/Carteira Nacional de Habilita[çc][aã]o[^,\d\n]*(?:registro\s+n[\.º]?\s*|nº\s*)([0-9\.]{8,15})/i);
  if (cnhM) { dados.DOCUMENTO_TIPO_CLIENTE='CNH'; dados.DOCUMENTO_NUMERO_CLIENTE=cnhM[1].replace(/\./g,'').trim(); dados.DOCUMENTO_ORGAO_CLIENTE='DETRAN'; }
  return dados;
}

function extrairCertidaoCasamento(t) {
  const dados = {}; const pessoas = [];
  const tx = t.replace(/\n+/g,' ').replace(/\s{2,}/g,' ');
  const re = /(?:Ele:|Ela[;:])\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\,\.]{3,60}),\s*natural de\s+([^\,]+),\s*nascid[oa]\s+em\s+(\d+\s+de\s+\w+\s+de\s+\d{4})[^,]*,\s*de\s+nacionalidade\s+([^\,]+),\s*filh[oa]\s+de\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^e]+?)\s+e\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\.x]{3,60})/gi;
  let m;
  while ((m=re.exec(tx))!==null) {
    const p = { papel:m[0].toLowerCase().startsWith('ele')?'ele':'ela', nome:limparNome(m[1]), naturalidade:m[2].trim().toUpperCase(), dataNascimento:converterDataExtenso(m[3])||m[3], nacionalidade:m[4].trim().toUpperCase(), nomePai:limparNome(m[5]), nomeMae:limparNome(m[6]) };
    if (validarNome(p.nome)) pessoas.push(p);
  }
  if (pessoas.length>0) { const p=pessoas[0]; dados.NOME_CLIENTE=p.nome; dados.NATURALIDADE_CLIENTE=p.naturalidade; dados.DATA_NASCIMENTO_CLIENTE=p.dataNascimento; dados.NACIONALIDADE_CLIENTE=p.nacionalidade; dados.NOME_PAI_CLIENTE=p.nomePai; dados.NOME_MAE_CLIENTE=p.nomeMae; dados.ESTADO_CIVIL_CLIENTE='CASADO(A)'; }
  dados.CPF_CLIENTE=extrairCPF(t);
  dados.__PESSOAS__ = pessoas;
  return dados;
}

function extrairCertidaoNascimento(t) {
  const dados = {};
  const blocoNome = t.match(/NOME\s*[^\n]*\n\s*[^A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ\s]{5,60})/i);
  if (blocoNome&&validarNome(blocoNome[1])) dados.NOME_CLIENTE=limparNome(blocoNome[1]);
  const blocoData = t.match(/DATA DE NASCIMENTO[^\n]{0,20}\n([^\n]+(?:\n[^\n]+){0,3})/i);
  if (blocoData) { const dt=converterDataExtenso(blocoData[1]); if (dt) dados.DATA_NASCIMENTO_CLIENTE=dt; }
  if (!dados.DATA_NASCIMENTO_CLIENTE) { const dm=t.match(/\|\s*(\d{2})\s*\|\s*[\[\|]\s*(\d{2})\s*[\]\|]\s*[\[\|]\s*(\d{4})\s*[\]\|]/); if (dm) dados.DATA_NASCIMENTO_CLIENTE=`${dm[1]}/${dm[2]}/${dm[3]}`; }
  if (!dados.DATA_NASCIMENTO_CLIENTE) { const dm2=t.match(/\b(\d{2})\s*\|\s*(\d{2})\s*\|\s*(\d{4})\b/); if (dm2) dados.DATA_NASCIMENTO_CLIENTE=`${dm2[1]}/${dm2[2]}/${dm2[3]}`; }
  const natM = t.match(/HORA DE NASCIMENTO[^\n]*\n[^\n]*\|\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n|]{2,30})\s*\|/i);
  if (natM) dados.NATURALIDADE_CLIENTE=natM[1].trim().toUpperCase();
  const tx = t.replace(/\n/g,' ');
  const filM = tx.match(/FILIA[ÇC][ÃA]O\s*[-\|]?\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^,]+(?:,\s*NATURAL[^E]+)?)\s+E\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^,\.]+)/i);
  if (filM) {
    const pai=filM[1].replace(/[,\s]*NATURAL[^\,]*/i,'').replace(/^\W+/,'').trim();
    const mae=filM[2].replace(/[,\s]*NATURAL[^\,]*/i,'').replace(/,.*$/,'').trim();
    if (validarNome(pai)) dados.NOME_PAI_CLIENTE=limparNome(pai);
    if (validarNome(mae)) dados.NOME_MAE_CLIENTE=limparNome(mae);
  }
  dados.NACIONALIDADE_CLIENTE='BRASILEIRO(A)';
  return dados;
}

function extrairCNH(t) {
  const dados = {};
  dados.CPF_CLIENTE=extrairCPF(t);
  const datas = (t.match(/\b\d{2}\/\d{2}\/\d{4}\b/g)||[]).sort((a,b) => { const [pa,pb]=[a,b].map(d=>{const p=d.split('/');return new Date(+p[2],+p[1]-1,+p[0]).getTime();}); return pa-pb; });
  if (datas.length>0) dados.DATA_NASCIMENTO_CLIENTE=datas[0];
  const filM = t.match(/\[\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\[\]]{5,50})\s*\]/g);
  if (filM&&filM.length>=2) { const p1=filM[0].replace(/[\[\]]/g,'').trim(); const p2=filM[1].replace(/[\[\]]/g,'').trim(); if (validarNome(p1)) dados.NOME_MAE_CLIENTE=limparNome(p1); if (validarNome(p2)) dados.NOME_PAI_CLIENTE=limparNome(p2); }
  const num = t.match(/\b(\d{11})\b/); if (num) dados.DOCUMENTO_NUMERO_CLIENTE=num[1];
  const nomeM = t.match(/NOME\s*SOBRENOME\s*[^\n]*\n+\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n,]{5,50})/i);
  if (nomeM&&validarNome(nomeM[1])) dados.NOME_CLIENTE=limparNome(nomeM[1]);
  // Tentar nome na linha que contém data (binarize coloca nome e data juntos)
  if (!dados.NOME_CLIENTE) {
    const nomeData = t.match(/([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{3,}(?:\s+[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2,})+)\s+\d{2}\/\d{2}\/\d{4}/);
    if (nomeData&&validarNome(nomeData[1])&&!['CARTEIRA','HABILITAÇÃO','NACIONAL','BRASIL','MINISTÉRIO','SECRETARIA'].includes(nomeData[1].trim())) dados.NOME_CLIENTE=limparNome(nomeData[1]);
  }
  if (/estrangeiro/i.test(t)) dados.NACIONALIDADE_CLIENTE='ESTRANGEIRO(A)'; else dados.NACIONALIDADE_CLIENTE='BRASILEIRO(A)';
  dados.DOCUMENTO_TIPO_CLIENTE='CNH'; dados.DOCUMENTO_ORGAO_CLIENTE='DETRAN';
  return dados;
}

function extrairRG(t) {
  const dados = {};
  const nomeM = t.match(/Nome\s*\/\s*Name[^\n]*\n\s*\(?\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n(]{3,60})\s*\)?/i);
  if (nomeM&&validarNome(nomeM[1])) dados.NOME_CLIENTE=limparNome(nomeM[1]);
  if (!dados.NOME_CLIENTE) { const n2=t.match(/\(\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{3,}\s+[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]{2,}[^\n(]*)\s*\)/); if (n2&&validarNome(n2[1])) dados.NOME_CLIENTE=limparNome(n2[1]); }
  dados.CPF_CLIENTE=extrairCPF(t);
  const dataN = t.match(/Data de Nascimento[^\n]*\n[^\n]*\b(\d{2}\/\d{2}\/\d{4})\b/i)||t.match(/Date of Birth[^\n]*[\n\s]+(\d{2}\/\d{2}\/\d{4})/i)||t.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if (dataN) dados.DATA_NASCIMENTO_CLIENTE=dataN[1];
  const natM = t.match(/Naturalidade\s*\/[^\n]*\n\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{3,40})/i)||t.match(/Place of Birth[^\n]*\n\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n]{3,40})/i);
  if (natM) dados.NATURALIDADE_CLIENTE=natM[1].trim().toUpperCase().split('\n')[0].trim();
  if (/\bBRA\b/.test(t)||/brasileiro/i.test(t)) dados.NACIONALIDADE_CLIENTE='BRASILEIRO(A)';
  dados.DOCUMENTO_TIPO_CLIENTE='RG';
  return dados;
}

function extrairEnergia(t) {
  const dados = {};
  const nomeM = t.match(/Nome:\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n\d]{5,60})/i);
  if (nomeM) dados.NOME_CLIENTE=nomeM[1].trim().toUpperCase().split('UNIDADE')[0].trim();
  dados.CPF_CLIENTE=extrairCPF(t);
  const cidM = t.match(/Cidade:\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][^\n\d]{3,40})/i);
  if (cidM) dados.CIDADE_CLIENTE=cidM[1].trim().toUpperCase().replace(/\s+(SC|RJ|SP|PR|MG|RS|BA|GO|PE|CE)$/,'').trim();
  dados.CEP_CLIENTE=extrairCEP(t);
  const endM = t.match(/Endere[cç]o\s+([^\n]{5,80})/i);
  if (endM) { const e=endM[1].trim().toUpperCase(); dados.LOGRADOURO_CLIENTE=e; const n=e.match(/\s+(\d{1,5})\s*[-\s]/); if (n) dados.NUMERO_CLIENTE=n[1]; }
  return dados;
}

function extrairDados(texto, tipo) {
  const limpo = limparTexto(texto);
  switch (tipo) {
    case 'DECLARAÇÃO DE RESIDÊNCIA': return extrairDeclaracao(texto); // usa texto completo para melhor regex
    case 'CERTIDÃO DE CASAMENTO': return extrairCertidaoCasamento(texto);
    case 'CERTIDÃO DE NASCIMENTO': return extrairCertidaoNascimento(limpo);
    case 'CNH': return extrairCNH(texto);
    case 'RG': return extrairRG(texto);
    case 'COMPROVANTE DE ENERGIA': return extrairEnergia(texto);
    default: return { CPF_CLIENTE: extrairCPF(texto), CEP_CLIENTE: extrairCEP(texto) };
  }
}

// ── teste principal ───────────────────────────────────────────────────────────

const docs = [
  { path: '../scanner/B18-DECLARAÇÃO DE RESIDÊNCIA.pdf', label: 'Declaração de Residência' },
  { path: '../scanner/A16-CERTIDÃO DE CASAMENTO.pdf',    label: 'Certidão de Casamento' },
  { path: '../scanner/A17-CERTIDÃO DE NASCIMENTO.pdf',   label: 'Certidão de Nascimento' },
  { path: '../beleza eh/A03-COMPROVANTE DE RESIDÊNCIA.pdf', label: 'Comprovante Celesc' },
  { path: '../beleza eh/RG SARA.pdf',                    label: 'RG (Sara Krenkel)' },
  { path: '../scanner/A02-CNH.pdf',                      label: 'CNH (Amir Medunjanin)' },
];

for (const doc of docs) {
  console.log(`\n${'='.repeat(60)}\n[${doc.label}]\n${'='.repeat(60)}`);
  const texto = await obterTexto(doc.path);
  const tipo  = detectarTipo(texto);
  console.log('Tipo:', tipo);
  const dados = extrairDados(texto, tipo);
  const pessoas = dados.__PESSOAS__; delete dados.__PESSOAS__;
  if (pessoas?.length>0) {
    console.log('\n  PESSOAS ENCONTRADAS:');
    pessoas.forEach((p,i)=>console.log(`  [${i+1}] ${p.papel.toUpperCase()}: ${p.nome} | Nat: ${p.naturalidade} | Nasc: ${p.dataNascimento} | Nac: ${p.nacionalidade}\n      Pai: ${p.nomePai} | Mãe: ${p.nomeMae}`));
  }
  console.log('\n  DADOS EXTRAÍDOS:');
  const ok = Object.entries(dados).filter(([,v])=>v);
  if (ok.length===0) console.log('  (nenhum dado extraído)');
  else ok.forEach(([k,v])=>console.log(`  ${k}: ${v}`));
}
