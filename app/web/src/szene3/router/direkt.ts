import { schneidetQuader, segAbstand } from "./geometrie";
import { GRENZEN, ROUTER, type Koerper, type PruefLeitung, type V3 } from "./typen";

/**
 * Direktverbindung naher Geraete (PO 15.11.2026, Spec-Nachtrag 9): Eine Hauptleitung zwischen zwei Geraeten im selben
 * Raum laeuft auf Anschlusshoehe statt ueber die Leitungsebene, wenn die Anschluesse waagrecht hoechstens `maxAbstand`
 * auseinanderliegen und ein freier Weg existiert. Werte [A].
 */
export const DIREKT = {
  /** Groesster waagrechter Abstand der Anschlussfuesse, Meter [A]. */
  maxAbstand: 2.0,
  /** Hoechstens so weit ueber dem hoeheren Fuss wird ein freier Weg gesucht, Meter [A]. */
  maxAnhebung: 1.2,
  /** Mindestabstand des Wegs unter der Leitungsebene, Meter [A]. */
  unterLauf: 0.3,
} as const;

const EPS = 1e-6;

function bereinigt(p: V3[]): V3[] {
  const q: V3[] = [];
  for (const x of p) {
    if (q.length && Math.abs(q[q.length - 1][0] - x[0]) < EPS && Math.abs(q[q.length - 1][1] - x[1]) < EPS && Math.abs(q[q.length - 1][2] - x[2]) < EPS) continue;
    q.push(x);
    while (q.length >= 3) {
      const [a, b, c] = q.slice(-3);
      const ab = [0, 1, 2].filter((i) => Math.abs(a[i] - b[i]) > EPS), bc = [0, 1, 2].filter((i) => Math.abs(b[i] - c[i]) > EPS);
      if (ab.length !== 1 || bc.length !== 1 || ab[0] !== bc[0] || Math.sign(b[ab[0]] - a[ab[0]]) !== Math.sign(c[ab[0]] - b[ab[0]])) break;
      q.splice(q.length - 2, 1);
    }
  }
  return q;
}

/** Wie Pruefer-Regel `selbst`: nicht benachbarte Stuecke naeher als der Rohrradius (enges U aus kurzem Querstueck). */
function engeSchlaufe(p: V3[], radius: number): boolean {
  for (let i = 1; i < p.length; i++) for (let j = i + 2; j < p.length; j++) {
    if (segAbstand(p[i - 1], p[i], p[j - 1], p[j]).d < radius - EPS) return true;
  }
  return false;
}

const senkrecht = (a: V3, b: V3) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[2] - b[2]) < EPS;

/**
 * Rechtwinkliger Weg von Fuss A zu Fuss B (Punkte am Fuss der jeweiligen Anschluss-Steigleitung): senkrecht auf eine
 * gemeinsame Hoehe, waagrecht (zuerst x oder zuerst z), senkrecht zum Fuss B. Gesucht ab der hoeheren Fusshoehe in
 * Zellschritten. Die waagrechten Stuecke halten Abstand zu allen Geraetekoerpern (auch den eigenen, Pruefer-Mass samt
 * Luft ueber Geraet) und zu fremden Leitungen (`hindernisse` anderer Netze, r + r2 + Fuge). Ohne freien Weg: null.
 */
export function direktVerbindung(fA: V3, fB: V3, radius: number, laufY: number, koerper: Koerper[], hindernisse: PruefLeitung[], netz: string): V3[] | null {
  if (Math.hypot(fA[0] - fB[0], fA[2] - fB[2]) > DIREKT.maxAbstand + EPS) return null;
  const y0 = Math.max(fA[1], fB[1]), yMax = Math.min(laufY - DIREKT.unterLauf, y0 + DIREKT.maxAnhebung);
  const fremd = hindernisse.filter((h) => h.netz !== netz);
  const frei = (p: V3[]) => {
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      // Die senkrechten Stuecke an den Fuessen stehen dort, wo der Anschluss ohnehin aufsteigen wuerde.
      const amFuss = senkrecht(a, b) && ((Math.abs(a[0] - fA[0]) < EPS && Math.abs(a[2] - fA[2]) < EPS) || (Math.abs(a[0] - fB[0]) < EPS && Math.abs(a[2] - fB[2]) < EPS));
      if (!amFuss) for (const k of koerper) {
        const min: V3 = [k.min[0] - radius, k.min[1] - radius, k.min[2] - radius];
        const max: V3 = [k.max[0] + radius, k.max[1] + radius + GRENZEN.luftUeberGeraet, k.max[2] + radius];
        if (schneidetQuader(a, b, min, max)) return false;
      }
      for (const h of fremd) for (let j = 1; j < h.punkte.length; j++) {
        if (segAbstand(a, b, h.punkte[j - 1], h.punkte[j]).d < radius + h.radius + GRENZEN.fuge - EPS) return false;
      }
    }
    return true;
  };
  for (let y = y0; y <= yMax + EPS; y += ROUTER.zelle) {
    for (const xZuerst of [true, false]) {
      const mitte: V3 = xZuerst ? [fB[0], y, fA[2]] : [fA[0], y, fB[2]];
      const p = bereinigt([fA, [fA[0], y, fA[2]], mitte, [fB[0], y, fB[2]], fB]);
      if (p.length >= 2 && !engeSchlaufe(p, radius) && frei(p)) return p;
    }
  }
  return null;
}
