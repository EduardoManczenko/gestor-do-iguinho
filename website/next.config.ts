import type { NextConfig } from "next";
import path from "path";

// Diretório do app Next (evita inferência de monorepo pelo lockfile na raiz do repo).
const websiteRoot = path.resolve(process.cwd());
const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  turbopack: {
    root: websiteRoot,
  },
  outputFileTracingRoot: websiteRoot,
  // Standalone só para o instalador Electron; na Vercel o deploy é serverless padrão.
  ...(!isVercel ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["pdf-parse", "mammoth", "sharp", "canvas"],
};

export default nextConfig;
