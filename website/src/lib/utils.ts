import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatarData(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatarDataHora(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

// Converte "DD/MM/YYYY" → "YYYY-MM-DD" (formato esperado pelo <input type="date">)
// Se já estiver no formato correto ou inválido, retorna como está
export function brDateToISO(data: string): string {
  if (!data) return data;
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return data;
}

// Converte "YYYY-MM-DD" → "DD/MM/YYYY" para exibição
export function isoDateToBR(data: string): string {
  if (!data) return data;
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return data;
}

export function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

export const LABELS_CAMPOS: Record<string, string> = {
  NOME_CLIENTE: 'Nome Completo',
  NACIONALIDADE_CLIENTE: 'Nacionalidade',
  ESTADO_CIVIL_CLIENTE: 'Estado Civil',
  PROFISSAO_CLIENTE: 'Profissão',
  CPF_CLIENTE: 'CPF',
  TELEFONE_CLIENTE: 'Telefone',
  LOGRADOURO_CLIENTE: 'Logradouro',
  NUMERO_CLIENTE: 'Número',
  COMPLEMENTO_CLIENTE: 'Complemento',
  BAIRRO_CLIENTE: 'Bairro',
  CIDADE_CLIENTE: 'Cidade',
  CEP_CLIENTE: 'CEP',
  NOME_MAE_CLIENTE: 'Nome da Mãe',
  NOME_PAI_CLIENTE: 'Nome do Pai',
  NATURALIDADE_CLIENTE: 'Naturalidade',
  DATA_NASCIMENTO_CLIENTE: 'Data de Nascimento',
  DOCUMENTO_TIPO_CLIENTE: 'Tipo de Documento',
  DOCUMENTO_NUMERO_CLIENTE: 'Número do Documento',
  DOCUMENTO_ORGAO_CLIENTE: 'Órgão Expedidor',
};

export const ESTADO_CIVIL_OPCOES = [
  'SOLTEIRO(A)',
  'CASADO(A)',
  'DIVORCIADO(A)',
  'VIÚVO(A)',
  'SEPARADO(A)',
  'UNIÃO ESTÁVEL',
];

export const NACIONALIDADE_OPCOES = [
  'BRASILEIRO(A)',
  'ARGENTINO(A)',
  'BOLIVIANO(A)',
  'CHILENO(A)',
  'COLOMBIANO(A)',
  'EQUATORIANO(A)',
  'PARAGUAIO(A)',
  'PERUANO(A)',
  'URUGUAIO(A)',
  'VENEZUELANO(A)',
  'AMERICANO(A)',
  'CANADENSE',
  'MEXICANO(A)',
  'PORTUGUÊS(A)',
  'ESPANHOL(A)',
  'ITALIANO(A)',
  'FRANCÊS(A)',
  'ALEMÃO(Ã)',
  'INGLÊS(A)',
  'HOLANDÊS(A)',
  'SUÍÇO(A)',
  'BELGA',
  'AUSTRÍACO(A)',
  'POLONÊS(A)',
  'RUSSO(A)',
  'UCRANIANO(A)',
  'ROMENO(A)',
  'HÚNGARO(A)',
  'TCHECO(A)',
  'SÉRVIO(A)',
  'CROATA',
  'ESLOVENO(A)',
  'MONTENEGRINO(A)',
  'BÓSNIO(A)',
  'ALBANÊS(A)',
  'BÚLGARO(A)',
  'GREGO(A)',
  'TURCO(A)',
  'JAPONÊS(A)',
  'CHINÊS(A)',
  'COREANO(A)',
  'INDIANO(A)',
  'PAQUISTANÊS(A)',
  'BANGLADÊS(A)',
  'ANGOLANO(A)',
  'CABO-VERDIANO(A)',
  'MOÇAMBICANO(A)',
  'NIGERIANO(A)',
  'GANÊS(A)',
  'SENEGALÊS(A)',
  'ESTRANGEIRO(A)',
];

export const DOCUMENTO_TIPO_OPCOES = ['RG', 'CNH', 'PASSAPORTE', 'CTPS', 'CERTIDÃO DE NASCIMENTO'];
