// S3b: Messung "einfacher Look" mit Playwright-Chromium ohne GPU (Software-Rendering = schlechtester Fall).
// Aufruf: npx esbuild app.jsx --bundle --outfile=dist/app.js --minify --jsx=automatic --define:process.env.NODE_ENV=\"production\" && node messen.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW_PFAD ?? "playwright");
import { writeFileSync } from "node:fs";
const seite = new URL("./index.html", import.meta.url).href;
const faelle = [
  { n: 500, dpr: 1, w: 1920, h: 1080 }, { n: 2000, dpr: 1, w: 1920, h: 1080 }, { n: 10000, dpr: 1, w: 1920, h: 1080 },
  { n: 2000, dpr: 1.5, w: 1920, h: 1080 }, { n: 2000, dpr: 1, w: 1366, h: 768 },
  { n: 2000, dpr: 1, w: 1920, h: 1080, aa: 0 }, { n: 2000, dpr: 1, w: 1920, h: 1080, aa: 0, glas: 0 }, { n: 2000, dpr: 0.75, w: 1920, h: 1080, aa: 0, glas: 0 },
];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const erg = [];
for (const f of faelle) {
  const page = await browser.newPage({ viewport: { width: f.w, height: f.h } });
  const t0 = Date.now();
  await page.goto(`${seite}?n=${f.n}&geschosse=10&dpr=${f.dpr}&aa=${f.aa ?? 1}&glas=${f.glas ?? 1}`);
  await page.waitForFunction(() => window.__bereit, null, { timeout: 120000 });
  const erste = Date.now() - t0;
  const r = await page.evaluate(() => ({ synchron: window.__synchron(60), picking: window.__picking(50) }));
  Object.assign(r, f, { erste_darstellung_ms: erste }); erg.push(r); console.log(JSON.stringify(r));
  if (f.n === 2000 && f.dpr === 1 && f.w === 1920) await page.screenshot({ path: "screenshot_2000.png" });
  await page.close();
}
await browser.close();
writeFileSync("ergebnis.json", JSON.stringify(erg, null, 1));
