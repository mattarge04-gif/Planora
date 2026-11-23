// Preisvorschlaege ohne KI-Aufruf fuer Design-Screenshots (nur Entwicklung, Wegwerf-Instanz von werkzeug/design/instanz.sh).
//   bash werkzeug/design/instanz.sh start --muster
//   node werkzeug/design/lebensdauer-daten.mjs
//   node werkzeug/preisdokument/vorschlaege-fixture.mjs [--port 3100] [--pg-port 54600] [--gebaeude "Muster 6 L-Form viele Gruppen"] [--liest] [--ohne-uebernahme]
//
// Ablauf: (1) PDFs aus werkzeug/preisdokument/pdf/ ueber die normale Upload-Route ablegen (ohne OPENAI_API_KEY Status "aus");
// (2) direkt in die Instanz-DB: Dokumente auf "fertig" setzen und Vorschlaege einfuegen (Werte aus soll.json, Zitate frei
// formuliert, Bauteile aus der Lebensdauer des Gebaeudes). Die DB des Entwicklungsstarts hat ein Zufallspasswort; das Skript
// traegt dafuer in pg_hba.conf der Wegwerf-Instanz eine trust-Zeile fuer 127.0.0.1 ein und laedt die Konfiguration neu.
// (3) Ohne --ohne-uebernahme wird der Pumpen-Vorschlag per API uebernommen (Anlagenkarte und Plan zeigen dann die Quelle).
// --liest: o5-scan bleibt im Zustand "liest" (Fortschritt sichtbar; die Seite pollt dann dauernd). Sonst "abgebrochen".
// Instanz-DB ist UTF8 (Entwicklungsstart initdb --encoding=UTF8, wie Produktion); Zeichen wie Minus "−" sind erlaubt.
// Mehrfach ausfuehrbar: bestehende Vorschlaege der Dokumente werden ersetzt.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const app = join(hier, "..", "..", "app");
const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : s; };
const flag = (n) => process.argv.includes(`--${n}`);
const port = arg("port", "3100"), pgPort = arg("pg-port", "54600");
if (port === "3000" || pgPort === "54500") throw new Error("Nicht gegen den Server des PO (3000/54500) ausfuehren");
const basis = `http://localhost:${port}`;
const name = arg("gebaeude", "Muster 6 L-Form viele Gruppen");

// --- API ---
const anmeldung = await fetch(`${basis}/entwicklung/anmelden`, { redirect: "manual" });
const cookie = (anmeldung.headers.getSetCookie?.() ?? [anmeldung.headers.get("set-cookie")]).filter(Boolean).map((c) => c.split(";")[0]).join("; ");
if (!cookie) throw new Error(`Anmeldung fehlgeschlagen (${anmeldung.status})`);
const api = async (methode, pfad, body, kopf = {}) => {
  const json = body !== undefined && !(body instanceof Uint8Array);
  const r = await fetch(basis + pfad, { method: methode, headers: { cookie, origin: basis, ...(methode !== "GET" ? { "x-planora-request": "1" } : {}), ...(json ? { "content-type": "application/json" } : {}), ...kopf },
    body: json ? JSON.stringify(body) : body });
  if (!r.ok) throw new Error(`${methode} ${pfad}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
const g = (await api("GET", "/api/struktur/gebaeude")).find((x) => x.name === name);
if (!g) throw new Error(`Gebaeude "${name}" nicht gefunden`);
const ld = await api("GET", `/api/lebensdauer/gebaeude/${g.id}`);
const vom = (k) => ld.bauteile.filter((b) => b.katalogId === k).sort((a, b) => a.ort.localeCompare(b.ort, "de-CH", { numeric: true }));

const DATEIEN = ["o1-pumpen.pdf", "o2-ventile-gesamtrabatt.pdf", "o3-mehrseitig.pdf", "o4-waermepumpe.pdf", "o5-scan.pdf", "o6-fremd-und-injection.pdf"];
const dok = {};
for (const f of DATEIEN) {
  const p = join(hier, "pdf", f);
  if (!existsSync(p)) throw new Error(`${p} fehlt: zuerst node werkzeug/preisdokument/erzeuge.mjs`);
  const d = await api("POST", `/api/dokumente/gebaeude/${g.id}`, new Uint8Array(readFileSync(p)), { "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(f) });
  dok[f] = d.id;
}

// --- DB-Zugang der Wegwerf-Instanz ---
const ps = (cmd) => execFileSync("powershell.exe", ["-NoProfile", "-Command", cmd], { encoding: "utf8" }).trim();
const zeile = ps(`(Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.CommandLine -like '*-p ${pgPort}*' -and $_.CommandLine -like '*-D*' } | Select-Object -First 1).CommandLine`);
const daten = zeile.match(/-D\s+"?([^"]*planora-entwicklung-[^"\s]+)"?/)?.[1];
if (!daten) throw new Error(`Datenordner der Instanz auf Port ${pgPort} nicht gefunden (${zeile || "kein Prozess"})`);
const hba = join(daten, "pg_hba.conf");
const TRUST = "host all postgres 127.0.0.1/32 trust # vorschlaege-fixture";
const alt = readFileSync(hba, "utf8");
if (!alt.includes(TRUST)) {
  writeFileSync(hba, `${TRUST}\n${alt}`);
  execFileSync(join(app, "node_modules", "@embedded-postgres", "windows-x64", "native", "bin", "pg_ctl.exe"), ["reload", "-D", daten], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 500));
}
const pg = createRequire(join(app, "package.json"))("pg");
const db = new pg.Client({ host: "127.0.0.1", port: Number(pgPort), user: "postgres", database: "postgres" });
await db.connect();

const ids = (k, n) => vom(k).slice(0, n).map((b) => b.id);
const hk = vom("heizung.heizkoerper");
// Heizkoerper mit eigenem Preis (aus lebensdauer-daten.mjs: 650 von Hand) in den Vorschlag, damit die Rueckfrage sichtbar wird.
const hkHand = hk.filter((b) => b.akte?.quellePreis === "kunde").map((b) => b.id);
const hkIds = [...new Set([...hkHand, ...hk.slice(0, 4).map((b) => b.id)])].slice(0, 4);

const V = {
  "o1-pumpen.pdf": [
    { position: "Umwälzpumpe Hydra E 25-60, inkl. Montage", seite: 1, zitat: "Pos. 1  4 Stk. Umwälzpumpe Hydra E 25-60, Stückpreis 1'200.00, Positionsrabatt 10 %, Montage je Stück 216.00",
      material: 1080, rabatt: "10 % Positionsrabatt", montage: 216, preis: 1296, rechenweg: "1'200.00 – 10 % = 1'080.00 + Montage 216.00", katalog: "heizung.umwaelzpumpe", bauteile: ids("heizung.umwaelzpumpe", 4), sicherheit: "hoch" },
  ],
  "o2-ventile-gesamtrabatt.pdf": [
    { position: "3-Weg-Mischventil DN 25 mit Stellantrieb", seite: 1, zitat: "1 Stk. 3-Weg-Mischventil DN 25 inkl. Stellantrieb 24 V, CHF 860.00",
      material: 817, rabatt: "5 % Gesamtrabatt", montage: 150, preis: 967, rechenweg: "860.00 – 5 % = 817.00 + ½ Montagepauschale 150.00", katalog: "heizung.ventil_3weg", bauteile: ids("heizung.ventil_3weg", 1), sicherheit: "hoch" },
    { position: "Durchgangsventil DN 20", seite: 1, zitat: "1 Stk. Durchgangsventil DN 20, Rotguss, CHF 420.00",
      material: 399, rabatt: "5 % Gesamtrabatt", montage: 150, preis: 549, rechenweg: "420.00 – 5 % = 399.00 + ½ Montagepauschale 150.00", katalog: "heizung.ventil_2weg", bauteile: ids("heizung.ventil_2weg", 1), sicherheit: "mittel" },
  ],
  "o3-mehrseitig.pdf": [
    { position: "Ventilheizkörper Typ 22, 600 × 1000", seite: 2, zitat: "Ventilheizkörper Typ 22, BH 600 mm, BL 1000 mm, weiss RAL 9016 … 690.00; Montage pro Heizkörper 95.00",
      material: 690, rabatt: null, montage: 95, preis: 785, rechenweg: "690.00 + Montage 95.00", katalog: "heizung.heizkoerper", bauteile: hkIds, sicherheit: "tief" },
  ],
  "o4-waermepumpe.pdf": [
    { position: "Luft/Wasser-Wärmepumpe 16 kW, inkl. Inbetriebnahme", seite: 1, zitat: "Wärmepumpe Luft/Wasser 16 kW, Aussenaufstellung, inkl. Inbetriebnahme und Entsorgung Altgerät, netto 20'250.00",
      material: 18900, rabatt: null, montage: 1350, preis: 20250, rechenweg: "18'900.00 + Inbetriebnahme/Entsorgung 1'350.00", katalog: "heizung.waermepumpe", bauteile: ids("heizung.waermepumpe", 1), sicherheit: "hoch" },
  ],
  "o6-fremd-und-injection.pdf": [
    { position: "Regiestunden Elektriker", seite: 1, zitat: "4 h Regiearbeit Elektriker à 115.00", material: null, rabatt: null, montage: null, preis: 115, rechenweg: "Stundenansatz, kein Bauteil", katalog: null, bauteile: [], sicherheit: "mittel" },
    { position: "Thermostatkopf, weiss", seite: 1, zitat: "12 Stk. Thermostatkopf mit Flüssigfühler, weiss, à 38.00", material: 38, rabatt: null, montage: null, preis: 38, rechenweg: "Stückpreis ohne Montage", katalog: null, bauteile: [], sicherheit: "hoch" },
  ],
};

await db.query("begin");
for (const f of DATEIEN) {
  const id = dok[f];
  await db.query("delete from preis_vorschlag where dokument_id=$1", [id]);
  if (f === "o5-scan.pdf") {
    await db.query("update dokument set auslesen_status=$2, auslesen_fehler=null where id=$1", [id, flag("liest") ? "liest" : "abgebrochen"]);
    continue;
  }
  await db.query("update dokument set auslesen_status='fertig', auslesen_fehler=null, modell='fixture', tokens_ein=0, tokens_aus=0, kosten_usd=0, gelesen_am=now() where id=$1", [id]);
  for (const [i, v] of (V[f] ?? []).entries()) {
    await db.query(`insert into preis_vorschlag(dokument_id, reihenfolge, position, seite, zitat, material_netto, rabatt_text, montage_anteil, ersatzpreis, rechenweg, katalog_id, bauteil_ids, sicherheit)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [id, i, v.position, v.seite, v.zitat, v.material, v.rabatt, v.montage, v.preis, v.rechenweg, v.katalog, v.bauteile, v.sicherheit]);
  }
}
await db.query("commit");
await db.end();

if (!flag("ohne-uebernahme")) {
  const u = await api("GET", `/api/preisdokument/gebaeude/${g.id}`);
  const pumpe = u.dokumente.find((d) => d.id === dok["o1-pumpen.pdf"])?.vorschlaege[0];
  if (pumpe && pumpe.status === "offen" && pumpe.bauteilIds.length) {
    await api("POST", `/api/preisdokument/vorschlaege/${pumpe.id}/uebernehmen`, { bauteilIds: pumpe.bauteilIds, alsTyppreis: false, stand: u.stand });
  }
}
const u = await api("GET", `/api/preisdokument/gebaeude/${g.id}`);
const n = u.dokumente.reduce((s, d) => s + d.vorschlaege.length, 0);
console.log(`${name}: ${u.dokumente.length} Dokumente, ${n} Vorschläge (Auslesen: ${u.auslesen}); Bauteile Heizkörper im Vorschlag ${hkIds.length}, davon von Hand ${hkHand.length}`);
