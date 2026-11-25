// Abnahmedateien Anlagenakte nach dateien/ (git-ignoriert). Aufruf: node werkzeug/anlagenakte/erzeuge.mjs
// datenblatt-pumpe.pdf (2 Seiten, Seite 2 mit "Förderhöhe 6.5 m"), foto-zentrale.png, kosten.xlsx (minimales SpreadsheetML),
// o1-pumpen.pdf (Kopie aus werkzeug/preisdokument/pdf; fehlt sie, vorher node werkzeug/preisdokument/erzeuge.mjs).
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crc32 } from "node:zlib";

const hier = dirname(fileURLToPath(import.meta.url));
const aus = join(hier, "dateien");
mkdirSync(aus, { recursive: true });

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

const DATENBLATT = `<!doctype html><html lang="de-CH"><meta charset="utf-8"><style>
body{font:14px/1.5 Arial,sans-serif;margin:48px;color:#1d2430} h1{font-size:22px} table{border-collapse:collapse} td{border:1px solid #bbb;padding:4px 10px}
.s{page-break-after:always}</style>
<section class="s"><h1>Datenblatt Umwälzpumpe Muster UP 32-60</h1><p>Hocheffizienz-Nassläuferpumpe für Heizungsanlagen.</p>
<table><tr><td>Hersteller</td><td>Musterpumpen AG</td></tr><tr><td>Typ</td><td>UP 32-60</td></tr><tr><td>Anschluss</td><td>DN 32</td></tr></table></section>
<section><h1>Technische Daten</h1><table><tr><td>Förderhöhe 6.5 m</td></tr><tr><td>Leistungsaufnahme 45 W</td></tr><tr><td>Nennweite DN 32</td></tr></table></section></html>`;

const FOTO = `<!doctype html><html><body style="margin:0;width:800px;height:600px;background:linear-gradient(160deg,#cfd6dd,#8b97a3);font:28px Arial;color:#fff">
<div style="position:absolute;left:120px;top:180px;width:220px;height:300px;background:#e9edf0;border-radius:8px"></div>
<div style="position:absolute;left:420px;top:260px;width:260px;height:80px;background:#b54a3a"></div>
<div style="position:absolute;left:40px;top:40px">Foto Zentrale</div></body></html>`;

const { chromium } = await ladePlaywright();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(DATENBLATT);
  await page.pdf({ path: join(aus, "datenblatt-pumpe.pdf"), format: "A4", printBackground: true });
  await page.setContent(FOTO);
  await page.screenshot({ path: join(aus, "foto-zentrale.png") });
} finally {
  await browser.close();
}

// kosten.xlsx: ZIP mit gespeicherten (unkomprimierten) Eintraegen
const teile = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Kosten" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Position</t></is></c><c r="B1" t="inlineStr"><is><t>CHF</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Pumpe</t></is></c><c r="B2"><v>480</v></c></row></sheetData></worksheet>`,
};
const lokal = [], zentral = [];
let versatz = 0;
for (const [name, text] of Object.entries(teile)) {
  const n = Buffer.from(name), d = Buffer.from(text), crc = crc32(d);
  const kopf = Buffer.alloc(30);
  kopf.writeUInt32LE(0x04034b50, 0); kopf.writeUInt16LE(20, 4); kopf.writeUInt32LE(crc, 14);
  kopf.writeUInt32LE(d.length, 18); kopf.writeUInt32LE(d.length, 22); kopf.writeUInt16LE(n.length, 26);
  const z = Buffer.alloc(46);
  z.writeUInt32LE(0x02014b50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt32LE(crc, 16);
  z.writeUInt32LE(d.length, 20); z.writeUInt32LE(d.length, 24); z.writeUInt16LE(n.length, 28); z.writeUInt32LE(versatz, 42);
  lokal.push(kopf, n, d); zentral.push(z, n);
  versatz += 30 + n.length + d.length;
}
const zLaenge = zentral.reduce((s, b) => s + b.length, 0);
const ende = Buffer.alloc(22);
ende.writeUInt32LE(0x06054b50, 0); ende.writeUInt16LE(zentral.length / 2, 8); ende.writeUInt16LE(zentral.length / 2, 10);
ende.writeUInt32LE(zLaenge, 12); ende.writeUInt32LE(versatz, 16);
writeFileSync(join(aus, "kosten.xlsx"), Buffer.concat([...lokal, ...zentral, ende]));

const o1 = join(hier, "..", "preisdokument", "pdf", "o1-pumpen.pdf");
if (!existsSync(o1)) throw new Error(`${o1} fehlt: vorher node werkzeug/preisdokument/erzeuge.mjs`);
copyFileSync(o1, join(aus, "o1-pumpen.pdf"));
console.log(`Erzeugt in ${aus}: ${readdirSync(aus).join(", ")}`);
