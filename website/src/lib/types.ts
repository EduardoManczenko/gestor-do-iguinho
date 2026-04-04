export interface DadosCliente {
  NOME_CLIENTE: string;
  NACIONALIDADE_CLIENTE: string;
  ESTADO_CIVIL_CLIENTE: string;
  PROFISSAO_CLIENTE: string;
  CPF_CLIENTE: string;
  TELEFONE_CLIENTE: string;

  LOGRADOURO_CLIENTE: string;
  NUMERO_CLIENTE: string;
  COMPLEMENTO_CLIENTE: string;
  BAIRRO_CLIENTE: string;
  CIDADE_CLIENTE: string;
  CEP_CLIENTE: string;

  NOME_MAE_CLIENTE: string;
  NOME_PAI_CLIENTE: string;
  NATURALIDADE_CLIENTE: string;
  DATA_NASCIMENTO_CLIENTE: string;

  DOCUMENTO_TIPO_CLIENTE: string;
  DOCUMENTO_NUMERO_CLIENTE: string;
  DOCUMENTO_ORGAO_CLIENTE: string;
}

export interface Contrato {
  id: string;
  template: string;
  nomeTemplate: string;
  criadoEm: string;
  dadosExtras: Record<string, string>;
  arquivoDOCX: string;
  clienteId: string;
}

export interface Cliente {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  dados: Partial<DadosCliente>;
  contratos: Contrato[];
  documentos: string[]; // caminhos relativos dos documentos salvos
}

export interface Template {
  id: string;
  nome: string;
  arquivo: string;
  tagsEspecificas: TagEspecifica[];
  requerTestemunha: boolean;
}

export interface TagEspecifica {
  tag: string;
  label: string;
  tipo: 'text' | 'number' | 'date' | 'select';
  opcoes?: string[];
}

export interface DadosTestemunha {
  NOME_TESTEMUNHA: string;
  CPF_TESTEMUNHA: string;
  NACIONALIDADE_TESTEMUNHA: string;
  ESTADO_CIVIL_TESTEMUNHA: string;
  PROFISSAO_TESTEMUNHA: string;
  LOGRADOURO_TESTEMUNHA: string;
  NUMERO_TESTEMUNHA: string;
  BAIRRO_TESTEMUNHA: string;
  CIDADE_TESTEMUNHA: string;
  CEP_TESTEMUNHA: string;
  TELEFONE_TESTEMUNHA: string;
}

export interface PessoaCertidao {
  nome: string;
  naturalidade?: string;
  dataNascimento?: string;
  nacionalidade?: string;
  nomePai?: string;
  nomeMae?: string;
  papel: 'ele' | 'ela' | 'filho' | 'filha';
}

export interface ResultadoExtracao {
  sucesso: boolean;
  dados: Partial<DadosCliente>;
  confianca: 'alta' | 'media' | 'baixa';
  mensagem?: string;
  tipoDocumento?: string;
  pessoasCertidao?: PessoaCertidao[];
}
