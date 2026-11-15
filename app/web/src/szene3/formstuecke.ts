import * as THREE from "three";
import type { V3 } from "../szene2/huelle";
import type { Rohrstueck } from "./netz";
import { bogenLagen, rohrAbschluesse } from "./technik";

/**
 * Formstücke der Darstellung (PO 14.11.2026): Pressbögen an Richtungswechseln, T-Stücke an Abzweigen, Winkel an Stössen
 * zweier Rohrstücke. Masse als Vielfaches des Rohrradius [A]. Reine Ableitung aus den fertigen `Rohrstueck[]`;
 * Führung und Punkte der Rohre bleiben unverändert.
 */
export const FORMSTUECK = {
  /** Aussenradius des Fittingkörpers. */
  koerper: 1.16,
  /** Muffenlänge eines Bogens über den Bogen hinaus (gerades Stück je Seite). */
  bogenMuffe: 0.7,
  /** Armlänge eines T-Stücks bzw. Winkels ab der Knotenmitte. */
  knotenMuffe: 1.9,
  /** Pressring (Wulst) am Muffenende: Radius und Länge. */
  ring: 1.3, ringLaenge: 0.34,
  /** Unter diesem Verhältnis Bogenradius/Rohrradius wird ein enger Bogen als Winkel gezeichnet (Torus wäre überschlagen). */
  engerBogen: 1.4,
  /** Lagetoleranz für Stösse und Abzweige, Meter. */
  toleranz: 1e-3,
} as const;

export interface Zylinder { position: V3; richtung: V3; radius: number; laenge: number; gruppeId?: string }
export interface Bogenstueck { ecke: V3; ein: V3; aus: V3; r: number; rohrRadius: number; gruppeId?: string }
export interface Knoten { position: V3; radius: number; arme: { richtung: V3; radius: number }[]; gruppeId?: string }
export interface Formstuecke { boegen: Bogenstueck[]; knoten: Knoten[]; muffen: Zylinder[]; ringe: Zylinder[] }

/** Netz eines Rohrstücks: Gruppe, sonst alle Hauptleitungen gemeinsam, sonst die einzelne Verbindung. */
export const netzVon = (r: Rohrstueck) => r.daten.gruppeId ?? (r.daten.art === "haupt" ? "haupt" : `${r.daten.von}>${r.daten.nach}`);

const v = (p: V3) => new THREE.Vector3(...p);

/**
 * Knoten: Stellen, an denen Rohrstücke desselben Netzes zusammenstossen (Endpunkt auf Endpunkt) oder ein Rohr auf
 * einem anderen beginnt (Endpunkt im Inneren eines Segments). Drei und mehr Richtungen = T-Stück; zwei nicht
 * gegenläufige Richtungen = Winkel; gerade Fortsetzungen und freie Enden erhalten kein Formstück.
 */
export function knoten(stuecke: Rohrstueck[]): Knoten[] {
  const tol = FORMSTUECK.toleranz;
  const roh: { netz: string; position: THREE.Vector3; arme: { richtung: THREE.Vector3; radius: number }[]; gruppeId?: string }[] = [];
  const knotenBei = (netz: string, p: THREE.Vector3, gruppeId?: string) => {
    let k = roh.find((x) => x.netz === netz && x.position.distanceTo(p) < tol);
    if (!k) roh.push(k = { netz, position: p.clone(), arme: [], gruppeId });
    return k;
  };
  stuecke.forEach((s, i) => {
    const netz = netzVon(s);
    rohrAbschluesse(s.punkte).forEach((ende, e) => {
      const p = v(ende.position);
      const k = knotenBei(netz, p, s.daten.gruppeId);
      k.arme.push({ richtung: v(ende.richtung).negate(), radius: e === 0 ? s.startRadius : s.endRadius });
      // Beginnt das Rohr auf einem Segment eines anderen Rohres desselben Netzes, laufen dort zwei Arme durch.
      stuecke.forEach((t, j) => {
        if (j === i || netzVon(t) !== netz) return;
        for (let n = 1; n < t.punkte.length; n++) {
          const a = v(t.punkte[n - 1]), b = v(t.punkte[n]), achse = b.clone().sub(a), laenge = achse.length();
          if (laenge < 2 * tol) continue;
          achse.divideScalar(laenge);
          const s0 = p.clone().sub(a).dot(achse);
          if (s0 <= tol || s0 >= laenge - tol) continue;
          if (a.clone().addScaledVector(achse, s0).distanceTo(p) >= tol) continue;
          k.arme.push({ richtung: achse.clone(), radius: t.radius }, { richtung: achse.clone().negate(), radius: t.radius });
        }
      });
    });
  });
  return roh.flatMap((k) => {
    const arme: { richtung: THREE.Vector3; radius: number }[] = [];
    for (const a of k.arme) {
      const gleich = arme.find((x) => x.richtung.dot(a.richtung) > 0.999);
      if (gleich) gleich.radius = Math.max(gleich.radius, a.radius);
      else arme.push({ richtung: a.richtung.clone(), radius: a.radius });
    }
    if (arme.length < 2 || (arme.length === 2 && arme[0].richtung.dot(arme[1].richtung) < -0.999)) return [];
    return [{ position: k.position.toArray() as V3, radius: Math.max(...arme.map((a) => a.radius)), gruppeId: k.gruppeId,
      arme: arme.map((a) => ({ richtung: a.richtung.toArray() as V3, radius: a.radius })) }];
  });
}

/**
 * Teilt Rohre an inneren Punkten, an denen ein anderes Rohr desselben Netzes beginnt oder endet (Abzweig an einer Ecke
 * des Strangs). Ohne Teilung zeichnet das Rohr dort einen Bogen und der Abzweig sticht aus dessen Ecke (PO 15.11.);
 * geteilt stossen drei Enden zusammen und `knoten` setzt ein T-Stück. Nur Darstellung, die Punkte bleiben dieselben.
 * Ergebnis je Teil: Rohrstück, Index des Ausgangsrohrs, ob es das erste Teil ist.
 */
export function anAbzweigenTeilen(stuecke: Rohrstueck[]): { stueck: Rohrstueck; index: number; erstes: boolean }[] {
  const tol = FORMSTUECK.toleranz;
  const enden = stuecke.map((s) => (s.punkte.length >= 2 ? [s.punkte[0], s.punkte[s.punkte.length - 1]] : []).map((p) => ({ p: v(p), netz: netzVon(s) })));
  return stuecke.flatMap((t, i) => {
    const netz = netzVon(t);
    const schnitte: number[] = [];
    for (let k = 1; k < t.punkte.length - 1; k++) {
      const q = v(t.punkte[k]);
      if (enden.some((e, j) => j !== i && e.some((x) => x.netz === netz && x.p.distanceTo(q) < tol))) schnitte.push(k);
    }
    if (!schnitte.length) return [{ stueck: t, index: i, erstes: true }];
    const grenzen = [0, ...schnitte, t.punkte.length - 1];
    return grenzen.slice(1).map((ende, n) => {
      const anfang = grenzen[n], letztes = n === grenzen.length - 2;
      return { index: i, erstes: n === 0, stueck: { ...t, punkte: t.punkte.slice(anfang, ende + 1),
        startRadius: n === 0 ? t.startRadius : t.radius, endRadius: letztes ? t.endRadius : t.radius, frei: letztes && t.frei } };
    });
  });
}

/** Alle Formstücke einer Menge Rohrstücke: Bögen je Rohr, Knoten zwischen Rohren, dazu Muffen und Pressringe. */
export function formstuecke(stuecke: Rohrstueck[]): Formstuecke {
  const boegen: Bogenstueck[] = [], muffen: Zylinder[] = [], ringe: Zylinder[] = [];
  const knotenListe = knoten(stuecke);
  /** Muffe vom Punkt `p` in Richtung `d` mit Pressring am äusseren Ende. */
  const muffe = (p: THREE.Vector3, d: THREE.Vector3, rohrRadius: number, laenge: number, gruppeId?: string) => {
    muffen.push({ position: p.clone().addScaledVector(d, laenge / 2).toArray() as V3, richtung: d.toArray() as V3,
      radius: rohrRadius * FORMSTUECK.koerper, laenge, gruppeId });
    const rl = rohrRadius * FORMSTUECK.ringLaenge;
    ringe.push({ position: p.clone().addScaledVector(d, laenge - rl / 2).toArray() as V3, richtung: d.toArray() as V3,
      radius: rohrRadius * FORMSTUECK.ring, laenge: rl, gruppeId });
  };
  for (const s of stuecke) {
    for (const b of bogenLagen(s.punkte, s.radius)) {
      const ein = v(b.ein), aus = v(b.aus), gruppeId = s.daten.gruppeId;
      if (b.r < s.radius * FORMSTUECK.engerBogen) {
        // Enger Bogen (kurze Schenkel): als Winkel mit Kern an der Ecke.
        knotenListe.push({ position: b.ecke, radius: s.radius, gruppeId,
          arme: [{ richtung: ein.clone().negate().toArray() as V3, radius: s.radius }, { richtung: b.aus, radius: s.radius }] });
        continue;
      }
      boegen.push({ ecke: b.ecke, ein: b.ein, aus: b.aus, r: b.r, rohrRadius: s.radius, gruppeId });
      const laenge = s.radius * FORMSTUECK.bogenMuffe;
      muffe(v(b.a), ein.clone().negate(), s.radius, laenge, gruppeId);
      muffe(v(b.b), aus, s.radius, laenge, gruppeId);
    }
  }
  for (const k of knotenListe) for (const a of k.arme) muffe(v(k.position), v(a.richtung), a.radius, a.radius * FORMSTUECK.knotenMuffe, k.gruppeId);
  return { boegen, knoten: knotenListe, muffen, ringe };
}

/** Schlüssel gleicher Bogengeometrie: Verhältnis Rohrradius/Bogenradius auf 0.02 gerundet (eine Instanzgruppe je Wert). */
export const bogenSchluessel = (b: Bogenstueck) => Math.round((b.rohrRadius / b.r) * 50) / 50;

/** Instanzmatrix eines Bogens: Ecke im Ursprung, `ein` = +x, `aus` = +y, Massstab = Bogenradius. */
export function bogenMatrix(b: Bogenstueck): THREE.Matrix4 {
  const ein = v(b.ein), aus = v(b.aus);
  return new THREE.Matrix4().makeBasis(ein, aus, ein.clone().cross(aus)).scale(new THREE.Vector3(b.r, b.r, b.r)).setPosition(...b.ecke);
}

/** Instanzmatrix eines Einheitszylinders (Achse y, Höhe 1, Radius 1). */
export function zylinderMatrix(z: Zylinder): THREE.Matrix4 {
  return new THREE.Matrix4().compose(v(z.position), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v(z.richtung)),
    new THREE.Vector3(z.radius, z.laenge, z.radius));
}
