// Erzeugt die Test-PDFs aus dokumente/*.html nach pdf/ (git-ignoriert). Aufruf: node werkzeug/preisdokument/erzeuge.mjs
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));

/** Sucht ein Playwright-Modul, dessen Chromium auch installiert ist (npx-Cache kann mehrere Versionen enthalten). */
async function ladePlaywright() {
  const kandidaten = [];
  if (process.env.PLAYWRIGHT_MODUL) kandidaten.push(process.env.PLAYWRIGHT_MODUL);
  const cache = join(process.env.LOCALAPPDATA ?? join(process.env.HOME ?? "", ".npm"), "npm-cache", "_npx");
  if (existsSync(cache)) for (const d of readdirSync(cache)) {
    const p = join(cache, d, "node_modules", "playwright", "index.mjs");
    if (existsSync(p)) kandidaten.push(p);
  }
  for (const p of kandidaten) {
    const modul = await import(pathToFileURL(p).href);
    try { if (existsSync(modul.chromium.executablePath())) return modul; } catch { /* naechster Kandidat */ }
  }
  throw new Error("Kein Playwright mit installiertem Chromium gefunden. Einmalig: npx -y playwright@1.65.0 install chromium  (oder PLAYWRIGHT_MODUL=<pfad zu playwright/index.mjs>)");
}

const aus = join(hier, "pdf");
mkdirSync(aus, { recursive: true });
const { chromium } = await ladePlaywright();
const browser = await chromium.launch({ headless: true });
try {
  for (const datei of readdirSync(join(hier, "dokumente")).filter((d) => d.endsWith(".html")).sort()) {
    const name = datei.replace(/\.html$/, "");
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(join(hier, "dokumente", datei)).href);
    await page.evaluate(() => document.fonts.ready);
    if (name === "o5-scan") {
      // Bild-PDF ohne Textschicht: Screenshot, dann Seite mit nur diesem Bild drucken.
      const png = await page.screenshot({ fullPage: true });
      await page.setContent(`<!doctype html><html><body style="margin:0"><img style="display:block;width:100%;max-height:1100px;object-fit:cover;object-position:top" src="data:image/png;base64,${png.toString("base64")}"></body></html>`);
    }
    await page.pdf({ path: join(aus, `${name}.pdf`), format: "A4", printBackground: true });
    await page.close();
    console.log(`${name}.pdf  ${(statSync(join(aus, `${name}.pdf`)).size / 1024).toFixed(1)} KB`);
  }
} finally { await browser.close(); }
