import * as THREE from "three";
import { TOKENS } from "../design/tokens";
import type { Ampel } from "../lebensdauer/typen";
import type { V3 } from "../szene2/huelle";
import { ACHSE } from "./rohrStaerke";

/**
 * Prüfmanschetten im Modus Erneuerung (Entscheid 22.11.2026, Ansatz C Stufe 1; Kritik r1): Der Zustand sitzt am Bauteil
 * selbst. Stehende Anlage: Band auf halber Gehäusehöhe. Pumpe in der Leitung: Band um den Motorkopf. Ventil/Zähler: Ring
 * auf dem Rohr dicht am eigenen Teil und mit Abstand zum fremden, sonst Band ums Teil. Verteiler: zwei kurze Kragen an
 * den Enden des oberen Balkens (kein Rundumband: Fläche nach Dringlichkeit, nicht nach Gerätegrösse).
 * Form zusätzlich zur Farbe: Rot zwei Ringe, Gelb breit, Grün schmal, Grau gestrichelt. Nichts wird vom Bauteil weggeschoben.
 * Reine, deterministische Ableitungen; Werte aus TOKENS.erneuerung.manschette.
 */
const M = TOKENS.erneuerung.manschette;

export type ManschettenArt = "rohr" | "gehaeuse";
/** Höhenlage eines Rings relativ zur Manschettenmitte (Meter). */
export interface Ring { y0: number; y1: number }

/** Ringe je Ampelstufe: Rot doppelt, sonst einer; Höhe nach Stufe (Gelb breit, Grün schmal). */
export function ringe(ampel: Ampel, art: ManschettenArt): Ring[] {
  const h = (art === "rohr" ? M.hoeheRohrM : M.hoeheGehaeuseM)[ampel];
  if (ampel !== "rot") return [{ y0: -h / 2, y1: h / 2 }];
  const l = art === "rohr" ? M.rotLueckeRohrM : M.rotLueckeGehaeuseM;
  return [{ y0: -l / 2 - h, y1: -l / 2 }, { y0: l / 2, y1: l / 2 + h }];
}
/** Gesamthöhe der Manschette einer Stufe. */
export const gesamtHoehe = (ampel: Ampel, art: ManschettenArt) => {
  const r = ringe(ampel, art);
  return r[r.length - 1].y1 - r[0].y0;
};

/** Modellmasse (GLB, docs/design/modelle): Motor der Umwälzpumpe, oberer Verteilerbalken. */
export const PUMPE = { motorRadius: 0.075, motorLaenge: 0.16, motorVersatz: 0.15 } as const;
export const VERTEILER = { balkenRadius: 0.05, balkenY: 0.62, balkenZ: 0.02, endeEinzug: 0.03 } as const;

/** Ein gezeichnetes Bauteil (Achsmasse in Einbaulage). `rohrRadius` nur für Teile in der Leitung. */
export interface ManschettenTeil {
  schluessel: string; mitte: V3; masse: V3; inline: boolean; ampel: Ampel;
  /** Gehäuseform: rund (Speicher), Pumpe (Band um den Motor), Verteiler (Kragen am Balken). */
  form?: "rund" | "pumpe" | "verteiler";
  rohrRadius?: number;
}
export interface Manschette {
  schluessel: string; art: ManschettenArt; ampel: Ampel;
  /** Bezugspunkt: Mitte (richtung 0) bzw. Kante zum eigenen Teil, von der die Manschette wegwächst (richtung ±1). */
  mitte: V3;
  /** Ringachse in der Welt. */
  achse: "x" | "y" | "z";
  /** 0 = symmetrisch um mitte; +1/−1 = von mitte aus entlang +/− Achse (wächst beim Strecken vom eigenen Teil weg). */
  richtung: 0 | 1 | -1;
  /** Innenkontur (abgerundetes Rechteck bzw. Kreis), Meter. */
  breite: number; tiefe: number; eckRadius: number; dicke: number;
  /** Ring am Rohr: verdickt mit der Leitung (Bildschirm-Mindeststärke). */
  verdicken: boolean;
  /** Folgt dem Anheben der Anlage bei Hover/Auswahl. */
  hebt: boolean;
  /** Grösste Gesamthöhe beim Strecken aus der Distanz (Platz bis zum fremden Teil bzw. Gehäuse). */
  maxHoehe: number;
}

const GLEICHE_ACHSE = 1e-3;
/** Freiraum unter dem untersten Teil eines Stocks (Abgangsstutzen mit Kugelhahn, gruppenNetz.STOCK_UNTEN) [A]. */
const UNTEN_FREI = 0.05;

/** Manschette(n) je Bauteil; der Verteiler trägt zwei Kragen. */
export function manschetten(teile: ManschettenTeil[]): Manschette[] {
  const inline = teile.filter((t) => t.inline);
  return teile.flatMap((t): Manschette[] => {
    const basis = { schluessel: t.schluessel, ampel: t.ampel };
    const band = (mitte: V3, b: number, d: number, eck: number, hebt: boolean, maxHoehe: number,
      achse: Manschette["achse"] = "y"): Manschette => ({
      ...basis, art: "gehaeuse", mitte, achse, richtung: 0, breite: b, tiefe: d, eckRadius: Math.min(eck, b / 2, d / 2),
      dicke: t.ampel === "gruen" ? M.gehaeuseDickeGruenM : t.ampel === "rot" ? M.gehaeuseDickeRotM : M.gehaeuseDickeM, verdicken: false, hebt, maxHoehe,
    });
    const a = M.gehaeuseAbstandM;
    const kasten = (hebt: boolean) => band(t.mitte, t.masse[0] + 2 * a, t.masse[2] + 2 * a,
      t.form === "rund" ? Infinity : TOKENS.radius.geraetM + a, hebt, t.masse[1] * 0.6);
    if (t.form === "verteiler" && !t.inline) {
      const r = VERTEILER.balkenRadius * M.rohrInnenFaktor, x = t.mitte[0], halb = t.masse[0] / 2 - VERTEILER.endeEinzug;
      const y = t.mitte[1] - t.masse[1] / 2 + VERTEILER.balkenY, z = t.mitte[2] + VERTEILER.balkenZ;
      return ([1, -1] as const).map((s) => ({ ...basis, art: "rohr", achse: "x", richtung: (-s) as 1 | -1,
        mitte: [x + s * halb, y, z], breite: 2 * r, tiefe: 2 * r, eckRadius: r, dicke: M.kragenDickeM,
        verdicken: false, hebt: true, maxHoehe: Math.max(gesamtHoehe(t.ampel, "rohr"), halb * 0.4) }));
    }
    if (!t.inline) return [kasten(true)];
    if (t.form === "pumpe") {
      const d = 2 * (PUMPE.motorRadius + a);
      return [band([t.mitte[0], t.mitte[1], t.mitte[2] + PUMPE.motorVersatz], d, d, Infinity, false, PUMPE.motorLaenge, "z")];
    }
    if (!t.rohrRadius) return [kasten(false)];
    const [x, y, z] = t.mitte, halb = t.masse[1] / 2;
    const achse = inline.filter((o) => o !== t && Math.abs(o.mitte[0] - x) < GLEICHE_ACHSE && Math.abs(o.mitte[2] - z) < GLEICHE_ACHSE);
    const oben = Math.min(Infinity, ...achse.filter((o) => o.mitte[1] > y).map((o) => o.mitte[1] - o.masse[1] / 2)) - (y + halb);
    const unter = achse.filter((o) => o.mitte[1] < y);
    const unten = unter.length ? (y - halb) - Math.max(...unter.map((o) => o.mitte[1] + o.masse[1] / 2)) : UNTEN_FREI;
    const h = gesamtHoehe(t.ampel, "rohr"), rand = M.rohrAbstandM + M.fremdAbstandM;
    const r = t.rohrRadius, ring = (cy: number, richtung: 1 | -1, fuge: number): Manschette => ({ ...basis, art: "rohr",
      mitte: [x, cy, z], achse: "y", richtung, breite: 2 * r * M.rohrInnenFaktor, tiefe: 2 * r * M.rohrInnenFaktor,
      eckRadius: r * M.rohrInnenFaktor, dicke: r * (M.rohrAussenFaktor - M.rohrInnenFaktor), verdicken: true, hebt: false,
      maxHoehe: fuge - rand });
    if (oben >= h + rand) return [ring(y + halb + M.rohrAbstandM, 1, oben)];
    if (unten >= h + rand) return [ring(y - halb - M.rohrAbstandM, -1, unten)];
    return [kasten(false)];
  });
}

/**
 * Höhenfaktor aus dem orthografischen Zoom (px pro Meter): nah 1; aus der Distanz erreicht die Gesamthöhe der Stufe
 * zielPx (Grün zielPxGruen), höchstens maxFaktor und nie über maxHoehe hinaus; ganz nah gedeckelt (deckelEinpassung).
 */
export function manschettenFaktor(m: Pick<Manschette, "ampel" | "art" | "maxHoehe">, zoom: number, basisZoom = 0): number {
  if (!(zoom > 0)) return 1;
  const h = gesamtHoehe(m.ampel, m.art), ziel = m.ampel === "gruen" ? M.zielPxGruen : M.zielPx;
  let k = Math.min(M.maxFaktor, Math.max(1, ziel / (h * zoom)), Math.max(1, m.maxHoehe / h));
  // Ab deckelEinpassung × Einpasszoom bleibt die Bildschirmhöhe stehen (Kritik r2: Bildfüllung ruhiger).
  const deckel = basisZoom * M.deckelEinpassung;
  if (basisZoom > 0 && zoom > deckel) k = Math.min(k, deckel / zoom);
  return Math.round(k * 20) / 20;
}

/** Anzahl Striche auf einem Umfang `L`: Strich mindestens strichMinHoehen × Bandhöhe (Kritik r2), mindestens strichMin. */
export function strichAnzahl(L: number, hoehe: number): number {
  const strich = Math.max(TOKENS.erneuerung.strichM, M.strichMinHoehen * hoehe);
  return Math.max(M.strichMin, Math.floor(L * M.strichAnteil / strich));
}

/** Strichstücke eines gestrichelten Rings als Anteile des Umfangs [von, bis]; `n` Striche, beginnend bei 0. */
export function striche(n: number, anteil: number = M.strichAnteil): [number, number][] {
  return Array.from({ length: n }, (_, i) => [i / n, (i + anteil) / n]);
}

/** Geschlossene Kontur eines abgerundeten Rechtecks (Kreis bei Eckradius = halbe Breite = halbe Tiefe) in der xz-Ebene. */
export function kontur(breite: number, tiefe: number, eckRadius: number, schritte = 8): [number, number][] {
  const r = Math.max(0, Math.min(eckRadius, breite / 2, tiefe / 2)), hx = breite / 2 - r, hz = tiefe / 2 - r;
  const mitten: [number, number][] = [[hx, hz], [-hx, hz], [-hx, -hz], [hx, -hz]];
  const punkte: [number, number][] = [];
  mitten.forEach(([cx, cz], q) => {
    for (let k = 0; k <= schritte; k++) {
      const w = (q + k / schritte) * Math.PI / 2;
      punkte.push([cx + r * Math.cos(w), cz + r * Math.sin(w)]);
    }
  });
  return punkte;
}

/** Umfang einer geschlossenen Kontur. */
export function umfang(p: [number, number][]): number {
  let l = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; l += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return l;
}

/**
 * Geometrie einer Manschette um die lokale y-Achse: je Ring Aussen-, Innenwand, Ober- und Unterseite, bei Strichen auch
 * Stirnflächen; Dreiecke zeigen nach aussen (für einen Rand mit BackSide). Farbattribut = Helligkeit (Aussenwand 1,
 * übrige Flächen kanteHelligkeit). `rand` vergrössert den Körper allseitig (Hover-Rand). Ringe am Rohr erhalten die
 * Achse für die Bildschirm-Mindeststärke.
 */
export function manschettenGeometrie(m: Manschette, rand = 0): THREE.BufferGeometry {
  const innen = kontur(m.breite - 2 * rand, m.tiefe - 2 * rand, m.eckRadius - rand);
  const aussen = kontur(m.breite + 2 * (m.dicke + rand), m.tiefe + 2 * (m.dicke + rand), m.eckRadius + m.dicke + rand);
  const n = innen.length;
  // Bogenlänge auf der Aussenkontur: Strichstücke gleich lang auf der sichtbaren Seite.
  const s = [0];
  for (let i = 1; i <= n; i++) s.push(s[i - 1] + Math.hypot(aussen[i % n][0] - aussen[i - 1][0], aussen[i % n][1] - aussen[i - 1][1]));
  const L = s[n];
  const bei = (pfad: [number, number][], t: number): [number, number] => {
    const ziel = t * L;
    let i = 0;
    while (i < n - 1 && s[i + 1] < ziel) i++;
    const f = s[i + 1] > s[i] ? (ziel - s[i]) / (s[i + 1] - s[i]) : 0, a = pfad[i], b = pfad[(i + 1) % n];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  const stuecke: [number, number][] = m.ampel === "grau" ? striche(strichAnzahl(L, gesamtHoehe("grau", m.art))) : [[0, 1]];
  const pos: number[] = [], hell: number[] = [];
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  /** Viereck mit gewünschter Aussenrichtung `nach` (Wicklung danach ausgerichtet). */
  const quad = (a: V3, b: V3, c: V3, d: V3, nach: V3, h: number = M.kanteHelligkeit) => {
    v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(w.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
    const folge = v.dot(w.set(...nach)) >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const p of folge) pos.push(...p);
    for (let i = 0; i < 6; i++) hell.push(h, h, h);
  };
  const H = gesamtHoehe(m.ampel, m.art), schub = m.richtung * H / 2;
  for (const ring of ringe(m.ampel, m.art)) {
    const y0 = ring.y0 + schub - rand, y1 = ring.y1 + schub + rand;
    for (const [von, bis] of stuecke) {
      const zu = bis - von >= 1;
      const ts = [von, ...s.slice(1, n).map((x) => x / L).filter((t) => t > von && t < bis), ...(zu ? [] : [bis])];
      const ip = ts.map((t) => bei(innen, t)), ap = ts.map((t) => bei(aussen, t));
      if (zu) { ip.push(ip[0]); ap.push(ap[0]); }
      for (let k = 0; k < ip.length - 1; k++) {
        const [i0, i1, a0, a1] = [ip[k], ip[k + 1], ap[k], ap[k + 1]];
        const radial: V3 = [(a0[0] + a1[0]) / 2 - (i0[0] + i1[0]) / 2, 0, (a0[1] + a1[1]) / 2 - (i0[1] + i1[1]) / 2];
        const einwaerts: V3 = [-radial[0], 0, -radial[2]];
        quad([a0[0], y0, a0[1]], [a1[0], y0, a1[1]], [a1[0], y1, a1[1]], [a0[0], y1, a0[1]], radial, 1);
        quad([i0[0], y0, i0[1]], [i1[0], y0, i1[1]], [i1[0], y1, i1[1]], [i0[0], y1, i0[1]], einwaerts);
        quad([i0[0], y1, i0[1]], [i1[0], y1, i1[1]], [a1[0], y1, a1[1]], [a0[0], y1, a0[1]], [0, 1, 0]);
        quad([i0[0], y0, i0[1]], [i1[0], y0, i1[1]], [a1[0], y0, a1[1]], [a0[0], y0, a0[1]], [0, -1, 0]);
      }
      // Stirnflächen der Striche: Aussenrichtung vom Nachbarpunkt weg.
      if (!zu && ip.length > 1) for (const [k, j] of [[0, 1], [ip.length - 1, ip.length - 2]] as const) {
        const raus: V3 = [ip[k][0] + ap[k][0] - ip[j][0] - ap[j][0], 0, ip[k][1] + ap[k][1] - ip[j][1] - ap[j][1]];
        quad([ip[k][0], y0, ip[k][1]], [ap[k][0], y0, ap[k][1]], [ap[k][0], y1, ap[k][1]], [ip[k][0], y1, ip[k][1]], raus);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(hell, 3));
  if (m.verdicken) {
    const achse = new Float32Array(pos.length);
    for (let i = 1; i < pos.length; i += 3) achse[i] = pos[i];
    g.setAttribute(ACHSE, new THREE.BufferAttribute(achse, 3));
  }
  g.computeBoundingSphere();
  return g;
}
