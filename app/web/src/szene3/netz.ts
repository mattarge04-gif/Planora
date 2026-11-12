import { imRechteck, type V3 } from "../szene2/huelle";
import { geschossBeiY, leitungen } from "../szene2/leitungen";
import type { KatalogEintrag, Welt, WeltSymbol } from "../typen";
import { innenwaende } from "./geometrie";
import { anschlussFuehrung, modellFuer, ROHR } from "./technik";

const ERZEUGER = new Set(["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe"]);
const ABGABE = new Set(["heizung.heizkoerper", "heizung.fbh_kreis", "heizung.tabs_feld"]);
export interface Verbindung { art: "haupt" | "verteil"; von: string; nach: string }
export interface Rohrstueck { punkte: V3[]; radius: number; startRadius: number; endRadius: number; boden: number; daten: Verbindung & { bauteilIds: string[] }; frei: boolean }
export interface Huelse { position: V3; normale: V3; radius: number; art: "wand" | "decke" }

export function einheitVon(welt: Welt, s: WeltSymbol) {
  return welt.einheiten.find((e) => e.geschossId === geschossBeiY(welt, s.position.y) && imRechteck(e.rechteck, s.position.x, s.position.z));
}

export function verbindungen(welt: Welt, katalog: KatalogEintrag[]): Verbindung[] {
  const symbole = [...welt.symbole].sort((a, b) => a.schluessel.localeCompare(b.schluessel));
  const erzeuger = symbole.find((s) => ERZEUGER.has(s.katalogId));
  const speicher = symbole.find((s) => s.katalogId === "heizung.speicher");
  const verteiler = symbole.filter((s) => katalog.find((k) => k.id === s.katalogId)?.bereich === "verteilung");
  const ergebnis: Verbindung[] = [];
  const hinzu = (art: Verbindung["art"], von: string, nach: string) => {
    if (von !== nach && !ergebnis.some((v) => v.von === von && v.nach === nach)) ergebnis.push({ art, von, nach });
  };
  // [A] Schematische Reihenschaltung ausschliesslich vorhandener Geräte: Erzeuger → Speicher → Verteiler.
  if (erzeuger && speicher) hinzu("haupt", erzeuger.schluessel, speicher.schluessel);
  for (const l of leitungen(welt, katalog)) {
    if (l.art === "haupt") {
      hinzu("haupt", erzeuger && speicher ? speicher.schluessel : l.von, l.nach);
    } else {
      const abgabe = symbole.filter((s) => ABGABE.has(s.katalogId) && einheitVon(welt, s)?.id === l.nach);
      if (abgabe.length) abgabe.forEach((s) => hinzu("verteil", l.von, s.schluessel));
      else hinzu("verteil", l.von, l.nach);
    }
  }
  for (const s of symbole.filter((s) => ABGABE.has(s.katalogId))) {
    if (ergebnis.some((v) => v.nach === s.schluessel)) continue;
    // [A] Ohne explizite Versorgung erhält eine vorhandene Abgabe den nächsten vorhandenen Verteiler; nur Darstellung.
    const v = [...verteiler].sort((a, b) => abstand(a, s) - abstand(b, s))[0];
    if (v) hinzu("verteil", v.schluessel, s.schluessel);
  }
  return ergebnis;
}
const abstand = (a: WeltSymbol, b: WeltSymbol) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);

export function rohrnetz(welt: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>): Rohrstueck[] {
  const stuecke: Rohrstueck[] = [];
  const adapterSchluessel = new Set<string>();
  for (const v of verbindungen(welt, katalog)) {
    const radius = ROHR[v.art];
    const adapter: Rohrstueck[] = [];
    const endpunkt = (key: string): V3 | null => {
      const s = welt.symbole.find((s) => s.schluessel === key);
      if (!s) {
        const e = welt.einheiten.find((e) => e.id === key), g = welt.geschosse.find((g) => g.id === e?.geschossId);
        return e && g ? [e.rechteck.x + e.rechteck.breite / 2, g.yUnten + ROHR.durchgangHoehe, e.rechteck.z + e.rechteck.tiefe / 2] : null;
      }
      const m = modellFuer(s.katalogId), lokal = (m.pfad && anschluesse[m.pfad]) || [0, m.masse[1], 0];
      const f = anschlussFuehrung([], { symbol: s, lokal: lokal as V3 }, radius, einheitVon(welt, s)?.rechteck);
      adapter.push({ punkte: f.adapter, radius: f.adapterRadius, startRadius: Math.min(ROHR.anschluss, f.adapterRadius), endRadius: radius, boden: s.position.y,
        daten: { ...v, bauteilIds: s.bauteilIds }, frei: false });
      return f.adapter.at(-1)!;
    };
    const a = endpunkt(v.von), b = endpunkt(v.nach);
    if (!a || !b) continue;
    const richtung = (p: V3) => {
      const abgang = adapter.find((r) => r.punkte.at(-1) === p);
      return abgang ? Math.sign(p[2] - abgang.punkte[abgang.punkte.length - 2][2]) || 1 : 1;
    };
    const sa = richtung(a), sb = richtung(b);
    const z = sa > 0 ? Math.max(a[2], b[2]) + 0.4 : Math.min(a[2], b[2]) - 0.4;
    let punkte: V3[] = [a, [a[0], a[1], z], [a[0], b[1], z], [b[0], b[1], z], b];
    if (sa !== sb) {
      const x = Math.min(a[0], b[0]) - 0.8, az = a[2] + sa * 0.4, bz = b[2] + sb * 0.4;
      punkte = [a, [a[0], a[1], az], [x, a[1], az], [x, b[1], az], [x, b[1], bz], [b[0], b[1], bz], b];
    }
    const neueAdapter = adapter.filter((r) => {
      const key = JSON.stringify([r.punkte, r.radius, r.endRadius]);
      if (adapterSchluessel.has(key)) return false;
      adapterSchluessel.add(key); return true;
    });
    stuecke.push(...neueAdapter, { punkte, radius, startRadius: radius, endRadius: radius, boden: Math.min(a[1], b[1]) - ROHR.durchgangHoehe,
      daten: { ...v, bauteilIds: [...new Set(adapter.flatMap((a) => a.daten.bauteilIds))] }, frei: !welt.symbole.some((s) => s.schluessel === v.nach) });
  }
  return stuecke;
}

/** Hülsen auf beiden Wand-/Plattenseiten; nur echte Durchdringungen, keine Markierungen an freien Enden. */
export function durchgaenge(welt: Welt, punkte: V3[], radius: number): Huelse[] {
  const ergebnis = new Map<string, Huelse>();
  const hinzu = (position: V3, normale: V3, art: Huelse["art"]) => {
    const key = `${art}:${position.map((x) => x.toFixed(4)).join(":")}`;
    ergebnis.set(key, { position, normale, radius, art });
  };
  for (let i = 1; i < punkte.length; i++) {
    const a = punkte[i - 1], b = punkte[i];
    if (Math.abs(a[1] - b[1]) > 1e-6 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6) {
      for (const g of welt.geschosse) {
        if (Math.min(a[1], b[1]) >= g.yUnten || Math.max(a[1], b[1]) <= g.yUnten) continue;
        hinzu([a[0], g.yUnten + 0.045, a[2]], [0, 1, 0], "decke");
        hinzu([a[0], g.yUnten - 0.27, a[2]], [0, -1, 0], "decke");
      }
      continue;
    }
    if (Math.abs(a[1] - b[1]) > 1e-6) continue;
    const geschoss = welt.geschosse.find((g) => a[1] >= g.yUnten && a[1] < g.yUnten + g.hoehe);
    if (!geschoss) continue;
    for (const w of innenwaende(welt, geschoss.id, geschoss.yUnten, geschoss.hoehe)) {
      const achse = w.groesse[0] <= w.groesse[2] ? 0 : 2;
      const quer = achse === 0 ? 2 : 0;
      const d = b[achse] - a[achse];
      if (Math.abs(d) < 1e-9) continue;
      const t = (w.mitte[achse] - a[achse]) / d;
      const q = a[quer] + (b[quer] - a[quer]) * t;
      if (t <= 0 || t >= 1 || Math.abs(q - w.mitte[quer]) > w.groesse[quer] / 2) continue;
      for (const seite of [-1, 1]) {
        const p: V3 = [a[0], a[1], a[2]], n: V3 = [0, 0, 0];
        p[achse] = w.mitte[achse] + seite * (w.groesse[achse] / 2 + 0.025); p[quer] = q; n[achse] = seite;
        hinzu(p, n, "wand");
      }
    }
  }
  return [...ergebnis.values()];
}
