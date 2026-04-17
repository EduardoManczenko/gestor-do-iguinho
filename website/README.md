# Gestor Jurídico

Sistema de gestão de clientes e geração de contratos jurídicos (app **desktop** neste repositório).

**Site público / download na web:** repositório separado `lp-pro-guinho` (Next.js na Vercel).

## Distribuição (Windows)

1. Atualiza a versão em `package.json` (raiz do repo), por exemplo `1.0.2`.
2. Commit e push para `main`.
3. Cria e envia a tag (a versão da tag deve coincidir com a do `package.json`, **sem** o `v`):
   ```bash
   git tag v1.0.2
   git push origin v1.0.2
   ```
4. O GitHub Actions (`.github/workflows/release-windows.yml`) gera o instalador e publica o ficheiro **`Gestor.Juridico.Setup.<versão>.exe`** no Release dessa tag (torna-se o *latest*).
5. No repo **`lp-pro-guinho`**, atualiza o campo **`installerVersion`** no `package.json` para a mesma versão e faz deploy na Vercel (sem `.env`).

**Local:** `npm run dist:win` → saída em `dist-app/`.

## Requisitos

- Node.js 18+
- npm

## Instalação

```bash
npm install
```

## Executar

```bash
npm run dev
```

Acesse: http://localhost:3000

## Estrutura de Dados

Todos os dados são salvos **localmente** na pasta `../data/` (relativa ao projeto website):

```
gestor-do-iguinho/
├── data/
│   └── clientes/
│       └── {uuid-cliente}/
│           ├── dados.json          ← Dados do cliente
│           └── contratos/
│               └── {uuid-contrato}/
│                   └── TEMPLATE_XXX.docx
├── contratos-template/             ← Templates Word (.docx)
├── scanner/                        ← Documentos para escanear
└── website/                        ← Este projeto
```

## Funcionalidades

### Clientes
- Cadastro com leitura automática de documentos (OCR)
- Suporte a: CNH, RG, Certidão de Nascimento, Certidão de Casamento, Comprovante de Residência, Declaração de Residência
- Lista com busca por nome, CPF ou cidade
- Edição e exclusão de clientes

### Contratos
- 7 modelos disponíveis
- Preenchimento automático com dados do cliente
- Download em formato DOCX
- Histórico de contratos por cliente

## Documentos Suportados para OCR

Coloque os documentos na pasta `scanner/` e eles aparecerão no sistema para leitura automática.

Formatos suportados: PDF (incluindo documentos escaneados), JPG, PNG.
