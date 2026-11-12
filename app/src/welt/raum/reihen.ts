import type { RaumMatrix } from "../regelwerk.js";
import type { Grundform, Hinweis, Rechteck } from "../typen.js";
import { reihenSegmente, segmentLaenge, type Fluegel, type Seite } from "./form.js";

export interface ReihenOptionen {
  /** Vorbelegung je Reihe in Modulen (L/U: die innere Reihe ist um den Eckverlust kuerzer). */
  vorlauf?: [number, number];
  /** Kapazitaet je Reihe in Modulen: Zuteilung nach Fuellgrad statt nach absoluter Laenge. */
  kapazitaet?: [number, number];
}

/**
 * Verteilt Raeume auf die zwei Reihen beidseits des Gangs (Spec 5.2): groesste zuerst (Gleichstand: Eingabereihenfolge),
 * jeweils in die kuerzere Reihe (Gleichstand: Reihe 0). Ergebnis je Reihe in Eingabereihenfolge.
 */
export function verteileReihen(raeume: { id: string; laenge: number }[], opt: ReihenOptionen = {}): [string[], string[]] {
  const vorlauf = opt.vorlauf ?? [0, 0], kap = opt.kapazitaet ?? [1, 1];
  const last = [vorlauf[0], vorlauf[1]];
  const reihe = new Map<string, 0 | 1>();
  const sortiert = raeume.map((r, i) => ({ r, i })).sort((a, b) => b.r.laenge - a.r.laenge || a.i - b.i);
  for (const { r } of sortiert) {
    const k: 0 | 1 = (last[1] + r.laenge) / kap[1] < (last[0] + r.laenge) / kap[0] - 1e-9 ? 1 : 0;
    last[k] += r.laenge;
    reihe.set(r.id, k);
  }
  return [raeume.filter((r) => reihe.get(r.id) === 0).map((r) => r.id), raeume.filter((r) => reihe.get(r.id) === 1).map((r) => r.id)];
}

/**
 * Teilt `gesamt` auf Raeume mit Grundlaengen `basis` auf: gleichmaessig gestreckt, aber jede Laenge in [min, max]
 * (Seitenverhaeltnis). Ein Raum an der Grenze gibt die Restlaenge an die Nachbarn ab (Spec 5.2).
 * Nicht loesbar (n x max < gesamt oder n x min > gesamt): gleichmaessig gestreckt, `ok = false`.
 */
export function verteileLaenge(basis: number[], gesamt: number, min: number, max: number): { laengen: number[]; ok: boolean } {
  const n = basis.length, eps = 1e-9;
  const summe = basis.reduce((s, b) => s + b, 0);
  const gleich = basis.map((b) => (b * gesamt) / summe);
  if (n === 0) return { laengen: [], ok: true };
  if (n * max < gesamt - eps || n * min > gesamt + eps) return { laengen: gleich, ok: false };
  const fest: (number | null)[] = basis.map(() => null);
  let l = gleich;
  for (let runde = 0; runde <= n; runde++) {
    const rest = gesamt - fest.reduce<number>((s, f) => s + (f ?? 0), 0);
    const frei = basis.reduce((s, b, i) => s + (fest[i] === null ? b : 0), 0);
    l = basis.map((b, i) => fest[i] ?? (frei > 0 ? (b * rest) / frei : 0));
    const ueber = l.map((x, i) => fest[i] === null && x > max + eps);
    const unter = l.map((x, i) => fest[i] === null && x < min - eps);
    if (ueber.some(Boolean)) ueber.forEach((u, i) => { if (u) fest[i] = max; });
    else if (unter.some(Boolean)) unter.forEach((u, i) => { if (u) fest[i] = min; });
    else break;
  }
  return { laengen: l, ok: true };
}

/** Teilt die Raeume einer Reihe (in Reihenfolge) zusammenhaengend auf die Abschnitte auf: Raummitte nach Kapazitaetsanteil. */
function aufAbschnitte(laengen: number[], kap: number[]): number[][] {
  const summe = laengen.reduce((s, x) => s + x, 0), C = kap.reduce((s, x) => s + x, 0);
  const grenzen = kap.map((_, j) => (kap.slice(0, j + 1).reduce((s, x) => s + x, 0) / C) * summe);
  const gruppen: number[][] = kap.map(() => []);
  let kum = 0;
  laengen.forEach((x, i) => {
    const mitte = kum + x / 2;
    const j = grenzen.findIndex((g) => mitte < g - 1e-9);
    gruppen[j === -1 ? kap.length - 1 : j].push(i);
    kum += x;
  });
  // Leere Abschnitte vermeiden, solange ein Nachbar mindestens zwei Raeume hat (Reihenfolge bleibt erhalten)
  for (let wechsel = true, runde = 0; wechsel && runde < laengen.length * kap.length; runde++) {
    wechsel = false;
    for (let j = 0; j < gruppen.length; j++) {
      if (gruppen[j].length) continue;
      if (j > 0 && gruppen[j - 1].length >= 2) { gruppen[j].unshift(gruppen[j - 1].pop()!); wechsel = true; }
      else if (j < gruppen.length - 1 && gruppen[j + 1].length >= 2) { gruppen[j].push(gruppen[j + 1].shift()!); wechsel = true; }
    }
  }
  return gruppen;
}

export interface RaumLage { rechteck: Rechteck; gang: Seite }

/**
 * Raeume eines Geschosses in die Huelle legen (Spec 5.2): zwei Reihen beidseits des Gangs entlang des Fluegelpfads,
 * jede Reihe gleichmaessig auf ihre volle Laenge gestreckt, Seitenverhaeltnis hoechstens `seitenMax`
 * (sonst Hinweis `seitenverhaeltnis`). Laengen in Modulen, Ergebnis in Metern.
 */
export function layoutGeschoss(raeume: { id: string; laenge: number }[], form: Grundform, fluegel: Fluegel[], raum: RaumMatrix): { rechtecke: Map<string, RaumLage>; hinweise: Hinweis[] } {
  const reihen = reihenSegmente(form, fluegel, raum);
  const kap = reihen.map((r) => r.reduce((s, x) => s + segmentLaenge(x), 0)) as [number, number];
  const zuteilung = verteileReihen(raeume, { kapazitaet: kap });
  const laengeVon = new Map(raeume.map((x) => [x.id, x.laenge]));
  const rechtecke = new Map<string, RaumLage>();
  const hinweise: Hinweis[] = [];
  const m = (v: number) => Math.round(v * raum.modulM * 1000) / 1000;
  reihen.forEach((segmente, k) => {
    const ids = zuteilung[k];
    const gruppen = aufAbschnitte(ids.map((id) => laengeVon.get(id)!), segmente.map(segmentLaenge));
    segmente.forEach((s, j) => {
      const teil = gruppen[j].map((i) => ids[i]);
      const quer = s.richtung === "x" ? s.tiefe : s.breite;
      const lang = segmentLaenge(s);
      const { laengen } = verteileLaenge(teil.map((id) => laengeVon.get(id)!), lang, quer / raum.seitenMax, quer * raum.seitenMax);
      let pos = 0;
      teil.forEach((id, i) => {
        const von = s.umgekehrt ? lang - pos - laengen[i] : pos, bis = von + laengen[i];
        pos += laengen[i];
        const [x0, x1, z0, z1] = s.richtung === "x" ? [s.x + von, s.x + bis, s.z, s.z + s.tiefe] : [s.x, s.x + s.breite, s.z + von, s.z + bis];
        const rechteck = { x: m(x0), z: m(z0), breite: Math.round((m(x1) - m(x0)) * 1000) / 1000, tiefe: Math.round((m(z1) - m(z0)) * 1000) / 1000 };
        if (Math.max(laengen[i], quer) / Math.min(laengen[i], quer) > raum.seitenMax + 1e-9) hinweise.push({ code: "seitenverhaeltnis", bezug: id });
        rechtecke.set(id, { rechteck, gang: s.gang });
      });
    });
  });
  const rang = new Map(raeume.map((x, i) => [x.id, i]));
  hinweise.sort((a, b) => rang.get(a.bezug)! - rang.get(b.bezug)!);
  return { rechtecke, hinweise };
}
