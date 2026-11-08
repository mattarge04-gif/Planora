// S3 Messung mit lokalem Chrome (playwright-core, channel chrome), Viewport 1920x1080.
// Aufruf: node messen.mjs   (vorher: npx esbuild app.jsx --bundle --outfile=dist/app.js --minify --jsx=automatic --define:process.env.NODE_ENV='"production"')
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";


const seite = new URL("./index.html", import.meta.url).href;
const profile = {
  // GPU: echte Grafikkarte via ANGLE/D3D11. Software: SwiftShader = Rechner ohne GPU (z.B. virtueller Desktop/Citrix).
  "gpu-headless": ["--ignore-gpu-blocklist", "--use-angle=d3d11"],
  "software-headless": ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
};
const faelle = [
  { n: 10000, modus: "batched" }, { n: 20000, modus: "batched" }, { n: 20000, modus: "instanced" }, { n: 20000, modus: "batched-roh" },
];
const ergebnisse = [];
for (const [profil, args] of Object.entries(profile)) {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args });
  for (const f of faelle) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const t0 = Date.now();
    await page.goto(`${seite}?n=${f.n}&geschosse=10&modus=${f.modus}&dauer=6000`);
    await page.waitForFunction(() => window.__ergebnis, null, { timeout: 180000 });
    const r = await page.evaluate((m) => ({ ...window.__ergebnis, synchron: window.__synchron(m), picking: window.__picking(50) }), profil === "gpu-headless" ? 200 : 20);
    r.profil = profil; ergebnisse.push(r); console.log(JSON.stringify(r));
    if (profil === "gpu-headless" && f.n === 20000 && f.modus === "batched") await page.screenshot({ path: "screenshot_20000_batched.png" });
    await page.close();
  }
  await browser.close();
}
writeFileSync("ergebnis.json", JSON.stringify(ergebnisse, null, 1));
