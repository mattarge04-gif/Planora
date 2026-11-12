import { raster } from "../generator.kern.js";
import type { Katalog } from "../regelwerk.js";
import type { Punkt, Rechteck } from "../typen.js";
import type { Seite } from "./form.js";

/** Symbol fuer die Einrichtung: `bei` = Gruppenzubehoer am Verteiler (Schluessel), `vor` = sitzt vor diesem Symbol (Schluessel). */
export interface SymbolEntwurf { schluessel: string; katalogId: string; bei?: string; vor?: string }

export const ERZEUGER = ["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe"];
const SPEICHER = "heizung.speicher";

/** Abstaende in Metern [A]: zwischen Geraeten, zu den Seitenwaenden, zur Rueckwand, Heizkoerper zur Fassade, Raster zur Wand. */
const ABSTAND = 0.5, RAND = 0.5, RUECK = 0.2, HK_WAND = 0.1, RASTER_WAND = 0.6;
const RANDNAH = 0.01; // Mindestabstand jeder Position zur Raumgrenze

/** Wand eines Raums: Koordinate, Richtung ins Rauminnere, Achse der Wand ("x" = Wand laeuft entlang x) und deren Bereich. */
function wand(r: Rechteck, s: Seite) {
  const entlangX = s[1] === "z";
  const plus = s[0] === "+";
  return {
    entlangX,
    lage: entlangX ? (plus ? r.z + r.tiefe : r.z) : (plus ? r.x + r.breite : r.x),
    innen: plus ? -1 : 1,
    von: entlangX ? r.x : r.z,
    bis: entlangX ? r.x + r.breite : r.z + r.tiefe,
  };
}
type Wand = ReturnType<typeof wand>;
const punkt = (w: Wand, entlang: number, abstand: number): Punkt =>
  w.entlangX ? { x: entlang, z: w.lage + w.innen * abstand } : { x: w.lage + w.innen * abstand, z: entlang };
const entlangVon = (w: Wand, p: Punkt) => (w.entlangX ? p.x : p.z);

/**
 * Packt Symbole in Reihen entlang einer Wand, beginnend am Ende zur Steigzone hin (Spec 5.3): gleiche Abstaende,
 * Vorderkanten je Reihe buendig; was nicht passt, kommt in eine weitere Reihe davor.
 */
function wandReihen(w: Wand, folge: string[], masse: (k: string) => [number, number, number], zurSteigzonePlus: boolean, rand: number, out: Map<string, Punkt>) {
  const verfuegbar = w.bis - w.von - 2 * rand;
  const reihen: string[][] = [];
  let aktuell: string[] = [], belegt = 0;
  for (const k of [...folge].reverse()) { // Ende des Flusses (Verteiler) zuerst, an der Wand zur Steigzone
    const bedarf = (aktuell.length ? ABSTAND : 0) + masse(k)[0];
    if (aktuell.length && belegt + bedarf > verfuegbar + 1e-9) { reihen.push(aktuell); aktuell = []; belegt = 0; }
    belegt += aktuell.length ? ABSTAND + masse(k)[0] : masse(k)[0];
    aktuell.push(k);
  }
  if (aktuell.length) reihen.push(aktuell);
  let basis = RUECK;
  for (const reihe of reihen) {
    const vorne = basis + Math.max(...reihe.map((k) => masse(k)[2]));
    let cursor = zurSteigzonePlus ? w.bis - rand : w.von + rand;
    for (const k of reihe) {
      const [b, , t] = masse(k);
      const mitte = zurSteigzonePlus ? cursor - b / 2 : cursor + b / 2;
      cursor += (zurSteigzonePlus ? -1 : 1) * (b + ABSTAND);
      out.set(k, punkt(w, mitte, vorne - t / 2));
    }
    basis = vorne + ABSTAND;
  }
}

/**
 * Positionen der Symbole eines Raums (Meter, Spec 5.3):
 * Zentrale (Raum mit Erzeuger oder Speicher) als Reihe an der Fassadenwand, Fluss Erzeuger -> Speicher -> Verteiler zur Steigzone hin,
 * Teile "vor X" direkt neben X; Heizkoerper an der Fassade auf (2k-1)/2n; Unterverteiler an der Gangwand zur Steigzone hin;
 * Gruppenzubehoer am Verteiler; Uebrige im Raster mit Wandabstand. Alle Positionen liegen im Raum.
 */
export function einrichten(einheit: Rechteck, gangSeite: Seite, fassadenSeite: Seite, symbole: SymbolEntwurf[], katalog: Katalog, steigzone: Punkt | null): Map<string, Punkt> {
  const eintrag = new Map(katalog.eintraege.map((e) => [e.id, e]));
  const masse = new Map(symbole.map((s) => [s.schluessel, eintrag.get(s.katalogId)?.masse ?? [0.5, 0.5, 0.5]] as const));
  const m = (k: string) => masse.get(k)! as [number, number, number];
  const hier = new Set(symbole.map((s) => s.schluessel));
  const out = new Map<string, Punkt>();
  const eigen = symbole.filter((s) => !s.bei);
  const istVerteiler = (s: SymbolEntwurf) => eintrag.get(s.katalogId)?.bereich === "verteilung";
  const zentrale = eigen.some((s) => ERZEUGER.includes(s.katalogId) || s.katalogId === SPEICHER);
  const fassade = wand(einheit, fassadenSeite), gang = wand(einheit, gangSeite);
  const zurPlus = (w: Wand) => (steigzone ? entlangVon(w, steigzone) >= (w.von + w.bis) / 2 : true);
  const erledigt = new Set<string>();

  // 1. Zentrale: Fluss als Reihe an der Rueckwand (gangabgewandt)
  if (zentrale) {
    const basis = eigen.filter((s) => !s.vor && (ERZEUGER.includes(s.katalogId) || s.katalogId === SPEICHER || istVerteiler(s)));
    const rang = (s: SymbolEntwurf) => (ERZEUGER.includes(s.katalogId) ? 0 : s.katalogId === SPEICHER ? 1 : 2);
    const folge = [...basis].sort((a, b) => rang(a) - rang(b)).map((s) => s.schluessel); // stabil: Eingabereihenfolge je Rang
    const verteiler = new Set(basis.filter(istVerteiler).map((s) => s.schluessel));
    for (const s of eigen) {
      if (!s.vor || !folge.includes(s.vor)) continue;
      // nach X (Richtung Verteiler), vor einem Verteiler davor; mehrere Teile vor X in Eingabereihenfolge hintereinander
      let i = folge.indexOf(s.vor);
      if (verteiler.has(s.vor)) { while (i > 0 && eigen.find((e) => e.schluessel === folge[i - 1])?.vor === s.vor) i--; folge.splice(i, 0, s.schluessel); }
      else { while (i + 1 < folge.length && eigen.find((e) => e.schluessel === folge[i + 1])?.vor === s.vor) i++; folge.splice(i + 1, 0, s.schluessel); }
    }
    wandReihen(fassade, folge, m, zurPlus(fassade), RAND, out);
    folge.forEach((k) => erledigt.add(k));
  }

  // 2. Heizkoerper an der Fassade, gleichmaessig verteilt
  const hk = eigen.filter((s) => !erledigt.has(s.schluessel) && !s.vor && eintrag.get(s.katalogId)?.heizArt === "hk");
  hk.forEach((s, k) => {
    out.set(s.schluessel, punkt(fassade, fassade.von + ((fassade.bis - fassade.von) * (2 * k + 1)) / (2 * hk.length), HK_WAND + m(s.schluessel)[2] / 2));
    erledigt.add(s.schluessel);
  });

  // 3. Unterverteiler an der Gangwand, zur Steigzone hin
  const unter = eigen.filter((s) => !erledigt.has(s.schluessel) && !s.vor && istVerteiler(s)).map((s) => s.schluessel);
  wandReihen(gang, unter, m, zurPlus(gang), RASTER_WAND, out);
  unter.forEach((k) => erledigt.add(k));

  // 4. Uebrige (auch "vor X" mit X ausserhalb des Raums) im Raster mit Wandabstand
  const rest = eigen.filter((s) => !erledigt.has(s.schluessel) && (!s.vor || !hier.has(s.vor)));
  const innen: Rechteck = {
    x: einheit.x + Math.min(RASTER_WAND, einheit.breite / 2), z: einheit.z + Math.min(RASTER_WAND, einheit.tiefe / 2),
    breite: Math.max(0, einheit.breite - 2 * RASTER_WAND), tiefe: Math.max(0, einheit.tiefe - 2 * RASTER_WAND),
  };
  raster(innen, rest.length).forEach((p, k) => { out.set(rest[k].schluessel, p); erledigt.add(rest[k].schluessel); });

  // 5. "Vor X" neben X (parallel zur Fassade, zur Raummitte hin); Ketten in mehreren Durchgaengen
  const neben = new Map<string, number>(); // Bezug -> bereits belegter Versatz
  for (let offen = eigen.filter((s) => !erledigt.has(s.schluessel)); offen.length;) {
    const bereit = offen.filter((s) => out.has(s.vor!));
    const liste = bereit.length ? bereit : [offen[0]];
    for (const s of liste) {
      const bezug = out.get(s.vor!) ?? { x: einheit.x + einheit.breite / 2, z: einheit.z + einheit.tiefe / 2 };
      const entlang = entlangVon(fassade, bezug);
      const richtung = entlang <= (fassade.von + fassade.bis) / 2 ? 1 : -1;
      const versatz = (neben.get(s.vor!) ?? (masse.has(s.vor!) ? m(s.vor!)[0] / 2 : 0)) + ABSTAND + m(s.schluessel)[0] / 2;
      neben.set(s.vor!, versatz + m(s.schluessel)[0] / 2);
      out.set(s.schluessel, fassade.entlangX ? { x: bezug.x + richtung * versatz, z: bezug.z } : { x: bezug.x, z: bezug.z + richtung * versatz });
      erledigt.add(s.schluessel);
    }
    offen = offen.filter((s) => !erledigt.has(s.schluessel));
  }

  // 6. Gruppenzubehoer am Verteiler (falls im selben Raum; sonst setzt der Generator)
  for (const s of symbole) if (s.bei && out.has(s.bei)) out.set(s.schluessel, { ...out.get(s.bei)! });

  // Alles in den Raum klemmen
  const klemme = (v: number, a: number, b: number) => Math.min(Math.max(v, a + Math.min(RANDNAH, (b - a) / 2)), b - Math.min(RANDNAH, (b - a) / 2));
  for (const [k, p] of out) out.set(k, { x: klemme(p.x, einheit.x, einheit.x + einheit.breite), z: klemme(p.z, einheit.z, einheit.z + einheit.tiefe) });
  return out;
}
