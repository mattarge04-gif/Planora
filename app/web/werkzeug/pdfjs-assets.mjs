// Kopiert cMaps, Standardschriften und die JS-Ersatzdecoder (ohne wasm) von pdfjs-dist nach public/pdfjs/
// (eigene Domain, CSP default-src 'self'). Kein wasm: die CSP erlaubt kein 'wasm-unsafe-eval' (useWasm: false in viewer/pdf.ts).
// Kein quickjs: PDFs laufen ohne Skriptausfuehrung (ADR 0022).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
const quelle = join(import.meta.dirname, "..", "node_modules", "pdfjs-dist");
const ziel = join(import.meta.dirname, "..", "public", "pdfjs");
rmSync(ziel, { recursive: true, force: true });
for (const ordner of ["cmaps", "standard_fonts"]) if (existsSync(join(quelle, ordner))) cpSync(join(quelle, ordner), join(ziel, ordner), { recursive: true });
const wasm = join(quelle, "wasm");
if (existsSync(wasm)) {
  mkdirSync(join(ziel, "wasm"), { recursive: true });
  for (const datei of readdirSync(wasm)) {
    if (/_nowasm_fallback\.js$/.test(datei) || (/^LICENSE_/.test(datei) && !/QUICKJS|QCMS/.test(datei))) cpSync(join(wasm, datei), join(ziel, "wasm", datei));
  }
}
console.log("pdfjs-Assets nach public/pdfjs kopiert");
