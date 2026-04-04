'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { DadosCliente } from '@/lib/types';
import ClienteFormFields from '@/components/ClienteFormFields';
import DocumentScanner from '@/components/DocumentScanner';

export default function NovoClientePage() {
  const router = useRouter();
  const [dados, setDados] = useState<Partial<DadosCliente>>({});
  const [arquivosScanner, setArquivosScanner] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [camposPreenchidos, setCamposPreenchidos] = useState<string[]>([]);

  const atualizar = (campo: keyof DadosCliente, valor: string) => {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  };

  const onDadosExtraidos = (dadosNovos: Partial<DadosCliente>, arquivosSelecionados: string[]) => {
    setDados((prev) => {
      const merged = { ...prev };
      const novos: string[] = [];
      for (const [k, v] of Object.entries(dadosNovos)) {
        if (v) {
          (merged as Record<string, string>)[k] = v as string;
          novos.push(k);
        }
      }
      setCamposPreenchidos(novos);
      setTimeout(() => setCamposPreenchidos([]), 4000);
      return merged;
    });

    // Acumular arquivos selecionados (não duplicar)
    setArquivosScanner((prev) => [...new Set([...prev, ...arquivosSelecionados])]);
  };

  const salvar = async () => {
    if (!dados.NOME_CLIENTE?.trim()) {
      setErro('O nome do cliente é obrigatório.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dados, arquivosScanner }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      const cliente = await res.json();
      router.push(`/clientes/${cliente.id}`);
    } catch {
      setErro('Não foi possível salvar o cliente. Tente novamente.');
      setSalvando(false);
    }
  };

  const qtdPreenchidos = Object.values(dados).filter(Boolean).length;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/clientes" className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="page-title">Novo Cliente</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Preencha os dados abaixo ou importe de documentos escaneados
          </p>
        </div>
        {qtdPreenchidos > 0 && (
          <div className="badge badge-green text-sm px-3 py-1.5">
            {qtdPreenchidos} campo(s) preenchido(s)
          </div>
        )}
      </div>

      {/* Alerta de campos preenchidos */}
      {camposPreenchidos.length > 0 && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 animate-fade-in">
          <CheckCircle size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-emerald-700 text-sm mb-0.5">
              {camposPreenchidos.length} campo(s) preenchido(s) automaticamente!
            </div>
            <div className="text-xs text-emerald-600">
              Revise os dados abaixo e corrija qualquer informação incorreta.
            </div>
          </div>
        </div>
      )}

      {/* Aviso sobre documentos */}
      {arquivosScanner.length > 0 && (
        <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
          <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700">
            <strong>{arquivosScanner.length} documento(s)</strong> serão salvos na pasta deste cliente ao concluir o cadastro:
            <div className="mt-1 space-y-0.5">
              {arquivosScanner.map((a) => (
                <div key={a} className="font-mono">{a}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dica inicial */}
      {qtdPreenchidos === 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
          <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>Dica:</strong> Selecione um ou mais documentos (CNH, RG, certidões, comprovante de residência) 
            e clique em &ldquo;Escanear&rdquo; para preencher o formulário automaticamente. Você pode selecionar 
            vários documentos para completar todos os campos de uma vez.
          </p>
        </div>
      )}

      {/* Scanner */}
      <div className="mb-8">
        <DocumentScanner onDadosExtraidos={onDadosExtraidos} />
      </div>

      {/* Formulário */}
      <div className="card p-8">
        <ClienteFormFields dados={dados} onChange={atualizar} />
      </div>

      {/* Erro */}
      {erro && (
        <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{erro}</span>
        </div>
      )}

      {/* Ações */}
      <div className="mt-6 flex items-center justify-between">
        <Link href="/clientes" className="btn-ghost">
          <ArrowLeft size={16} />
          Cancelar
        </Link>
        <button onClick={salvar} disabled={salvando} className="btn-primary">
          {salvando ? (
            <><Loader2 size={16} className="animate-spin" />Salvando...</>
          ) : (
            <><Save size={16} />Salvar Cliente</>
          )}
        </button>
      </div>
    </div>
  );
}
