import type { NextConfig } from "next";
import path from "path";

// Diretório do app Next (evita inferência de monorepo pelo lockfile na raiz do repo).
const websiteRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: websiteRoot,
  },
  outputFileTracingRoot: websiteRoot,
  serverExternalPackages: ["pdf-parse", "mammoth", "sharp", "canvas"],
};

export default nextConfig;
