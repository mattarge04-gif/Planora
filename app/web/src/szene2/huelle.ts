import type { Rechteck, Welt } from "../typen";

export type V3 = [number, number, number];

/** Gestaltungsmasse in m [A]; Abstimmung in der Korrekturrunde. */
export const MASSE = {
  raster: 1.5, fensterBreite: 1.2, bruestung: 0.9, sturz: 0.5, minFassade: 2, randFenster: 1,
  wand: 0.3, band: 0.25, bandUeberstand: 0.1, attika: 0.4, platteHoehe: 0.3, platteRand: 4,
  aufbauHoehe: 1.5, aufbauMax: 4, fensterAbstand: 0.02,
} as const;

export interface Quader { mitte: V3; groesse: V3 }
export interface Wand { von: [number, number]; bis: [number, number]; normale: [number, number]; laenge: number }
export interface Fenster { mitte: V3; breite: number; hoehe: number; drehungY: number }
export interface GeschossHuelle { geschossId: string; code: string; yUnten: number; hoehe: number; fenster: Fenster[]; band: Quader[] }
export interface Bereich { xMin: number; xMax: number; zMin: number; zMax: number; yMin: number; yMax: number }
export interface Huelle {
  grundriss: Rechteck[]; waende: Wand[]; geschosse: GeschossHuelle[]; attika: Quader[]; aufbau: Quader | null; platte: Quader; bereich: Bereich;
}

export function imRechteck(r: Rechteck, x: number, z: number): boolean {
  return x >= r.x && x <= r.x + r.breite && z >= r.z && z <= r.z + r.tiefe;
}

/** Vier Aussenwaende im Uhrzeigersinn (Sicht von oben): Sued, Ost, Nord, West. Mehrere Rechtecke: innere Waende entstehen doppelt [A]. */
export function waendeVon(r: Rechteck): Wand[] {
  const { x, z, breite: b, tiefe: t } = r;
  return [
    { von: [x, z], bis: [x + b, z], normale: [0, -1], laenge: b },
    { von: [x + b, z], bis: [x + b, z + t], normale: [1, 0], laenge: t },
    { von: [x + b, z + t], bis: [x, z + t], normale: [0, 1], laenge: b },
    { von: [x, z + t], bis: [x, z], normale: [-1, 0], laenge: t },
  ];
}

/** Abstaende der Fenstermitten vom Wandanfang. */
export function fensterMitten(laenge: number): number[] {
  if (laenge < MASSE.minFassade) return [];
  const n = Math.floor((laenge - MASSE.randFenster) / MASSE.raster);
  const start = (laenge - n * MASSE.raster) / 2 + MASSE.raster / 2;
  return Array.from({ length: n }, (_, i) => start + i * MASSE.raster);
}

/** Wandkoerper innen an der Aussenlinie, von yUnten bis yUnten + hoehe. */
export function wandQuader(w: Wand, yUnten: number, hoehe: number): Quader {
  const mx = (w.von[0] + w.bis[0]) / 2 - (w.normale[0] * MASSE.wand) / 2;
  const mz = (w.von[1] + w.bis[1]) / 2 - (w.normale[1] * MASSE.wand) / 2;
  const entlangX = w.normale[0] === 0;
  return {
    mitte: [mx, yUnten + hoehe / 2, mz],
    groesse: entlangX ? [w.laenge, hoehe, MASSE.wand] : [MASSE.wand, hoehe, w.laenge],
  };
}

function bereichVon(welt: Welt): Bereich {
  const xs = welt.grundriss.flatMap((r) => [r.x, r.x + r.breite]);
  const zs = welt.grundriss.flatMap((r) => [r.z, r.z + r.tiefe]);
  const ys = welt.geschosse.flatMap((g) => [g.yUnten, g.yUnten + g.hoehe]);
  return {
    xMin: xs.length ? Math.min(...xs) : 0, xMax: xs.length ? Math.max(...xs) : 10,
    zMin: zs.length ? Math.min(...zs) : 0, zMax: zs.length ? Math.max(...zs) : 10,
    yMin: ys.length ? Math.min(...ys) : 0, yMax: ys.length ? Math.max(...ys) : 0,
  };
}

export function huelle(welt: Welt): Huelle {
  const bereich = bereichVon(welt);
  const hatGeschosse = welt.geschosse.length > 0;
  const waende = hatGeschosse ? welt.grundriss.flatMap(waendeVon) : [];
  const sortiert = [...welt.geschosse].sort((a, b) => a.yUnten - b.yUnten);

  const geschosse: GeschossHuelle[] = sortiert.map((g, index) => {
    const technik = welt.einheiten.filter((e) => e.geschossId === g.id && e.art === "technik").map((e) => e.rechteck);
    const hoehe = g.hoehe - MASSE.bruestung - MASSE.sturz;
    const fenster: Fenster[] = hoehe <= 0 ? [] : waende.flatMap((w) => fensterMitten(w.laenge).flatMap((d) => {
      const px = w.von[0] + ((w.bis[0] - w.von[0]) * d) / w.laenge;
      const pz = w.von[1] + ((w.bis[1] - w.von[1]) * d) / w.laenge;
      const innenX = px - w.normale[0] * 0.5, innenZ = pz - w.normale[1] * 0.5;
      if (technik.some((r) => imRechteck(r, innenX, innenZ))) return [];
      return [{
        mitte: [px + w.normale[0] * MASSE.fensterAbstand, g.yUnten + MASSE.bruestung + hoehe / 2, pz + w.normale[1] * MASSE.fensterAbstand] as V3,
        breite: MASSE.fensterBreite, hoehe, drehungY: Math.atan2(w.normale[0], w.normale[1]),
      }];
    }));
    const band: Quader[] = index === 0 ? [] : welt.grundriss.map((r) => ({
      mitte: [r.x + r.breite / 2, g.yUnten, r.z + r.tiefe / 2] as V3,
      groesse: [r.breite + 2 * MASSE.bandUeberstand, MASSE.band, r.tiefe + 2 * MASSE.bandUeberstand] as V3,
    }));
    return { geschossId: g.id, code: g.code, yUnten: g.yUnten, hoehe: g.hoehe, fenster, band };
  });

  const attika: Quader[] = waende.map((w) => {
    const q = wandQuader(w, bereich.yMax, MASSE.attika);
    return q;
  });

  const technikEinheit = hatGeschosse ? welt.einheiten.find((e) => e.art === "technik") : undefined;
  let aufbau: Quader | null = null;
  if (technikEinheit) {
    const r = technikEinheit.rechteck;
    const s = Math.min(MASSE.aufbauMax, Math.min(r.breite, r.tiefe) * 0.5);
    aufbau = { mitte: [r.x + r.breite / 2, bereich.yMax + MASSE.aufbauHoehe / 2, r.z + r.tiefe / 2], groesse: [s, MASSE.aufbauHoehe, s] };
  }

  const platte: Quader = {
    mitte: [(bereich.xMin + bereich.xMax) / 2, bereich.yMin - MASSE.platteHoehe / 2, (bereich.zMin + bereich.zMax) / 2],
    groesse: [bereich.xMax - bereich.xMin + 2 * MASSE.platteRand, MASSE.platteHoehe, bereich.zMax - bereich.zMin + 2 * MASSE.platteRand],
  };

  return { grundriss: hatGeschosse ? welt.grundriss : [], waende, geschosse, attika, aufbau, platte, bereich };
}
