import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { Template, TagEspecifica } from './types';
import { TEMPLATES_DIR } from './storage';

// ─── Tags do cadastro do cliente (preenchidas automaticamente) ─────────────
const TAGS_CLIENTE = new Set([
  'NOME_CLIENTE', 'NACIONALIDADE_CLIENTE', 'ESTADO_CIVIL_CLIENTE', 'PROFISSAO_CLIENTE',
  'CPF_CLIENTE', 'TELEFONE_CLIENTE', 'LOGRADOURO_CLIENTE', 'NUMERO_CLIENTE',
  'COMPLEMENTO_CLIENTE', 'BAIRRO_CLIENTE', 'CIDADE_CLIENTE', 'CEP_CLIENTE',
  'NOME_MAE_CLIENTE', 'NOME_PAI_CLIENTE', 'NATURALIDADE_CLIENTE', 'DATA_NASCIMENTO_CLIENTE',
  'DOCUMENTO_TIPO_CLIENTE', 'DOCUMENTO_NUMERO_CLIENTE', 'DOCUMENTO_ORGAO_CLIENTE',
]);

// ─── Tags de testemunha (formulário separado) ──────────────────────────────
const TAGS_TESTEMUNHA = new Set([
  'NOME_TESTEMUNHA', 'CPF_TESTEMUNHA', 'NACIONALIDADE_TESTEMUNHA', 'ESTADO_CIVIL_TESTEMUNHA',
  'PROFISSAO_TESTEMUNHA', 'LOGRADOURO_TESTEMUNHA', 'NUMERO_TESTEMUNHA', 'BAIRRO_TESTEMUNHA',
  'CIDADE_TESTEMUNHA', 'CEP_TESTEMUNHA', 'TELEFONE_TESTEMUNHA',
]);

// ─── Metadados de tags conhecidas (label e tipo do input) ─────────────────
const TAG_META: Record<string, Pick<TagEspecifica, 'label' | 'tipo'>> = {
  DATA_ATUAL:               { label: 'Data do Documento',                   tipo: 'date'   },
  FINALIDADE_ESPECIFICA:    { label: 'Finalidade / Poderes Específicos',     tipo: 'text'   },
  VALOR_TOTAL:              { label: 'Valor Total (R$)',                     tipo: 'text'   },
  VALOR_TOTAL_EXTENSO:      { label: 'Valor Total por Extenso',              tipo: 'text'   },
  VALOR_ENTRADA:            { label: 'Valor de Entrada (R$)',                tipo: 'text'   },
  VALOR_ENTRADA_EXTENSO:    { label: 'Valor de Entrada por Extenso',         tipo: 'text'   },
  NUMERO_PARCELAS:          { label: 'Número de Parcelas',                   tipo: 'number' },
  VALOR_PARCELA:            { label: 'Valor da Parcela (R$)',                tipo: 'text'   },
  VALOR_PARCELA_EXTENSO:    { label: 'Valor da Parcela por Extenso',         tipo: 'text'   },
  DATA_PRIMEIRA_PARCELA:    { label: 'Data da Primeira Parcela',             tipo: 'date'   },
  EXERCICIO:                { label: 'Exercício (ano)',                       tipo: 'text'   },
  DOCUMENTO_ALTERNATIVO:    { label: 'Documento Alternativo (RG/CNH)',        tipo: 'text'   },
  OBJETO_CONTRATO:          { label: 'Objeto do Contrato (descrição)',        tipo: 'text'   },
  HONORARIOS_PERCENTUAL:    { label: 'Percentual de Honorários (%)',          tipo: 'text'   },
  COMARCA:                  { label: 'Comarca',                               tipo: 'text'   },
  NOME_AUTOR:               { label: 'Nome do Autor',                        tipo: 'text'   },
  NOME_CONJUGE:             { label: 'Nome do Cônjuge',                      tipo: 'text'   },
  DESCRICAO_IMOVEL:         { label: 'Descrição do Imóvel',                  tipo: 'text'   },
  TEMPO_POSSE:              { label: 'Tempo de Posse (ex: 10 anos)',          tipo: 'text'   },
  ANO_INICIO_POSSE:         { label: 'Ano de Início da Posse',               tipo: 'text'   },
  CONFRONTANTES_NOMES:      { label: 'Nomes dos Confrontantes',              tipo: 'text'   },
  CIDADE_DECLARACAO:        { label: 'Cidade da Declaração',                 tipo: 'text'   },
};

// ─── Nomes amigáveis para templates conhecidos ────────────────────────────
const NOMES: Record<string, string> = {
  TEMPLATE_PROCURACAO:                   'Procuração Particular',
  TEMPLATE_CONTRATO_HONORARIOS:          'Contrato de Honorários',
  TEMPLATE_DECLARACAO_HIPOSSUFICIENCIA:  'Declaração de Hipossuficiência',
  TEMPLATE_PROCURACAO_SIMPLES:           'Procuração Simples',
  TEMPLATE_CONTRATO_HONORARIOS_SIMPLES:  'Contrato de Honorários Simples',
  TEMPLATE_DECLARACAO_IRPF:             'Declaração de Isenção de IRPF',
  TEMPLATE_DECLARACAO_TESTEMUNHA:        'Declaração de Testemunha',
};

// ─── Templates que requerem formulário de testemunha ──────────────────────
const REQUER_TESTEMUNHA = new Set(['TEMPLATE_DECLARACAO_TESTEMUNHA']);

// ─── Ordem de exibição preferencial ──────────────────────────────────────
const ORDEM_PREFERENCIAL = [
  'TEMPLATE_PROCURACAO',
  'TEMPLATE_PROCURACAO_SIMPLES',
  'TEMPLATE_CONTRATO_HONORARIOS',
  'TEMPLATE_CONTRATO_HONORARIOS_SIMPLES',
  'TEMPLATE_DECLARACAO_HIPOSSUFICIENCIA',
  'TEMPLATE_DECLARACAO_IRPF',
  'TEMPLATE_DECLARACAO_TESTEMUNHA',
];

// ─── Extração de tags do arquivo .docx ───────────────────────────────────
function lerTagsDocx(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new PizZip(content);
    const tags = new Set<string>();

    const xmlPaths = [
      'word/document.xml',
      'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
      'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
    ];

    for (const xmlPath of xmlPaths) {
      try {
        const xml = zip.file(xmlPath)?.asText();
        if (!xml) continue;
        // Remove todas as tags XML, mantendo só o texto, depois procura padrão {TAG}
        const texto = xml.replace(/<[^>]+>/g, '');
        for (const m of texto.matchAll(/\{([A-Z][A-Z0-9_]{2,})\}/g)) {
          tags.add(m[1]);
        }
      } catch { /* arquivo XML não presente neste template */ }
    }

    return Array.from(tags);
  } catch {
    return [];
  }
}

// ─── Gera nome amigável a partir do ID do template ───────────────────────
function nomeAmigavel(templateId: string): string {
  if (NOMES[templateId]) return NOMES[templateId];
  return templateId
    .replace(/^TEMPLATE_/, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ─── Lista todos os templates da pasta ───────────────────────────────────
export function listarTemplates(): Template[] {
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) return [];

    const arquivos = fs.readdirSync(TEMPLATES_DIR)
      .filter(f => f.toLowerCase().endsWith('.docx'))
      .sort();

    const templates: Template[] = arquivos.map(arquivo => {
      const id = arquivo.replace(/\.docx$/i, '');
      const filePath = path.join(TEMPLATES_DIR, arquivo);
      const todasTags = lerTagsDocx(filePath);

      // Só expõe como campos de formulário as tags que não vêm do cliente nem da testemunha
      const tagsEspecificas: TagEspecifica[] = todasTags
        .filter(tag => !TAGS_CLIENTE.has(tag) && !TAGS_TESTEMUNHA.has(tag))
        .map(tag => {
          const meta = TAG_META[tag];
          return {
            tag,
            label: meta?.label ?? tag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            tipo: meta?.tipo ?? 'text',
          };
        });

      return {
        id,
        nome: nomeAmigavel(id),
        arquivo,
        requerTestemunha: REQUER_TESTEMUNHA.has(id),
        tagsEspecificas,
      };
    });

    // Ordena pelos preferidos primeiro, depois alfabético
    templates.sort((a, b) => {
      const ia = ORDEM_PREFERENCIAL.indexOf(a.id);
      const ib = ORDEM_PREFERENCIAL.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    return templates;
  } catch {
    return [];
  }
}

export function buscarTemplate(id: string): Template | null {
  return listarTemplates().find(t => t.id === id) || null;
}
