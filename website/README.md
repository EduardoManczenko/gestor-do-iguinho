# Gestor Jurídico

Sistema de gestão de clientes e geração de contratos jurídicos (app **desktop** neste repositório).

**Site público / download na web:** repositório separado `lp-pro-guinho` (Next.js na Vercel).

## Distribuição (Windows)

1. Atualiza a versão em `package.json` (raiz do repo) se necessário.
2. Gera o instalador: `npm run dist:win` → ficheiro em `dist-app/` com o nome **`Gestor.Juridico.Setup.<versão>.exe`** (definido em `build.win.artifactName`).
3. No GitHub: **Releases → New release** — tag `v<versão>` (ex.: `v1.0.1`), anexa esse `.exe` e publica. O link “última versão” do site usa `releases/latest/download/Gestor.Juridico.Setup.<versão>.exe`; na Vercel podes definir `NEXT_PUBLIC_INSTALLER_VERSION` ou `NEXT_PUBLIC_WINDOWS_INSTALLER_URL` se o nome mudar.

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
