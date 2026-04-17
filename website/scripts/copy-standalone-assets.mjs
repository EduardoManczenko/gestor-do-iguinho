import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.join(__dirname, "..");
const nextDir = path.join(websiteRoot, ".next");
const standaloneDir = path.join(nextDir, "standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(standaloneDir)) {
  console.warn("[copy-standalone] Pasta .next/standalone não existe — pulando (dev ou build sem output standalone).");
  process.exit(0);
}

const staticSrc = path.join(nextDir, "static");
const staticDest = path.join(standaloneDir, ".next", "static");
copyDir(staticSrc, staticDest);

const publicSrc = path.join(websiteRoot, "public");
const publicDest = path.join(standaloneDir, "public");
copyDir(publicSrc, publicDest);

console.log("[copy-standalone] Assets copiados para .next/standalone.");
