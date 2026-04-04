'use client';

import { DadosCliente } from '@/lib/types';
import { ESTADO_CIVIL_OPCOES, NACIONALIDADE_OPCOES, DOCUMENTO_TIPO_OPCOES } from '@/lib/utils';

interface Props {
  dados: Partial<DadosCliente>;
  onChange: (campo: keyof DadosCliente, valor: string) => void;
  readonly?: boolean;
}

function FieldGroup({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{titulo}</span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  campo,
  dados,
  onChange,
  tipo = 'text',
  placeholder,
  opcoes,
  datalist,
  readonly,
  fullWidth,
}: {
  label: string;
  campo: keyof DadosCliente;
  dados: Partial<DadosCliente>;
  onChange: (campo: keyof DadosCliente, valor: string) => void;
  tipo?: string;
  placeholder?: string;
  opcoes?: string[];
  datalist?: string[];
  readonly?: boolean;
  fullWidth?: boolean;
}) {
  const valor = (dados[campo] as string) || '';
  const datalistId = datalist ? `datalist-${campo}` : undefined;

  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <label className="label-field">{label}</label>
      {opcoes ? (
        <select
          value={valor}
          onChange={(e) => onChange(campo, e.target.value)}
          disabled={readonly}
          className="input-field"
        >
          <option value="">Selecionar...</option>
          {opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            type={tipo}
            value={valor}
            onChange={(e) => onChange(campo, e.target.value)}
            disabled={readonly}
            placeholder={placeholder || label}
            className="input-field"
            list={datalistId}
          />
          {datalist && datalistId && (
            <datalist id={datalistId}>
              {datalist.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          )}
        </>
      )}
    </div>
  );
}

export default function ClienteFormFields({ dados, onChange, readonly }: Props) {
  return (
    <div className="space-y-8">
      <FieldGroup titulo="Dados Básicos">
        <Field label="Nome Completo" campo="NOME_CLIENTE" dados={dados} onChange={onChange} placeholder="Nome completo do cliente" readonly={readonly} fullWidth />
        <Field label="Nacionalidade" campo="NACIONALIDADE_CLIENTE" dados={dados} onChange={onChange} datalist={NACIONALIDADE_OPCOES} placeholder="Ex: BRASILEIRO(A)" readonly={readonly} />
        <Field label="Estado Civil" campo="ESTADO_CIVIL_CLIENTE" dados={dados} onChange={onChange} opcoes={ESTADO_CIVIL_OPCOES} readonly={readonly} />
        <Field label="Profissão" campo="PROFISSAO_CLIENTE" dados={dados} onChange={onChange} placeholder="Ex: Advogado, Médico..." readonly={readonly} />
        <Field label="CPF" campo="CPF_CLIENTE" dados={dados} onChange={onChange} placeholder="000.000.000-00" readonly={readonly} />
        <Field label="Telefone" campo="TELEFONE_CLIENTE" dados={dados} onChange={onChange} placeholder="(00) 00000-0000" readonly={readonly} />
      </FieldGroup>

      <FieldGroup titulo="Endereço">
        <Field label="Logradouro (Rua/Av.)" campo="LOGRADOURO_CLIENTE" dados={dados} onChange={onChange} placeholder="Ex: Rua das Flores" readonly={readonly} fullWidth />
        <Field label="Número" campo="NUMERO_CLIENTE" dados={dados} onChange={onChange} placeholder="Ex: 123" readonly={readonly} />
        <Field label="Complemento" campo="COMPLEMENTO_CLIENTE" dados={dados} onChange={onChange} placeholder="Ex: Apto 45" readonly={readonly} />
        <Field label="Bairro" campo="BAIRRO_CLIENTE" dados={dados} onChange={onChange} placeholder="Ex: Centro" readonly={readonly} />
        <Field label="Cidade" campo="CIDADE_CLIENTE" dados={dados} onChange={onChange} placeholder="Ex: São Paulo" readonly={readonly} />
        <Field label="CEP" campo="CEP_CLIENTE" dados={dados} onChange={onChange} placeholder="00000-000" readonly={readonly} />
      </FieldGroup>

      <FieldGroup titulo="Filiação">
        <Field label="Nome da Mãe" campo="NOME_MAE_CLIENTE" dados={dados} onChange={onChange} placeholder="Nome completo da mãe" readonly={readonly} fullWidth />
        <Field label="Nome do Pai" campo="NOME_PAI_CLIENTE" dados={dados} onChange={onChange} placeholder="Nome completo do pai" readonly={readonly} fullWidth />
        <Field label="Naturalidade" campo="NATURALIDADE_CLIENTE" dados={dados} onChange={onChange} placeholder="Ex: São Paulo - SP" readonly={readonly} />
        <Field label="Data de Nascimento" campo="DATA_NASCIMENTO_CLIENTE" dados={dados} onChange={onChange} tipo="date" readonly={readonly} />
      </FieldGroup>

      <FieldGroup titulo="Documento Alternativo (RG / CNH)">
        <Field label="Tipo de Documento" campo="DOCUMENTO_TIPO_CLIENTE" dados={dados} onChange={onChange} opcoes={DOCUMENTO_TIPO_OPCOES} readonly={readonly} />
        <Field label="Número do Documento" campo="DOCUMENTO_NUMERO_CLIENTE" dados={dados} onChange={onChange} placeholder="Número" readonly={readonly} />
        <Field label="Órgão Expedidor" campo="DOCUMENTO_ORGAO_CLIENTE" dados={dados} onChange={onChange} placeholder="Ex: SSP/SP" readonly={readonly} />
      </FieldGroup>
    </div>
  );
}
