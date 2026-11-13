import type { Rohrstueck } from "../netz";
import { achsen, boegen, EPS, kreuztImGrundriss, schneidetQuader, segAbstand } from "./geometrie";
import { GRENZEN, type Befund, type Koerper, type PruefLeitung, type V3 } from "./typen";

const schluessel = (p: V3) => p.map((x) => x.toFixed(4)).join(":");

/** Rohrstuecke -> Pruefleitungen. Hauptleitungen bilden ein Netz `haupt`, Verteilleitungen ihr Gruppennetz. */
export function alsPrueflinien(stuecke: Rohrstueck[]): PruefLeitung[] {
  return stuecke.map((r, i) => ({
    id: `${i}:${r.daten.von}>${r.daten.nach}`,
    netz: r.daten.art === "haupt" ? "haupt" : r.daten.gruppeId ?? `ersatz:${r.daten.von}>${r.daten.nach}`,
    punkte: r.punkte, radius: Math.max(r.radius, r.startRadius, r.endRadius), enden: [r.daten.von, r.daten.nach],
  }));
}

function imNahbereich(p: V3, l: PruefLeitung, m: PruefLeitung, koerper: Koerper[]): boolean {
  const n = GRENZEN.geraetNahbereich;
  return koerper.some((k) => (l.enden.includes(k.schluessel) || m.enden.includes(k.schluessel))
    && p.every((x, i) => x >= k.min[i] - n && x <= k.max[i] + n));
}

export function pruefen(leitungen: PruefLeitung[], koerper: Koerper[]): Befund[] {
  const befunde: Befund[] = [];
  const hart = (regel: Befund["regel"], ids: string[], ort: V3) => befunde.push({ regel, leitungen: ids, ort, hart: true });
  for (const l of leitungen) {
    const p = l.punkte;
    for (let i = 1; i < p.length; i++) if (achsen(p[i - 1], p[i]).length > 1) hart("schraeg", [l.id], p[i - 1]);
    for (let i = 2; i < p.length; i++) {
      const u = achsen(p[i - 2], p[i - 1]), v = achsen(p[i - 1], p[i]);
      if (u.length === 1 && v.length === 1 && u[0] === v[0]
        && Math.sign(p[i - 1][u[0]] - p[i - 2][u[0]]) !== Math.sign(p[i][u[0]] - p[i - 1][u[0]])) hart("rueckwaerts", [l.id], p[i - 1]);
    }
    if (boegen(p) > GRENZEN.maxBoegen) hart("boegen", [l.id], p[0]);
    for (let i = 1; i < p.length; i++) for (let j = i + 2; j < p.length; j++) {
      if (segAbstand(p[i - 1], p[i], p[j - 1], p[j]).d < l.radius - EPS) hart("selbst", [l.id], p[i]);
    }
    for (const k of koerper) {
      if (l.enden.includes(k.schluessel)) continue;
      const r = l.radius, min: V3 = [k.min[0] - r, k.min[1] - r, k.min[2] - r];
      const max: V3 = [k.max[0] + r, k.max[1] + r + GRENZEN.luftUeberGeraet, k.max[2] + r];
      for (let i = 1; i < p.length; i++) if (schneidetQuader(p[i - 1], p[i], min, max)) { hart("durch_geraet", [l.id, k.schluessel], p[i]); break; }
    }
  }
  for (let x = 0; x < leitungen.length; x++) for (let y = x + 1; y < leitungen.length; y++) {
    const l = leitungen[x], m = leitungen[y];
    const gemeinsam = new Set(l.punkte.map(schluessel).filter((s) => m.punkte.some((q) => schluessel(q) === s)));
    const grenze = l.radius + m.radius + GRENZEN.fuge;
    for (let i = 1; i < l.punkte.length; i++) for (let j = 1; j < m.punkte.length; j++) {
      const a = l.punkte[i - 1], b = l.punkte[i], c = m.punkte[j - 1], d = m.punkte[j];
      const r = segAbstand(a, b, c, d);
      if (l.netz === m.netz) {
        // Im selben Netz: Beruehrung nur als T-Abzweig (Endpunkt der einen Strecke auf der anderen) oder an gemeinsamen Punkten.
        if (r.d >= grenze - EPS) continue;
        const nahGemeinsam = [...gemeinsam].some((s) => { const q = s.split(":").map(Number) as V3; return Math.hypot(q[0] - r.a[0], q[1] - r.a[1], q[2] - r.a[2]) < grenze; });
        const tAbzweig = [a, b].some((e) => segAbstand(e, e, c, d).d < EPS) || [c, d].some((e) => segAbstand(e, e, a, b).d < EPS);
        const kollinear = achsen(a, b).length === 1 && achsen(c, d).length === 1 && achsen(a, b)[0] === achsen(c, d)[0] && r.d < EPS;
        const ueberlappung = kollinear ? Math.min(Math.max(a[achsen(a, b)[0]], b[achsen(a, b)[0]]), Math.max(c[achsen(a, b)[0]], d[achsen(a, b)[0]]))
          - Math.max(Math.min(a[achsen(a, b)[0]], b[achsen(a, b)[0]]), Math.min(c[achsen(a, b)[0]], d[achsen(a, b)[0]])) : 0;
        if (ueberlappung > 0.01 || (!tAbzweig && !nahGemeinsam)) hart("abstand", [l.id, m.id], r.a);
        continue;
      }
      if (r.d < grenze - EPS) {
        if (!imNahbereich(r.a, l, m, koerper)) hart("abstand", [l.id, m.id], r.a);
      } else if (Math.abs(a[1] - b[1]) < EPS && Math.abs(c[1] - d[1]) < EPS && Math.abs(a[1] - c[1]) < 0.5 && kreuztImGrundriss(a, b, c, d)) {
        befunde.push({ regel: "kreuzung", leitungen: [l.id, m.id], ort: r.a, hart: false });
      }
    }
  }
  return befunde;
}
