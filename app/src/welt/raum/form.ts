import type { RaumMatrix } from "../regelwerk.js";
import type { Grundform, Rechteck } from "../typen.js";

/** Gebaeudefluegel in Modulen: Rechteck ab (x0, z0), `laenge` entlang `richtung`, `tiefe` quer dazu. */
export interface Fluegel { x0: number; z0: number; laenge: number; tiefe: number; richtung: "x" | "z" }
export type Seite = "+x" | "-x" | "+z" | "-z";
/**
 * Abschnitt einer Raumreihe (Module): Raeume liegen entlang `richtung` hintereinander, quer dazu ueber die ganze Reihentiefe.
 * `umgekehrt`: Pfadrichtung laeuft gegen die Koordinate. `gang`: Seite, an der der Gang liegt (Fassade gegenueber).
 */
export interface Segment extends Rechteck { richtung: "x" | "z"; umgekehrt: boolean; gang: Seite }

export const segmentLaenge = (s: Segment) => (s.richtung === "x" ? s.breite : s.tiefe);
export const gegenueber = (s: Seite): Seite => ((s[0] === "+" ? "-" : "+") + s[1]) as Seite;

/**
 * Fluegelpfad der Grundform (Spec 5.2). `laengeModule` = verlangte Laenge der aeusseren Reihe, `tiefeModule` = Gebaeudetiefe
 * (2 x Raumtiefe + Gang). Rechteck/Quadrat: ein Fluegel; L: Riegel + Schenkel (Ecke geteilt); U: Schenkel, Riegel, Schenkel.
 */
export function formPfad(form: Grundform, laengeModule: number, tiefeModule: number, raum: RaumMatrix): Fluegel[] {
  const g = raum.gangModule;
  const D = Math.max(tiefeModule, raum.minGebaeude[1]);
  const t = (D - g) / 2;
  const fl = (x0: number, laenge: number, richtung: "x" | "z", tiefe = D): Fluegel => ({ x0, z0: 0, laenge, tiefe, richtung });
  if (form === "quader") return [fl(0, Math.max(laengeModule, raum.minGebaeude[0]), "x")];
  if (form === "quadrat") {
    let s = Math.max(laengeModule, D, raum.minGebaeude[0]);
    if ((s - g) % 2 !== 0) s += 1; // ganzzahlige Reihentiefe
    return [fl(0, s, "x", s)];
  }
  const schenkelMin = D + 2; // mindestens 2 Module ueber die Ecke hinaus
  if (form === "l_form") {
    const summe = laengeModule + t; // aeussere Reihe = a + b - t
    const a = Math.ceil(summe / 2);
    return [fl(0, Math.max(a, schenkelMin), "x"), fl(0, Math.max(summe - a, schenkelMin), "z")];
  }
  const summe = laengeModule + 2 * t; // aeussere Reihe = a + 2b - 2t
  const b0 = Math.floor(summe / 3);
  const a = Math.max(summe - 2 * b0, 2 * D + 2), b = Math.max(b0, schenkelMin); // Hof mindestens 2 Module
  return [fl(0, b, "z"), fl(0, a, "x"), fl(a - D, b, "z")];
}

/** Grundriss in Metern: Riegel (x-Fluegel) ganz, Schenkel (z-Fluegel) ohne die geteilte Ecke. Ersetzt `grundriss()` fuer v2. */
export function grundrissAusFluegeln(f: Fluegel[], raum: RaumMatrix): Rechteck[] {
  const m = raum.modulM, mm = (v: number) => Math.round(v * m * 1000) / 1000;
  const riegel = f.filter((x) => x.richtung === "x");
  const schenkel = f.filter((x) => x.richtung === "z");
  return [
    ...riegel.map((x) => ({ x: mm(x.x0), z: mm(x.z0), breite: mm(x.laenge), tiefe: mm(x.tiefe) })),
    ...schenkel.map((x) => {
      const ab = riegel.length ? x.tiefe : 0;
      return { x: mm(x.x0), z: mm(x.z0 + ab), breite: mm(x.tiefe), tiefe: mm(x.laenge - ab) };
    }),
  ];
}

/**
 * Die zwei Raumreihen (aussen, innen) als Abschnitte entlang des Fluegelpfads; dazwischen liegt der Gang (Module).
 * L/U: die aeussere Reihe laeuft um die Ecke, die innere schliesst die innere Ecke mit ein.
 */
export function reihenSegmente(form: Grundform, f: Fluegel[], raum: RaumMatrix): [Segment[], Segment[]] {
  const g = raum.gangModule;
  const s = (x: number, z: number, breite: number, tiefe: number, richtung: "x" | "z", umgekehrt: boolean, gang: Seite): Segment =>
    ({ x, z, breite, tiefe, richtung, umgekehrt, gang });
  const lang = (x: Segment) => segmentLaenge(x) > 1e-9;
  if (form === "quader" || form === "quadrat") {
    const [w] = f;
    const t = (w.tiefe - g) / 2;
    return [[s(0, 0, w.laenge, t, "x", false, "+z")], [s(0, t + g, w.laenge, t, "x", false, "-z")]];
  }
  if (form === "l_form") {
    const a = f[0].laenge, b = f[1].laenge, D = f[0].tiefe, t = (D - g) / 2;
    return [
      [s(0, 0, a, t, "x", true, "+z"), s(0, t, t, b - t, "z", false, "+x")].filter(lang),
      [s(t + g, t + g, a - t - g, t, "x", true, "-z"), s(t + g, D, t, b - D, "z", false, "-x")].filter(lang),
    ];
  }
  const b = f[0].laenge, a = f[1].laenge, D = f[1].tiefe, t = (D - g) / 2;
  return [
    [s(0, t, t, b - t, "z", true, "+x"), s(0, 0, a, t, "x", false, "+z"), s(a - t, t, t, b - t, "z", false, "-x")].filter(lang),
    [s(t + g, D, t, b - D, "z", true, "-x"), s(t + g, t + g, a - 2 * (t + g), t, "x", false, "-z"), s(a - D, D, t, b - D, "z", false, "+x")].filter(lang),
  ];
}
