// Browser-Abnahme Anlagenakte (Plan T10 Step 3) mit echter GPU, Klicks je Ablauf. Nur Entwicklung, frische Instanz je Lauf:
//   bash werkzeug/design/instanz.sh start --muster; node werkzeug/design/lebensdauer-daten.mjs; node werkzeug/design/anlagenakte-daten.mjs
//   node werkzeug/anlagenakte/erzeuge.mjs
//   node werkzeug/anlagenakte/abnahme.mjs --aus docs/abnahme/<datum>-anlagenakte [--port 3100] [--fenster 1440x900]
// Ablegt Dateien (Knopf + Ziehen), ruft eicar-ablegen.mjs auf, prueft Verknuepfen, Viewer, Datenblatt, Download, Preise lesen,
// Loeschen und die Leser-Ansicht. Leser: kein Leser-Konto im Entwicklungsstart -> NUR in der Anzeige simuliert (darfAendern=false).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : s; };
const port = arg("port", "3100");
const basis = `http://localhost:${port}`;
const aus = resolve(arg("aus", join(hier, "dateien", "abnahme")));
const [breite, hoehe] = arg("fenster", "1440x900").split("x").map(Number);
const GEBAEUDE = "Muster 6 L-Form viele Gruppen";
const D = (n) => join(hier, "dateien", n);
mkdirSync(aus, { recursive: true });

async function ladePlaywright() {
  const kandidaten = [];
  if (process.env.PLAYWRIGHT_MODUL) kandidaten.push(process.env.PLAYWRIGHT_MODUL);
  const cache = join(process.env.LOCALAPPDATA ?? join(process.env.HOME ?? "", ".npm"), "npm-cache", "_npx");
  if (existsSync(cache)) for (const d of readdirSync(cache)) {
    const p = join(cache, d, "node_modules", "playwright", "index.mjs");
    if (existsSync(p)) kandidaten.push(p);
  }
  for (const p of kandidaten) {
    const m = await import(pathToFileURL(p).href);
    try { if (existsSync(m.chromium.executablePath())) return m; } catch { /* naechster */ }
  }
  throw new Error("Kein Playwright mit Chromium gefunden (npx -y playwright@1.65.0 install chromium)");
}

const { chromium } = await ladePlaywright();
const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: breite, height: hoehe }, acceptDownloads: true });
const bericht = { zeit: new Date().toISOString(), fenster: `${breite}x${hoehe}`, renderer: null, schritte: [], meldungen: [] };
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") bericht.meldungen.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => bericht.meldungen.push(`pageerror: ${e.message}`));

let schritt = null;
const beginne = (name) => { schritt = { name, klicks: 0, befunde: [], ok: [] }; bericht.schritte.push(schritt); console.log(`\n== ${name}`); };
const ok = (t) => { schritt.ok.push(t); console.log(`  ok  ${t}`); };
const befund = (t) => { schritt.befunde.push(t); console.log(`  BEFUND ${t}`); };
const pruefe = (bed, t) => (bed ? ok(t) : befund(t));
/** Ein Klick des Nutzers (zaehlt). */
const klick = async (loc) => { await loc.click(); schritt.klicks++; await page.waitForTimeout(250); };
const waehle = async (loc, wert) => { await loc.selectOption(wert); schritt.klicks++; await page.waitForTimeout(300); };
const bild = async (n) => { await page.waitForTimeout(400); await page.screenshot({ path: join(aus, `${n}-${breite}x${hoehe}.png`) }); };
const knopf = (n, exakt = false) => page.getByRole("button", { name: n, exact: exakt }).first();
const zeile = (n) => page.locator(".dk-z-wahl", { hasText: n }).first();

async function zuDokumenten() {
  await klick(knopf("Gebäude wählen"));
  await klick(page.getByRole("menuitem", { name: "Dokumente" }));
  await page.waitForSelector(".dk", { timeout: 15000 });
  await page.waitForTimeout(900);
}
async function zumTwin() {
  await klick(knopf(/Digital Twin/));
  await page.waitForSelector(".tw-links", { timeout: 30000 });
  await page.waitForTimeout(3000);
}
async function oeffnePumpe() {
  await klick(page.locator("tr[data-schluessel]", { hasText: "Umwälzpumpe" }).first());
  await page.waitForTimeout(2500);
}
/** Seite neu laden und wieder zu Dokumenten, ohne Klicks zu zaehlen (Werkzeugschritt, kein Nutzerweg). */
async function neuLaden() {
  const vorher = schritt.klicks;
  // Neu laden fuehrt zur Gebaeudeliste (Ort nicht in der URL)
  await page.goto(`${basis}/`);
  await page.getByText(GEBAEUDE).first().click();
  await page.waitForSelector(".tw-links", { timeout: 30000 }); await page.waitForTimeout(2500);
  await zuDokumenten();
  schritt.klicks = vorher;
}
/** Simuliert Leserechte nur in der Anzeige (JSON-Antworten mit darfAendern). */
async function alsLeser(an) {
  await page.unroute("**/api/**").catch(() => {});
  if (!an) return;
  await page.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const r = await route.fetch();
    let j; try { j = await r.json(); } catch { return route.fulfill({ response: r }); }
    if (j && typeof j === "object" && "darfAendern" in j) j.darfAendern = false;
    return route.fulfill({ response: r, json: j });
  });
}

try {
  await page.goto(`${basis}/entwicklung/anmelden`);
  await page.waitForTimeout(800);
  bericht.renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : "kein WebGL2";
  });
  console.log(`Renderer: ${bericht.renderer}`);

  // 1. Ablegen: drei per Knopf, Offerte per Ziehen; EICAR ueber die API
  beginne("1 Ablegen");
  await klick(page.getByText(GEBAEUDE).first());
  await page.waitForSelector(".tw-links", { timeout: 30000 });
  await page.waitForTimeout(2500);
  await zuDokumenten();
  await bild("01-leer");
  const wahl = page.waitForEvent("filechooser");
  await klick(knopf("Dateien wählen"));
  await (await wahl).setFiles([D("datenblatt-pumpe.pdf"), D("foto-zentrale.png"), D("kosten.xlsx")]);
  await page.waitForTimeout(2500);
  const o1 = readFileSync(D("o1-pumpen.pdf")).toString("base64");
  const dt = await page.evaluateHandle((b64) => {
    const t = new DataTransfer();
    t.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "o1-pumpen.pdf", { type: "application/pdf" }));
    return t;
  }, o1);
  const ziel = page.locator(".dk-akte-liste");
  await ziel.dispatchEvent("dragenter", { dataTransfer: dt });
  await ziel.dispatchEvent("dragover", { dataTransfer: dt });
  await bild("01-ziehen");
  await ziel.dispatchEvent("drop", { dataTransfer: dt });
  await page.waitForTimeout(3000);
  const eicar = execFileSync(process.execPath, [join(hier, "eicar-ablegen.mjs"), "--port", port], { encoding: "utf8" });
  console.log(`  ${eicar.trim().replace(/\n/g, "\n  ")}`);
  pruefe(/Ergebnis: abgelehnt \(Eicar-Test-Signature\)/.test(eicar), `EICAR: ${eicar.trim().split("\n").pop()}`);
  // Seite kennt den API-Upload nicht: neu laden (kein Nutzerklick)
  await neuLaden();
  for (const n of ["datenblatt-pumpe.pdf", "foto-zentrale.png", "kosten.xlsx", "o1-pumpen.pdf"]) {
    const z = page.locator(".dk-z", { hasText: n }).first();
    pruefe(await z.count() > 0 && /geprüft/.test(await z.locator(".dk-z-status").innerText()), `${n} abgelegt, geprüft`);
  }
  const ez = page.locator(".dk-z", { hasText: "eicar-test.pdf" }).first();
  pruefe(await ez.count() > 0 && /abgelehnt/.test(await ez.innerText()), "eicar-test.pdf in der Liste als abgelehnt");
  await bild("01-abgelegt");
  await klick(zeile("eicar-test.pdf"));
  await bild("01-eicar-detail");

  // 2. Datenblatt: Kategorie und 2 Pumpen verknuepfen
  beginne("2 Kategorie und Verknuepfen");
  await klick(zeile("datenblatt-pumpe.pdf"));
  await waehle(page.locator("#dk-kategorie"), "datenblatt");
  await klick(knopf("Hinzufügen"));
  await waehle(page.locator(".dk-wahl select").nth(0), { label: "Umwälzpumpe" });
  const boxen = page.locator(".dk-wahl input[type=checkbox]");
  ok(`${await boxen.count()} Pumpen zur Auswahl, ${await page.locator(".dk-wahl .dk-chip", { hasText: "Vorgeschlagen" }).count()} vorgeschlagen`);
  await klick(boxen.nth(0)); await klick(boxen.nth(1));
  await bild("02-auswahl");
  await klick(knopf("2 Bauteile verknüpfen"));
  await page.waitForTimeout(800);
  pruefe(await page.locator(".dk-bauteile li").count() === 2, "2 Bauteile verknüpft");
  pruefe((await page.locator("#dk-kategorie").inputValue()) === "datenblatt", "Kategorie Datenblatt");
  await bild("02-verknuepft");

  // 3. Twin -> Anlagenkarte Pumpe -> Unterlagen -> Viewer Seite 2, Suche, Esc
  beginne("3 Unterlagen und Viewer");
  await zumTwin();
  await oeffnePumpe();
  const sprung = page.locator(".tw-objekt-sprung");
  ok(`Sprungmarke: "${(await sprung.innerText().catch(() => "-")).trim()}"`);
  await bild("03-karte");
  if (await sprung.count()) await klick(sprung);
  await page.waitForTimeout(800);
  await bild("03-karte-unterlagen");
  await klick(page.locator(".tw-ul-wahl", { hasText: "datenblatt" }).first());
  await page.waitForSelector(".vw-papier-bereit", { timeout: 15000 });
  await page.waitForTimeout(800);
  await bild("03-viewer-s1");
  const seite = page.locator(".vw-seite input");
  await klick(seite); await seite.fill("2"); await seite.press("Enter");
  await page.waitForTimeout(1200);
  pruefe((await seite.inputValue()) === "2", "Seite 2 angesprungen");
  const suche = page.getByRole("searchbox", { name: "Im Dokument suchen" });
  await klick(suche); await suche.fill("Förderhöhe");
  await page.waitForTimeout(1500);
  const stand = (await page.locator("#vw-suche-stand").innerText()).trim();
  pruefe(/^\d+ \/ \d+$/.test(stand) && !stand.startsWith("0"), `Suche "Förderhöhe": ${stand || "(leer)"}`);
  await bild("03-viewer-suche");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  pruefe(await page.locator(".vw-grund").count() === 0, "Esc schliesst den Viewer");
  pruefe(await page.locator(".tw-objekt-inhalt").count() > 0, "Anlagenkarte bleibt offen");

  // 4. Datenblatt-Abschnitt: DN 32, Foerderhoehe 6.5
  beginne("4 Datenblatt erfassen");
  await klick(page.locator(".tw-db-bearbeiten"));
  const feld = (n) => page.locator(".tw-db-form .tw-db-feld", { hasText: n }).locator("input");
  await klick(feld("Nennweite")); await feld("Nennweite").fill("32");
  await klick(feld("Förderhöhe")); await feld("Förderhöhe").fill("6.5");
  await bild("04-bearbeiten");
  await klick(page.locator(".tw-db-form button[type=submit]"));
  await page.waitForTimeout(1000);
  const werte = (await page.locator(".tw-db-werte").innerText().catch(() => "")).replace(/\s+/g, " ");
  pruefe(/DN 32/.test(werte) && /6[.,]5 m/.test(werte), `gespeichert: ${werte}`);
  ok(`Hinweis Gruppe: ${(await page.locator(".tw-db-hinweis").first().innerText().catch(() => "keiner")).trim()}`);
  await bild("04-gespeichert");
  // zweite Pumpe: per API (Karte fasst gleiche Typen zusammen)
  const pumpen = await page.evaluate(async () => {
    const l = await (await fetch("/api/struktur/gebaeude")).json();
    const g = l.find((x) => x.name.startsWith("Muster 6"));
    const a = await (await fetch(`/api/dokumente/gebaeude/${g.id}`)).json();
    const ids = a.dokumente.find((d) => d.dateiname === "datenblatt-pumpe.pdf").bauteilIds;
    return Promise.all(a.bauteile.filter((b) => b.katalogId === "heizung.umwaelzpumpe").map(async (b) =>
      ({ id: b.id, verknuepft: ids.includes(b.id), werte: (await (await fetch(`/api/bestand/bauteile/${b.id}/datenblatt`)).json()).werte })));
  });
  ok(`Pumpen: ${pumpen.map((p) => `${p.verknuepft ? "verknuepft" : "frei"} ${JSON.stringify(p.werte)}`).join("; ")}`);
  const zweite = pumpen.filter((p) => p.verknuepft)[1];
  pruefe(zweite?.werte.dn === 32 && zweite?.werte.foerderhoehe_m === 6.5, "zweite verknuepfte Pumpe zeigt DN 32 / 6.5 m");

  // 5. Excel herunterladen
  beginne("5 Excel herunterladen");
  await zuDokumenten();
  await klick(zeile("kosten.xlsx"));
  pruefe(await page.getByRole("button", { name: "Öffnen", exact: true }).count() === 0, "kein Öffnen-Knopf (keine Vorschau)");
  await bild("05-excel");
  const laden = page.waitForEvent("download", { timeout: 10000 });
  await klick(page.locator(".dk-detail-aktionen a", { hasText: "Herunterladen" }));
  const dl = await laden;
  pruefe(dl.suggestedFilename() === "kosten.xlsx", `Download startet: ${dl.suggestedFilename()}`);
  pruefe(await page.locator(".vw-grund").count() === 0, "kein Viewer geöffnet");

  // 6. Offerte o1: Preise lesen ohne Schluessel; Umschalter Preise pruefen
  beginne("6 Offerte, Preise lesen");
  await klick(zeile("o1-pumpen.pdf"));
  const lesen = page.getByRole("button", { name: /Preise lesen/ });
  const nLesen = await lesen.count();
  ok(`Knopf "Preise lesen": ${nLesen ? (await lesen.first().isDisabled() ? "sichtbar, gesperrt" : "sichtbar, aktiv") : "nicht sichtbar"}`);
  if (!nLesen) befund("\"Preise lesen\" ohne Schluessel nicht sichtbar (Plan: sichtbar und gesperrt mit Hinweis)");
  await bild("06-offerte");
  const tab = page.getByRole("tab", { name: /Preise prüfen/ });
  pruefe(await tab.count() > 0, `Umschalter: ${(await tab.innerText().catch(() => "fehlt")).replace(/\s+/g, " ").trim()}`);
  if (await tab.count()) { await klick(tab); await page.waitForTimeout(900); await bild("06-preise-pruefen"); await klick(page.getByRole("tab", { name: /Alle Dokumente/ })); }

  // 7. Foto loeschen
  beginne("7 Foto löschen");
  await klick(zeile("foto-zentrale.png"));
  await klick(page.getByRole("button", { name: "foto-zentrale.png löschen" }));
  pruefe(await page.getByRole("group", { name: "Löschen bestätigen" }).count() > 0, "Rückfrage erscheint");
  await bild("07-rueckfrage");
  await klick(page.getByRole("group", { name: "Löschen bestätigen" }).getByRole("button", { name: "Löschen", exact: true }));
  await page.waitForTimeout(1200);
  pruefe(await page.locator(".dk-z", { hasText: "foto-zentrale.png" }).count() === 0, "Foto entfernt");
  pruefe(await page.locator(".dk-z", { hasText: "o1-pumpen.pdf" }).count() > 0, "Offerte bleibt");
  await bild("07-geloescht");

  // 8. Leser-Ansicht (simuliert)
  beginne("8 Leser-Ansicht (simuliert)");
  await alsLeser(true);
  await neuLaden();
  pruefe(await knopf("Dateien wählen").count() === 0, "kein Ablegen");
  await klick(zeile("datenblatt-pumpe.pdf"));
  pruefe(await page.locator(".dk-detail-loeschen, .dk-symbol-loeschen").count() === 0, "kein Löschen");
  pruefe(await page.locator("#dk-kategorie").count() === 0, "Kategorie nur lesbar");
  pruefe(await knopf("Hinzufügen").count() === 0, "kein Verknüpfen");
  await bild("08-leser-dokumente");
  await klick(knopf("Öffnen", true));
  await page.waitForSelector(".vw-papier-bereit", { timeout: 15000 });
  ok("Leser öffnet das PDF im Viewer");
  await page.keyboard.press("Escape");
  await zumTwin();
  await oeffnePumpe();
  pruefe(await page.locator(".tw-db-bearbeiten").count() === 0, "Karte: kein Bearbeiten im Datenblatt");
  pruefe(await page.locator(".tw-ul-ablegen").count() === 0, "Karte: kein Ablegen bei Unterlagen");
  await page.locator(".tw-objekt-inhalt").evaluate((e) => { e.scrollTop = e.scrollHeight; }).catch(() => {});
  await bild("08-leser-karte");
  await alsLeser(false);
} catch (e) {
  bericht.abbruch = String(e?.stack ?? e);
  console.error(e);
  await page.screenshot({ path: join(aus, `abbruch-${breite}x${hoehe}.png`) }).catch(() => {});
} finally {
  await browser.close();
}
writeFileSync(join(aus, `bericht-${breite}x${hoehe}.json`), JSON.stringify(bericht, null, 2));
console.log(`\nKlicks: ${bericht.schritte.map((s) => `${s.name.split(" ")[0]}=${s.klicks}`).join(", ")}; Meldungen ${bericht.meldungen.length}`);
if (bericht.abbruch) process.exit(1);
