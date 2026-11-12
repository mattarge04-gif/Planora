// Erzeugt app/web/src/fixtures/muster-<schluessel>.json aus dem aktuellen Generator (npm run muster:welt).
// Nach jeder Aenderung am Generator neu ausfuehren; der Test welt-muster vergleicht Fixture und Generatorausgabe.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ALLE_MUSTER, musterGeneratorEingabe } from "../src/welt/muster.js";
import { weltErzeugen } from "../src/welt/generator.js";
import { REGELWERK_V2 } from "../src/welt/regelwerk.v2.js";

const ordner = fileURLToPath(new URL("../web/src/fixtures/", import.meta.url));
mkdirSync(ordner, { recursive: true });
for (const m of ALLE_MUSTER) {
  const { huelle, beschreibung } = musterGeneratorEingabe(m);
  const welt = weltErzeugen(huelle, beschreibung, REGELWERK_V2);
  writeFileSync(`${ordner}muster-${m.schluessel}.json`, JSON.stringify(welt, null, 2) + "\n");
  console.log(`muster-${m.schluessel}.json  ${welt.symbole.length} Symbole, ${welt.gruppen?.length ?? 0} Gruppen  ${welt.hash.slice(0, 12)}`);
}
