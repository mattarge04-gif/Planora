// GPU-Screenshots Anlagenakte (nur Entwicklung): Seite Dokumente, Viewer, Anlagenkarte, Leser-Ansicht.
// Vorher: bash werkzeug/design/instanz.sh start --muster; node werkzeug/design/lebensdauer-daten.mjs; node app/web/werkzeug/akte-testdaten.mjs
// node app/web/werkzeug/akte-bilder.mjs --aus <ordner> [--port 3100] [--fenster 1440x900,1280x720,1920x1080] [--nur name1,name2]
// Zustaende, die der Fake-Scanner nicht dauerhaft liefert (quarantaene, scan_fehler) und die Leser-Ansicht (kein Leser-Konto im
// Entwicklungsstart) werden NUR in der Anzeige simuliert: Playwright aendert die JSON-Antworten (scanStatus bzw. darfAendern).
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : s; };
const basis = `http://localhost:${arg("port", "3100")}`;
const aus = resolve(arg("aus", "akte-bilder"));
const fenster = arg("fenster", "1440x900,1280x720").split(",").map((f) => f.split("x").map(Number));
const nur = arg("nur", "")?.split(",").filter(Boolean) ?? [];
const GEBAEUDE = "Muster 6 L-Form viele Gruppen";
const LEER = "Muster 1 Ein Raum";
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
const bericht = { zeit: new Date().toISOString(), renderer: null, ansichten: [] };

/** Simulation nur in der Anzeige: Scan-Zustaende und/oder Leserechte. */
async function simuliere(page, o) {
  await page.unroute("**/api/**").catch(() => {});
  if (!o) return;
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") return route.continue();
    const url = req.url();
    const passt = /\/api\/(dokumente\/gebaeude|preisdokument\/gebaeude|lebensdauer\/gebaeude|bestand\/bauteile)\//.test(url);
    if (!passt) return route.continue();
    const r = await route.fetch();
    let j; try { j = await r.json(); } catch { return route.fulfill({ response: r }); }
    if (o.leser && j && typeof j === "object" && "darfAendern" in j) j.darfAendern = false;
    if (o.zustaende && /\/api\/dokumente\/gebaeude\//.test(url) && Array.isArray(j.dokumente)) {
      for (const d of j.dokumente) {
        if (d.dateiname.startsWith("Inbetriebnahme")) { d.scanStatus = "scan_fehler"; d.scanGrund = "Scanner nicht erreichbar"; }
        if (d.dateiname.startsWith("Grundriss")) { d.scanStatus = "quarantaene"; }
      }
    }
    return route.fulfill({ response: r, json: j });
  });
}

try {
  for (const [breite, hoehe] of fenster) {
    const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
    const meldungen = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") meldungen.push(`${m.type()}: ${m.text()}`); });
    page.on("pageerror", (e) => meldungen.push(`pageerror: ${e.message}`));
    const bilder = [];
    const bild = async (n) => {
      if (nur.length && !nur.includes(n)) return;
      await page.waitForTimeout(350);
      const datei = join(aus, `${n}-${breite}x${hoehe}.png`);
      await page.screenshot({ path: datei }); bilder.push(datei);
    };
    const knopf = (n, exakt = false) => page.getByRole("button", { name: n, exact: exakt }).first();
    const zuDokumenten = async (gebaeude) => {
      await page.goto(`${basis}/`);
      await page.getByText(gebaeude, { exact: false }).first().click();
      await page.waitForSelector(".tw-links", { timeout: 30000 });
      await page.waitForTimeout(2500);
      await knopf("Gebäude wählen").click();
      await page.getByRole("menuitem", { name: "Dokumente" }).click();
      await page.waitForSelector(".dk", { timeout: 15000 });
      await page.waitForTimeout(900);
    };

    await page.goto(`${basis}/entwicklung/anmelden`);
    await page.waitForTimeout(800);
    bericht.renderer ??= await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : "kein WebGL2";
    });

    // 0. Ladegerüst: Ablage-Antwort nur in diesem Lauf künstlich verzögert (2.5 s), damit der Zustand belegt ist
    await page.route("**/api/dokumente/gebaeude/**", async (r) => { await new Promise((x) => setTimeout(x, 2500)); await r.continue().catch(() => {}); });
    await zuDokumenten(GEBAEUDE);
    await bild("dokumente-laedt");
    await page.unroute("**/api/dokumente/gebaeude/**").catch(() => {});
    await page.waitForTimeout(2500);

    // 1. Leere Ablage
    await zuDokumenten(LEER);
    await bild("dokumente-leer");

    // 2. Liste mit allen Scan-Zustaenden (quarantaene/scan_fehler simuliert), Detail Datenblatt mit Verknuepfung
    await simuliere(page, { zustaende: true });
    await zuDokumenten(GEBAEUDE);
    await page.locator(".dk-z-wahl", { hasText: "Datenblatt" }).first().click();
    await page.waitForTimeout(1500);
    await bild("liste-detail-datenblatt");
    await knopf("Hinzufügen").click();
    await page.waitForTimeout(500);
    await bild("detail-bauteile-hinzufuegen");
    await knopf("Abbrechen", true).click();
    await page.locator(".dk-z-wahl", { hasText: "Rechnung Service" }).first().click();
    await page.waitForTimeout(500);
    await bild("detail-abgelehnt");
    await page.locator(".dk-z-wahl", { hasText: "Inbetriebnahme" }).first().click();
    await page.waitForTimeout(500);
    await bild("detail-scan-fehler");
    await page.locator(".dk-z-wahl", { hasText: "Wartungsplan" }).first().click();
    await page.waitForTimeout(500);
    await bild("detail-office");
    await page.locator(".dk-z-wahl", { hasText: "Technikraum" }).first().click();
    await page.waitForTimeout(800);
    await bild("detail-foto");
    await simuliere(page, null);

    // 3. Viewer: PDF Seite 2, Suche, Bild
    await zuDokumenten(GEBAEUDE);
    await page.locator(".dk-z-wahl", { hasText: "Datenblatt" }).first().click();
    await page.waitForTimeout(600);
    await knopf("Öffnen", true).click();
    await page.waitForSelector(".vw-papier-bereit", { timeout: 15000 });
    await bild("viewer-pdf-s1");
    await knopf("Nächste Seite").click();
    await page.waitForTimeout(900);
    await bild("viewer-pdf-s2");
    await page.locator(".vw-suche input").fill("Pumpe");
    await page.waitForTimeout(1500);
    await page.locator(".vw-suche input").press("Enter");
    await page.waitForTimeout(900);
    await bild("viewer-suche");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.locator(".dk-z-wahl", { hasText: "Technikraum" }).first().click();
    await page.waitForTimeout(500);
    await knopf("Öffnen", true).click();
    await page.waitForTimeout(1200);
    await bild("viewer-bild");
    await knopf("Vergrössern").click(); await knopf("Vergrössern").click();
    await page.waitForTimeout(500);
    await bild("viewer-bild-zoom");
    // Ziehen weit nach links: Bild bleibt bündig am rechten Rand (kein grauer Streifen)
    { const f = await page.locator(".vw-flaeche").boundingBox();
      await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2); await page.mouse.down();
      await page.mouse.move(f.x + 20, f.y + f.height / 2, { steps: 12 }); await page.mouse.up(); }
    await page.waitForTimeout(400);
    await bild("viewer-bild-gezogen");
    await page.keyboard.press("0");
    await page.waitForTimeout(400);
    await bild("viewer-bild-taste0");
    await page.keyboard.press("Escape");

    // 4. Preise prüfen
    await page.getByRole("tab", { name: /Preise prüfen/ }).click();
    await page.waitForTimeout(900);
    await bild("preise-pruefen");
    await page.getByRole("tab", { name: /Alle Dokumente/ }).click();

    // 5. Anlagenkarte: Datenblatt + Unterlagen, Viewer aus der Karte
    await knopf(/Digital Twin/).click();
    await page.waitForSelector(".tw-links", { timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.locator("tr[data-schluessel]", { hasText: "Umwälzpumpe" }).first().click();
    await page.waitForTimeout(2500);
    await bild("karte-unterlagen-datenblatt");
    await page.locator(".tw-objekt-sprung").click();
    await page.waitForTimeout(900);
    await bild("karte-sprung-unterlagen");
    await page.locator(".tw-objekt-inhalt").evaluate((e) => { e.scrollTop = 0; });
    await page.locator(".tw-objekt-inhalt").evaluate((e) => { e.scrollTop = e.scrollHeight; });
    await page.waitForTimeout(400);
    await bild("karte-unterlagen-unten");
    await page.locator(".tw-db-bearbeiten").click().catch(() => {});
    await page.waitForTimeout(500);
    await bild("karte-datenblatt-bearbeiten");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.locator(".tw-ul-wahl", { hasText: "Datenblatt" }).first().click();
    await page.waitForSelector(".vw-papier-bereit", { timeout: 15000 });
    await page.waitForTimeout(600);
    await bild("viewer-aus-karte");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await bild("karte-nach-esc");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    await bild("nach-esc-esc");

    // 6. Leser-Ansicht (simuliert): Seite und Karte ohne Schreibknoepfe
    await simuliere(page, { leser: true });
    await zuDokumenten(GEBAEUDE);
    await page.locator(".dk-z-wahl", { hasText: "Datenblatt" }).first().click();
    await page.waitForTimeout(1200);
    await bild("leser-dokumente");
    await knopf(/Digital Twin/).click();
    await page.waitForSelector(".tw-links", { timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.locator("tr[data-schluessel]", { hasText: "Umwälzpumpe" }).first().click();
    await page.waitForTimeout(2500);
    await page.locator(".tw-objekt-inhalt").evaluate((e) => { e.scrollTop = e.scrollHeight; });
    await bild("leser-karte");
    await simuliere(page, null);

    bericht.ansichten.push({ fenster: `${breite}x${hoehe}`, bilder, meldungen });
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(join(aus, "bericht.json"), JSON.stringify(bericht, null, 2));
console.log(`Renderer: ${bericht.renderer}`);
for (const a of bericht.ansichten) console.log(`${a.fenster}: ${a.bilder.length} Bilder, Meldungen ${a.meldungen.length}${a.meldungen.length ? "\n  " + a.meldungen.join("\n  ") : ""}`);
