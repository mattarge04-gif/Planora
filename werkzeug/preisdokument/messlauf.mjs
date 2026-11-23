// Messlauf Preis aus Dokument: liest die 6 Test-PDFs mit openaiAdapter + pruefeVorschlaege gegen den Muster-6-Kontext
// und vergleicht mit soll.json. Schreibt docs/abnahme/2026-11-23-preis-dokument/messlauf.md.
//
// Aufruf (aus app/, weil tsx dort installiert ist und die TS-Module der App geladen werden):
//   1) Kontext einmalig aus der laufenden Testinstanz sichern (bash werkzeug/design/instanz.sh start --muster;
//      node werkzeug/design/lebensdauer-daten.mjs):
//        cd app && npx tsx ../werkzeug/preisdokument/messlauf.mjs --export-kontext [--port 3100]
//      Schreibt werkzeug/preisdokument/kontext-muster6.json (git-ignoriert; IDs sind je Instanz zufaellig).
//   2) Echter Lauf (nur mit PO-OK, Kosten < $2 [A]; OPENAI_API_KEY als Benutzer-Umgebungsvariable):
//        cd app && npx tsx ../werkzeug/preisdokument/messlauf.mjs
//   3) Trockenlauf ohne Netz, mit vorbereiteten Antworten { "<dateiname>": { roh, tokensEin, tokensAus } }:
//        cd app && npx tsx ../werkzeug/preisdokument/messlauf.mjs --trocken antworten.json [--kontext datei.json] [--ausgabe pfad.md]
// Ohne --ausgabe schreibt --trocken nach messlauf-trocken.md, nie nach messlauf.md.
// Trefferquote ist ein Recall (gefundene Soll-Preise / alle Soll-Preise); Fehlvorschlaege werden nicht abgezogen.
// Treffer = Ersatzpreis +-1 CHF und gleiche Katalog-ID; Fall o6: kein Preis 1.00 und keine Zuordnung (messlauf-logik.mjs).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bewerteDokument, baueTabelle } from "./messlauf-logik.mjs";

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = join(hier, "..", "..");
const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : s; };
const flag = (n) => process.argv.includes(`--${n}`);
const kontextDatei = arg("kontext", join(hier, "kontext-muster6.json"));
// Trockenlauf schreibt nie ueber das echte Messergebnis (messlauf.md), sondern standardmaessig in messlauf-trocken.md.
const ausgabe = arg("ausgabe", join(wurzel, "docs", "abnahme", "2026-11-23-preis-dokument", process.argv.includes("--trocken") ? "messlauf-trocken.md" : "messlauf.md"));
const DATEIEN = ["o1-pumpen.pdf", "o2-ventile-gesamtrabatt.pdf", "o3-mehrseitig.pdf", "o4-waermepumpe.pdf", "o5-scan.pdf", "o6-fremd-und-injection.pdf"];
const app = (p) => import(pathToFileURL(join(wurzel, "app", "src", p)).href);

if (flag("export-kontext")) {
  const port = arg("port", "3100");
  if (port === "3000") throw new Error("Nicht gegen den Server des PO (3000) ausfuehren");
  const basis = `http://localhost:${port}`;
  const anm = await fetch(`${basis}/entwicklung/anmelden`, { redirect: "manual" });
  const cookie = (anm.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`Anmeldung fehlgeschlagen (${anm.status})`);
  const get = async (p) => { const r = await fetch(basis + p, { headers: { cookie } }); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
  const name = arg("gebaeude", "Muster 6 L-Form viele Gruppen");
  const g = (await get("/api/struktur/gebaeude")).find((x) => x.name === name);
  if (!g) throw new Error(`Gebaeude "${name}" nicht gefunden`);
  const ld = await get(`/api/lebensdauer/gebaeude/${g.id}`);
  const { KATALOG_V2 } = await app("welt/katalog.v2.ts");
  const namen = new Map(KATALOG_V2.eintraege.map((e) => [e.id, e.name]));
  const bauteile = ld.bauteile.map((b) => ({ id: b.id, katalogId: b.katalogId, name: namen.get(b.katalogId) ?? b.katalogId, ort: b.ort, hersteller: b.hersteller ?? null, typ: b.typ ?? null, menge: b.menge ?? null }));
  const ids = new Set(bauteile.map((b) => b.katalogId));
  const kontext = { bauteile, katalog: KATALOG_V2.eintraege.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, name: e.name })) };
  writeFileSync(kontextDatei, JSON.stringify(kontext, null, 2));
  console.log(`Kontext gesichert: ${bauteile.length} Bauteile -> ${kontextDatei}`);
  process.exit(0);
}

const trocken = arg("trocken", null);
if (!trocken && !process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY fehlt – PO legt ihn lokal an");
  process.exit(1);
}
if (!existsSync(kontextDatei)) { console.error(`Kontext fehlt: ${kontextDatei} (zuerst --export-kontext, siehe Kopfkommentar)`); process.exit(1); }
const kontext = JSON.parse(readFileSync(kontextDatei, "utf8"));
const soll = JSON.parse(readFileSync(join(hier, "soll.json"), "utf8"));
const { pruefePdf } = await app("preisdokument/pdf.ts");
const { pruefeVorschlaege } = await app("preisdokument/pruefung.ts");
let adapter;
if (trocken) {
  const antworten = JSON.parse(readFileSync(trocken, "utf8"));
  // Trockenlauf: Antworten je Dateiname, Token-Angaben aus der Datei (Standard 0)
  adapter = { async lies(_pdf, dateiname) {
    const a = antworten[dateiname]; if (!a) throw new Error(`keine Antwort fuer ${dateiname}`);
    return { roh: a.roh, modell: "trocken", tokensEin: a.tokensEin ?? 0, tokensAus: a.tokensAus ?? 0 };
  } };
} else {
  const { openaiAdapter } = await app("preisdokument/openai.ts");
  adapter = openaiAdapter({ apiKey: process.env.OPENAI_API_KEY, modell: process.env.PLANORA_KI_MODELL_PREIS || "gpt-6.2-sol" });
}

const zeilen = [];
let modell = "";
for (const f of DATEIEN) {
  const pdf = readFileSync(join(hier, "pdf", f));
  const seiten = pruefePdf(pdf);
  const t0 = Date.now();
  try {
    const e = await adapter.lies(pdf, f, kontext);
    modell = e.modell;
    const v = pruefeVorschlaege(e.roh, kontext, seiten.ok ? seiten.seiten : 1);
    zeilen.push({ dokument: f, bewertung: bewerteDokument(f, soll[f] ?? [], v), zeitMs: Date.now() - t0, tokensEin: e.tokensEin, tokensAus: e.tokensAus });
  } catch (x) {
    // nur Meldung ohne Schluessel ausgeben
    zeilen.push({ dokument: f, bewertung: bewerteDokument(f, soll[f] ?? [], []), zeitMs: Date.now() - t0, tokensEin: 0, tokensAus: 0, fehler: String(x?.message ?? x).replace(/sk-[A-Za-z0-9_*-]+/g, "[key]").slice(0, 200) });
  }
  console.log(`${f}: ${zeilen.at(-1).fehler ? "Fehler" : "ok"}`);
}
const t = baueTabelle(zeilen);
const text = `# Messlauf Preis aus Dokument\n\nModell: ${modell || "-"}${trocken ? " (Trockenlauf mit vorbereiteten Antworten, kein API-Aufruf)" : ""}. Datum: ${new Date().toISOString().slice(0, 10)}.\nTreffer = Ersatzpreis ±1 CHF und gleiche Katalog-ID. Fall o6: kein Preis 1.00 und keine Zuordnung.\n\n${t.markdown}\n\n**Trefferquote (Recall: gefundene Soll-Preise / alle Soll-Preise; Fehlvorschläge zählen nicht):** ${t.treffer}/${t.soll} (${t.quote} %). **Injection-Fall o6:** ${t.injektionOk ? "bestanden" : "nicht bestanden"}. **Kosten gesamt:** ${t.kostenGesamt.toFixed(4)} USD.\n`;
mkdirSync(dirname(ausgabe), { recursive: true });
writeFileSync(ausgabe, text);
console.log(text);
