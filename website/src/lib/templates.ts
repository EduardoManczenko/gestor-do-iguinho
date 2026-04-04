import { Template, TagEspecifica } from './types';

const TEMPLATES: Template[] = [
  {
    id: 'TEMPLATE_PROCURACAO',
    nome: 'Procuração Particular',
    arquivo: 'TEMPLATE_PROCURACAO.docx',
    requerTestemunha: false,
    tagsEspecificas: [
      { tag: 'DATA_ATUAL', label: 'Data', tipo: 'date' },
      { tag: 'FINALIDADE_ESPECIFICA', label: 'Finalidade / Poderes Específicos', tipo: 'text' },
    ],
  },
  {
    id: 'TEMPLATE_CONTRATO_HONORARIOS',
    nome: 'Contrato de Honorários',
    arquivo: 'TEMPLATE_CONTRATO_HONORARIOS.docx',
    requerTestemunha: false,
    tagsEspecificas: [
      { tag: 'FINALIDADE_ESPECIFICA', label: 'Finalidade / Objeto do Contrato', tipo: 'text' },
      { tag: 'VALOR_TOTAL', label: 'Valor Total (R$)', tipo: 'text' },
      { tag: 'VALOR_TOTAL_EXTENSO', label: 'Valor Total por Extenso', tipo: 'text' },
      { tag: 'VALOR_ENTRADA', label: 'Valor de Entrada (R$)', tipo: 'text' },
      { tag: 'VALOR_ENTRADA_EXTENSO', label: 'Valor de Entrada por Extenso', tipo: 'text' },
      { tag: 'NUMERO_PARCELAS', label: 'Número de Parcelas', tipo: 'number' },
      { tag: 'VALOR_PARCELA', label: 'Valor da Parcela (R$)', tipo: 'text' },
      { tag: 'VALOR_PARCELA_EXTENSO', label: 'Valor da Parcela por Extenso', tipo: 'text' },
      { tag: 'DATA_PRIMEIRA_PARCELA', label: 'Data da Primeira Parcela', tipo: 'date' },
      { tag: 'DATA_ATUAL', label: 'Data do Contrato', tipo: 'date' },
    ],
  },
  {
    id: 'TEMPLATE_DECLARACAO_HIPOSSUFICIENCIA',
    nome: 'Declaração de Hipossuficiência',
    arquivo: 'TEMPLATE_DECLARACAO_HIPOSSUFICIENCIA.docx',
    requerTestemunha: false,
    tagsEspecificas: [
      { tag: 'DATA_ATUAL', label: 'Data', tipo: 'date' },
    ],
  },
  {
    id: 'TEMPLATE_PROCURACAO_SIMPLES',
    nome: 'Procuração Simples',
    arquivo: 'TEMPLATE_PROCURACAO_SIMPLES.docx',
    requerTestemunha: false,
    tagsEspecificas: [
      { tag: 'FINALIDADE_ESPECIFICA', label: 'Finalidade / Poderes Específicos', tipo: 'text' },
      { tag: 'DATA_ATUAL', label: 'Data', tipo: 'date' },
    ],
  },
  {
    id: 'TEMPLATE_CONTRATO_HONORARIOS_SIMPLES',
    nome: 'Contrato de Honorários Simples',
    arquivo: 'TEMPLATE_CONTRATO_HONORARIOS_SIMPLES.docx',
    requerTestemunha: false,
    tagsEspecificas: [
      { tag: 'FINALIDADE_ESPECIFICA', label: 'Finalidade / Objeto do Contrato', tipo: 'text' },
      { tag: 'OBJETO_CONTRATO', label: 'Objeto do Contrato (descrição detalhada)', tipo: 'text' },
      { tag: 'HONORARIOS_PERCENTUAL', label: 'Percentual de Honorários (%)', tipo: 'text' },
      { tag: 'DATA_ATUAL', label: 'Data', tipo: 'date' },
    ],
  },
  {
    id: 'TEMPLATE_DECLARACAO_IRPF',
    nome: 'Declaração de Isenção de IRPF',
    arquivo: 'TEMPLATE_DECLARACAO_IRPF.docx',
    requerTestemunha: false,
    tagsEspecificas: [
      { tag: 'EXERCICIO', label: 'Exercício (ano)', tipo: 'text' },
      { tag: 'DOCUMENTO_ALTERNATIVO', label: 'Documento Alternativo (RG/CNH)', tipo: 'text' },
      { tag: 'DATA_ATUAL', label: 'Data', tipo: 'date' },
    ],
  },
  {
    id: 'TEMPLATE_DECLARACAO_TESTEMUNHA',
    nome: 'Declaração de Testemunha',
    arquivo: 'TEMPLATE_DECLARACAO_TESTEMUNHA.docx',
    requerTestemunha: true,
    tagsEspecificas: [
      { tag: 'COMARCA', label: 'Comarca', tipo: 'text' },
      { tag: 'NOME_AUTOR', label: 'Nome do Autor', tipo: 'text' },
      { tag: 'NOME_CONJUGE', label: 'Nome do Cônjuge', tipo: 'text' },
      { tag: 'DESCRICAO_IMOVEL', label: 'Descrição do Imóvel', tipo: 'text' },
      { tag: 'TEMPO_POSSE', label: 'Tempo de Posse (ex: 10 anos)', tipo: 'text' },
      { tag: 'ANO_INICIO_POSSE', label: 'Ano de Início da Posse', tipo: 'text' },
      { tag: 'CONFRONTANTES_NOMES', label: 'Nomes dos Confrontantes', tipo: 'text' },
      { tag: 'CIDADE_DECLARACAO', label: 'Cidade da Declaração', tipo: 'text' },
      { tag: 'DATA_ATUAL', label: 'Data', tipo: 'date' },
    ],
  },
];

export function listarTemplates(): Template[] {
  return TEMPLATES;
}

export function buscarTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) || null;
}
