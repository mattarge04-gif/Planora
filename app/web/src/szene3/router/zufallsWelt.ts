import type { Welt, WeltGruppe, WeltSymbol } from "../../typen";
import { verteilerLaenge } from "../technik";

/** mulberry32: reproduzierbarer Zufall aus einem Startwert. */
export function zufall(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const sym = (schluessel: string, id: string, x: number, y: number, z: number): WeltSymbol => ({
  schluessel, katalogId: `heizung.${id}`, position: { x, y, z }, versorgt: [], bauteilIds: [`b-${schluessel}`],
  mengeSumme: 1, mengeUnbekannt: false, hersteller: null, typ: null, status: "bestaetigt",
});

/**
 * Zufallswelt fuer Router-Tests: 20 x 12 m, 1–4 Geschosse, Zentrale 6 x 5 m im EG mit WP, Speicher, Verteiler an
 * zufaelligen, ueberlappungsfreien Orten; 1–6 Gruppen mit je 1–3 Heizkoerpern in zufaelligen Einheiten.
 */
export function zufallsWelt(seed: number): Welt {
  const r = zufall(seed), wahl = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const nGeschosse = 1 + Math.floor(r() * 4), nGruppen = 1 + Math.floor(r() * 6);
  const geschosse = Array.from({ length: nGeschosse }, (_, i) => ({ id: `g${i}`, code: i ? `OG${i}` : "EG", yUnten: i * 3.2, hoehe: 3.2 }));
  const einheiten: Welt["einheiten"] = [];
  for (const g of geschosse) {
    const teile = g.id === "g0"
      ? [{ id: "technik", x: 0, z: 0, b: 6, t: 5 }, { id: "g0-flur", x: 0, z: 5, b: 6, t: 7 }, { id: "g0-a", x: 6, z: 0, b: 7, t: 12 }, { id: "g0-b", x: 13, z: 0, b: 7, t: 12 }]
      : [{ id: `${g.id}-a`, x: 0, z: 0, b: 7, t: 12 }, { id: `${g.id}-b`, x: 7, z: 0, b: 7, t: 12 }, { id: `${g.id}-c`, x: 14, z: 0, b: 6, t: 12 }];
    for (const e of teile) einheiten.push({ id: e.id, geschossId: g.id, bezeichnung: e.id, art: e.id === "technik" ? "technik" : "buero",
      rechteck: { x: e.x, z: e.z, breite: e.b, tiefe: e.t }, quelle: "schematisch" });
  }
  // Zentrale-Geraete per Verwerfungsstichprobe, 0.3 m Wandabstand, 0.4 m untereinander [A].
  const geraete: { key: string; id: string; b: number; t: number }[] = [
    { key: "WP", id: "waermepumpe", b: 1, t: 0.6 }, { key: "SP", id: "speicher", b: 0.9, t: 0.9 }, { key: "V", id: "verteiler", b: verteilerLaenge(nGruppen), t: 0.3 }];
  const gesetzt: { x: number; z: number; b: number; t: number }[] = [];
  const symbole: WeltSymbol[] = [];
  for (const g of geraete) {
    for (let versuch = 0; versuch < 500; versuch++) {
      const x = 0.3 + g.b / 2 + r() * (6 - 0.6 - g.b), z = 0.3 + g.t / 2 + r() * (5 - 0.6 - g.t);
      if (gesetzt.some((o) => Math.abs(o.x - x) < (o.b + g.b) / 2 + 0.4 && Math.abs(o.z - z) < (o.t + g.t) / 2 + 0.4)) continue;
      gesetzt.push({ x, z, b: g.b, t: g.t }); symbole.push(sym(g.key, g.id, x, 0, z)); break;
    }
  }
  const raeume = einheiten.filter((e) => e.id !== "technik");
  const gruppen: WeltGruppe[] = [];
  let hk = 0;
  for (let i = 1; i <= nGruppen; i++) {
    const verbraucher: string[] = [];
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
      const e = wahl(raeume), g = geschosse.find((x) => x.id === e.geschossId)!;
      const key = `HK${++hk}`;
      // [A] Anschluesse auf demselben Geschoss mindestens 0.3 m auseinander (reale Heizkoerper ~1 m breit); x neu ziehen.
      const z = e.rechteck.z + 0.2;
      let x = e.rechteck.x + 0.8 + r() * (e.rechteck.breite - 1.6);
      for (let versuch = 0; versuch < 100 && symbole.some((s) => s.katalogId === "heizung.heizkoerper" && s.position.y === g.yUnten
        && Math.hypot(s.position.x - x, s.position.z - z) < 0.3); versuch++) x = e.rechteck.x + 0.8 + r() * (e.rechteck.breite - 1.6);
      symbole.push(sym(key, "heizkoerper", x, g.yUnten, z));
      verbraucher.push(key);
    }
    gruppen.push({ id: `gr${i}`, verteiler: "V", nummer: i, art: "ungeregelt", bezeichnung: `Gruppe ${i}`, verbraucher, zubehoer: [] });
  }
  return { regelwerkVersion: 2, hash: `zufall-${seed}`, grundriss: [{ x: 0, z: 0, breite: 20, tiefe: 12 }], hinweise: [],
    geschosse, einheiten, symbole, gruppen, steigzone: { x: 5.5, z: 4.5 } };
}
