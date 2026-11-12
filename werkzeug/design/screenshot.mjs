// Design-Screenshots mit echter GPU (nur Entwicklung). Aufruf siehe werkzeug/design/README.md.
// node werkzeug/design/screenshot.mjs --szenario <datei.json> --aus <ordner> [--datei <lokales.html> | --port 3100] [--passwort <pw>]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const arg = (name, standard) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : standard; };

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

function passwort() {
  const pw = arg("passwort");
  if (pw) return pw;
  const log = join(hier, ".lauf", "instanz.log");
  if (!existsSync(log)) throw new Error("Kein --passwort und keine laufende Instanz (werkzeug/design/instanz.sh start)");
  const m = readFileSync(log, "utf8").match(/Login: \S+ \/ (\S+)/);
  if (!m) throw new Error("Passwort nicht im Instanz-Log gefunden");
  return m[1];
}

const szenarioDatei = arg("szenario", join(hier, "szenarien", "twin.json"));
const aus = resolve(arg("aus", join(hier, ".lauf", "bilder")));
const port = arg("port", "3100");
const lokaleDatei = arg("datei");
if (lokaleDatei && !existsSync(resolve(lokaleDatei))) throw new Error(`Lokale HTML-Datei fehlt: ${lokaleDatei}`);
const szenario = JSON.parse(readFileSync(szenarioDatei, "utf8"));
mkdirSync(aus, { recursive: true });

const { chromium } = await ladePlaywright();
const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const bericht = { szenario: szenarioDatei, zeit: new Date().toISOString(), renderer: null, ansichten: [] };
const pw = lokaleDatei ? null : passwort();

try {
  for (const [breite, hoehe] of szenario.fenster ?? [[1440, 900]]) {
    const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
    const meldungen = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") meldungen.push(`${m.type()}: ${m.text()}`); });
    page.on("pageerror", (e) => meldungen.push(`pageerror: ${e.message}`));
    await page.goto(lokaleDatei ? pathToFileURL(resolve(lokaleDatei)).href : `http://localhost:${port}`);
    await page.evaluate(() => document.fonts.ready);
    bericht.renderer ??= await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : "kein WebGL2";
    });
    if (!lokaleDatei) {
      await page.fill("input[type=email]", szenario.benutzer ?? "admin@planora.invalid");
      await page.fill("input[type=password]", pw);
      await page.click("button[type=submit]");
    }
    const ansicht = { fenster: `${breite}x${hoehe}`, bilder: [], fps: [], meldungen };
    for (const s of szenario.schritte) {
      try { await schritt(s); } catch (e) {
        const datei = join(aus, `fehler-${breite}x${hoehe}.png`);
        await page.screenshot({ path: datei });
        throw new Error(`Schritt ${JSON.stringify(s)} fehlgeschlagen (Bild: ${datei}): ${e.message.split("\n")[0]}`);
      }
    }
    async function schritt(s) {
      if (s.klick) await page.getByText(s.klick, { exact: s.exakt ?? false }).first().click();
      else if (s.knopf) await page.getByRole("button", { name: s.knopf }).first().click();
      else if (s.warte) await page.waitForTimeout(s.warte);
      else if (s.taste) await page.keyboard.press(s.taste);
      else if (s.maus) await page.mouse.move(s.maus[0] * breite, s.maus[1] * hoehe);
      else if (s.punkt) await page.mouse.click(s.punkt[0] * breite, s.punkt[1] * hoehe);
      else if (s.rad) { await page.mouse.move(s.rad[0] * breite, s.rad[1] * hoehe); await page.mouse.wheel(0, s.rad[2]); }
      else if (s.ziehen) {
        const [x1, y1, x2, y2] = s.ziehen;
        await page.mouse.move(x1 * breite, y1 * hoehe); await page.mouse.down();
        await page.mouse.move(x2 * breite, y2 * hoehe, { steps: 20 }); await page.mouse.up();
      } else if (s.bild) {
        const datei = join(aus, `${s.bild}-${breite}x${hoehe}.png`);
        await page.screenshot({ path: datei });
        ansicht.bilder.push(datei);
      } else if (s.fps) {
        // Bilder pro Sekunde waehrend einer Kameradrehung (Ziehen ueber die Szenenmitte)
        const zaehler = page.evaluate((ms) => new Promise((ok) => {
          let n = 0; const t0 = performance.now();
          const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else ok(Math.round((n * 1000) / (performance.now() - t0))); };
          requestAnimationFrame(f);
        }), s.fps);
        await page.mouse.move(breite * 0.5, hoehe * 0.5); await page.mouse.down();
        await page.mouse.move(breite * 0.62, hoehe * 0.47, { steps: Math.max(10, Math.round(s.fps / 30)) }); await page.mouse.up();
        ansicht.fps.push(await zaehler);
      }
    }
    bericht.ansichten.push(ansicht);
    await page.close();
  }
} finally {
  await browser.close();
}

writeFileSync(join(aus, "bericht.json"), JSON.stringify(bericht, null, 2));
const gpu = /swiftshader|llvmpipe|software/i.test(bericht.renderer ?? "") ? "WARNUNG: Software-Rendering – Bilder nicht als Beleg verwenden" : "GPU ok";
console.log(`${gpu} | Renderer: ${bericht.renderer}`);
for (const a of bericht.ansichten) console.log(`${a.fenster}: ${a.bilder.length} Bilder, fps ${a.fps.join("/") || "-"}, Meldungen ${a.meldungen.length}`);
console.log(`Bericht: ${join(aus, "bericht.json")}`);
