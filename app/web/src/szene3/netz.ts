import { imRechteck, type V3 } from "../szene2/huelle";
import { geschossBeiY, leitungen } from "../szene2/leitungen";
import type { KatalogEintrag, Welt, WeltSymbol } from "../typen";
import { innenwaende } from "./geometrie";
import { anschlussLokal, deckenLauf, ROHR, verteilerAbgang } from "./technik";
import { anzeigeWelt, bereinigen, ersatzGruppeId, gruppenRohrnetz, gruppenVerbindungen, SPUR } from "./gruppenNetz";
import { LeitungsRouter } from "./router/router";
import { alsBaum } from "./router/topologie";
import { geraeteKoerper } from "./router/koerper";
import { alsPrueflinien, pruefen } from "./router/pruefer";
import { ROUTER, type Befund, type PruefLeitung } from "./router/typen";
import { direktVerbindung } from "./router/direkt";
import { routerAnschluss, type SteigBereich } from "./router/anschluss";

const ERZEUGER = new Set(["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe"]);
/** Nebengeräte der Zentrale ohne eigene Versorgung; Anbindung ans nächste Zentralgerät (Gefäss am Rücklauf) [A]. */
const NEBEN = new Set(["heizung.ausdehnungsgefaess", "heizung.sonstiges"]);
const ABGABE = new Set(["heizung.heizkoerper", "heizung.fbh_kreis", "heizung.tabs_feld"]);
export interface Verbindung { art: "haupt" | "verteil"; von: string; nach: string }
export interface Rohrstueck { punkte: V3[]; radius: number; startRadius: number; endRadius: number; boden: number; daten: Verbindung & { bauteilIds: string[]; gruppeId?: string }; frei: boolean }
export interface Huelse { position: V3; normale: V3; radius: number; art: "wand" | "decke" }

export function freieVerteilerAbgaenge(welt: Welt, katalog: KatalogEintrag[]) {
  // Verteiler mit Gruppen (v2) erhalten genau so viele Abgänge wie Stränge; keine freien Stutzen.
  if (welt.gruppen) return [];
  const kanten = verbindungen(welt, katalog);
  return welt.symbole.filter((s) => s.katalogId === "heizung.verteiler").flatMap((s) => {
    const belegt = Math.min(4, kanten.filter((v) => v.von === s.schluessel && v.art === "verteil").length);
    return Array.from({ length: 4 - belegt }, (_, i) => {
      const p = verteilerAbgang(belegt + i);
      return { symbol: s, position: [p[0] + s.position.x, p[1] + s.position.y, p[2] + s.position.z] as V3 };
    });
  });
}

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
  const zentrale = [speicher, erzeuger].filter((z) => z !== undefined);
  for (const s of symbole.filter((s) => NEBEN.has(s.katalogId))) {
    const d = (z: WeltSymbol) => Math.hypot(z.position.x - s.position.x, z.position.y - s.position.y, z.position.z - s.position.z);
    const quelle = [...zentrale].sort((a, b) => d(a) - d(b))[0];
    if (quelle) hinzu("haupt", quelle.schluessel, s.schluessel);
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

/** Steigzone samt Spurversatz aller Straenge (Spur 0..n-1, siehe gruppenNetz.spuren und LeitungsRouter.strang). */
export function steigBereich(welt: Welt, katalog: KatalogEintrag[]): SteigBereich | null {
  if (!welt.steigzone) return null;
  const n = gruppenVerbindungen(welt, katalog).length;
  return { x: welt.steigzone.x, z: welt.steigzone.z, laenge: SPUR * Math.max(0, n - 1) };
}

/** Direkt verbundene Geraete je Schluessel (Verbindungen und Gruppen), fuer die Anschlussfuehrung (routerAnschluss). */
export function partnerVon(welt: Welt, katalog: KatalogEintrag[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const hinzu = (a: string, b: string) => { m.set(a, (m.get(a) ?? new Set()).add(b)); m.set(b, (m.get(b) ?? new Set()).add(a)); };
  for (const v of verbindungen(welt, katalog)) hinzu(v.von, v.nach);
  for (const s of gruppenVerbindungen(welt, katalog)) for (const k of s.verbraucher) hinzu(s.verteiler, k);
  return m;
}

/** v1: alle Verbindungen einzeln; v2: Hauptleitungen und Gruppenstraenge. Beide ueber den LeitungsRouter (Spec 2026-11-13). */
export function rohrnetzMitBefunden(welt: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>): { stuecke: Rohrstueck[]; befunde: Befund[] } {
  let vorrang: string[] = [];
  let best: { stuecke: Rohrstueck[]; befunde: Befund[] } | null = null;
  // v2: Router und Pruefer sehen die Anzeigewelt (Zubehoer im Gruppenstock ist Teil der Leitung, kein Hindernis).
  const sicht = welt.gruppen ? anzeigeWelt(welt, katalog, anschluesse) : welt;
  const koerper = geraeteKoerper(sicht, katalog);
  const wert = (b: Befund[]) => b.filter((x) => x.hart).length * 1000 + b.length;
  for (let runde = 0; runde < ROUTER.runden; runde++) {
    let stuecke: Rohrstueck[];
    const router = new LeitungsRouter(sicht, katalog);
    if (welt.gruppen) stuecke = gruppenRohrnetz(welt, katalog, anschluesse, router, vorrang);
    else {
      const baum = alsBaum(verbindungen(welt, katalog));
      for (const k of baum.verworfen) router.befunde.push({ regel: "zyklus", leitungen: [`${k.von}>${k.nach}`], ort: [0, 0, 0], hart: true });
      stuecke = kantenNetz(welt, katalog, anschluesse, baum.kanten as Verbindung[], router).map((r) =>
        r.daten.art === "verteil" ? { ...r, daten: { ...r.daten, gruppeId: ersatzGruppeId(r.daten.von, r.daten.nach) } } : r);
    }
    const linien = alsPrueflinien(stuecke);
    const pruefung = pruefen(linien, koerper);
    const befunde = [...router.befunde, ...pruefung];
    if (!best || wert(befunde) < wert(best.befunde)) best = { stuecke, befunde };
    if (!befunde.length || !welt.gruppen) break;
    // Ausreissen und neu verlegen (Spec 5.4): gescheiterte Gruppen und bei Konflikten zweier Leitungen die spaeter
    // verlegte zuerst (Rohrstuecke liegen in Verlegereihenfolge), hoechstens ROUTER.runden Runden; die beste Runde gilt.
    const netzVon = new Map(linien.map((l) => [l.id, l.netz]));
    const index = new Map(linien.map((l, i) => [l.id, i]));
    const neu = [...router.befunde.filter((b) => b.regel === "kein_weg").flatMap((b) => b.leitungen),
      ...pruefung.filter((b) => b.leitungen.length === 2).map((b) => [...b.leitungen].sort((x, y) => index.get(y)! - index.get(x)!)[0])
        .map((id) => netzVon.get(id)!)].filter((n) => n && n !== "haupt");
    if (!neu.length) break;
    vorrang = [...new Set([...neu, ...vorrang])];
  }
  return best!;
}
export function rohrnetz(welt: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>): Rohrstueck[] {
  return rohrnetzMitBefunden(welt, katalog, anschluesse).stuecke;
}

/**
 * Fuehrung je Verbindung: Anschlussstueck an beiden Enden, Lauf ueber den LeitungsRouter (Spec 2026-11-13, Abschnitt 6).
 * `weitereSpuren`: Auftraege weiterer Netze (Gruppen) fuer dieselbe Trassenzuteilung. `feste`: schon festgelegte Leitungen
 * (Gruppenabgaenge, Anschluesse), denen eine Direktverbindung ausweicht.
 */
export function kantenNetz(welt: Welt, katalog: KatalogEintrag[], anschluesse: Record<string, V3>, kanten: Verbindung[], router: LeitungsRouter,
  weitereSpuren: { netz: string; a: V3; b: V3 }[] = [], feste: PruefLeitung[] = []): Rohrstueck[] {
  const stuecke: Rohrstueck[] = [];
  const adapterSchluessel = new Set<string>();
  const naechsterAbgang = new Map<string, number>();
  // Im Router hat jede Hauptverbindung ein eigenes Teilnetz `haupt~von>nach`: fremde Hauptlaeufe halten den Rohrabstand
  // (der Pruefer fasst alle Hauptleitungen zu einem Netz zusammen und erlaubt Beruehrung nur am T-Abzweig oder an
  // gemeinsamen Punkten). Ein Anschluss, den mehrere Hauptverbindungen teilen (z. B. Speicher), gehoert zu `haupt`.
  const netzVon = (v: Verbindung) => (v.art === "haupt" ? `haupt~${v.von}>${v.nach}` : ersatzGruppeId(v.von, v.nach));
  const koerper = geraeteKoerper(welt, katalog);
  const steig = steigBereich(welt, katalog), partner = partnerVon(welt, katalog);
  // Durchgang 1: Adapter je Verbindung (Reihenfolge wie bisher, damit Verteilerabgaenge gleich nummeriert bleiben).
  const vorbereitet = kanten.map((v) => {
    const radius = ROHR[v.art];
    const adapter: Rohrstueck[] = [];
    const endpunkt = (key: string, ausgang = false): V3 | null => {
      const s = welt.symbole.find((s) => s.schluessel === key);
      if (!s) {
        const e = welt.einheiten.find((e) => e.id === key), g = welt.geschosse.find((g) => g.id === e?.geschossId);
        return e && g ? [e.rechteck.x + e.rechteck.breite / 2, deckenLauf(g), e.rechteck.z + e.rechteck.tiefe / 2] : null;
      }
      let lokal = anschlussLokal(s, anschluesse, katalog);
      if (ausgang && v.art === "verteil" && s.katalogId === "heizung.verteiler") {
        const index = naechsterAbgang.get(key) ?? 0;
        lokal = verteilerAbgang(index); naechsterAbgang.set(key, index + 1);
      }
      const g = welt.geschosse.find((g) => g.id === geschossBeiY(welt, s.position.y));
      const laufY = g ? deckenLauf(g) - s.position.y : ROHR.durchgangHoehe;
      const stutzen = s.katalogId === "heizung.verteiler" ? ausgang ? 0.02 : 0.035 : s.katalogId === "heizung.waermepumpe" ? 0.026 : ROHR.anschluss;
      // Stutzen, noetigenfalls kurzer Stummel, senkrecht bis zur Leitungsebene; den Rest verlegt der Router.
      const f = routerAnschluss(s, lokal as V3, radius, s.position.y + laufY, einheitVon(welt, s)?.rechteck, koerper, steig, katalog, partner.get(key));
      // Keine zulaessige Lage fuer die Steigleitung: harter Befund (der Pruefer nimmt den eigenen Koerper aus).
      if (!f.ok) router.befunde.push({ regel: "kein_weg", leitungen: [netzVon(v).split("~")[0], s.schluessel], ort: f.punkte[0], hart: true });
      adapter.push({ punkte: f.punkte, radius: f.adapterRadius, startRadius: stutzen, endRadius: radius, boden: s.position.y,
        daten: { ...v, bauteilIds: s.bauteilIds }, frei: false });
      return f.punkte.at(-1)!;
    };
    const a = endpunkt(v.von, true), b = endpunkt(v.nach);
    return { v, radius, adapter, a, b, boden: Math.min(...adapter.map((r) => r.boden)), startRadius: radius as number, endRadius: radius as number };
  });
  const adapterKey = (r: Rohrstueck) => JSON.stringify(r.punkte);
  // Direktverbindung naher Geraete (PO 15.11., router/direkt.ts): Hauptleitung zwischen zwei Geraeten im selben Raum auf
  // Anschlusshoehe statt ueber die Leitungsebene. Gelingt sie, entfallen die Steigleitungen ihrer Anschluesse (ausser
  // eine andere Verbindung nutzt denselben Anschluss); der Weg wird vor allen anderen belegt.
  const raumVon = (k: string) => {
    const s = welt.symbole.find((x) => x.schluessel === k), e = s && einheitVon(welt, s);
    return s && e ? `${geschossBeiY(welt, s.position.y)}:${e.id}` : null;
  };
  const fuss = (p: V3[]) => p[Math.max(0, p.length - 2)];
  const direkt = new Map<(typeof vorbereitet)[number], V3[]>();
  for (const x of vorbereitet) {
    if (x.v.art !== "haupt" || x.adapter.length !== 2) continue;
    const raum = raumVon(x.v.von);
    if (!raum || raum !== raumVon(x.v.nach)) continue;
    const eigene = new Set(x.adapter.map(adapterKey));
    const hindernisse: PruefLeitung[] = [...feste,
      ...vorbereitet.flatMap((y) => y === x ? [] : y.adapter.filter((r) => !eigene.has(adapterKey(r)))
        .map((r, i) => ({ id: `${netzVon(y.v)}#${i}`, netz: netzVon(y.v), punkte: r.punkte, radius: Math.max(r.radius, r.endRadius), enden: [] }))),
      ...[...direkt].map(([y, w]) => ({ id: netzVon(y.v), netz: netzVon(y.v), punkte: w, radius: y.radius, enden: [] }))];
    const weg = direktVerbindung(fuss(x.adapter[0].punkte), fuss(x.adapter[1].punkte), x.radius, x.adapter[0].punkte.at(-1)![1], koerper, hindernisse, netzVon(x.v));
    if (weg) direkt.set(x, weg);
  }
  // Zusammenbau je Direktleitung; danach Pruefung samt Anschlussstuecken (Pruefer). Mit hartem Befund (z. B. Lauf zurueck
  // entlang eines Anschlussstummels, Zufallswelt 108) entfaellt sie und die Verbindung laeuft ueber die Leitungsebene.
  const senkrecht = (p: V3, q: V3) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[2] - q[2]) < 1e-6;
  const zusammenbau = () => {
    const vonUmweg = new Set(vorbereitet.filter((x) => !direkt.has(x)).flatMap((x) => x.adapter.map(adapterKey)));
    return new Map([...direkt].map(([x, roh]) => {
      const [va, vb] = x.adapter;
      // Bleibt die Steigleitung eines Anschlusses (andere Verbindung nutzt ihn), muendet die Direktleitung als T in sie,
      // statt neben ihr zum Fuss abzusteigen (sonst zwei Rohre uebereinander).
      let w = roh;
      if (vonUmweg.has(adapterKey(va)) && w.length > 2 && senkrecht(w[0], w[1])) w = w.slice(1);
      if (vonUmweg.has(adapterKey(vb)) && w.length > 2 && senkrecht(w[w.length - 2], w[w.length - 1])) w = w.slice(0, -1);
      // Ohne Stummel (Fuss = Stutzen) beginnt die Direktleitung am Stutzen und uebernimmt dessen Radius.
      const startRadius = va.punkte.length <= 2 && !vonUmweg.has(adapterKey(va)) ? va.startRadius : x.radius;
      const endRadius = vb.punkte.length <= 2 && !vonUmweg.has(adapterKey(vb)) ? vb.startRadius : x.radius;
      const adapter = x.adapter.flatMap((r) => vonUmweg.has(adapterKey(r)) ? [] : r.punkte.length > 2 ? [{ ...r, punkte: r.punkte.slice(0, -1) }] : []);
      const bleibend = x.adapter.filter((r) => vonUmweg.has(adapterKey(r)));
      return [x, { w, startRadius, endRadius, adapter, bleibend }] as const;
    }));
  };
  for (let runde = 0; runde < 4; runde++) {
    const verworfen = [...zusammenbau()].filter(([x, z]) => {
      const linien: PruefLeitung[] = [{ id: "direkt", netz: "haupt", punkte: z.w, radius: x.radius, enden: [x.v.von, x.v.nach] },
        ...[...z.adapter, ...z.bleibend].map((r, i) => ({ id: `anschluss${i}`, netz: "haupt", punkte: r.punkte, radius: Math.max(r.radius, r.endRadius), enden: [x.v.von, x.v.nach] }))];
      return pruefen(linien, koerper).some((b) => b.hart && b.leitungen.includes("direkt"));
    }).map(([x]) => x);
    if (!verworfen.length) break;
    for (const x of verworfen) direkt.delete(x);
  }
  for (const [x, z] of zusammenbau()) {
    direkt.set(x, z.w); x.startRadius = z.startRadius; x.endRadius = z.endRadius; x.adapter = z.adapter;
  }
  // Anschluesse gehoeren zum Netz ihrer Verbindung: fremde Laeufe halten Abstand, der eigene Lauf beginnt am Kopf.
  const geteilt = new Map<string, number>();
  for (const x of vorbereitet) for (const r of x.adapter) geteilt.set(adapterKey(r), (geteilt.get(adapterKey(r)) ?? 0) + 1);
  // Folgen noch Hauptlaeufe, sperren die Adapter gegen den Hauptrohrradius (paarweiser Sperrabstand, raster.sperrabstand).
  const gegen = kanten.some((k) => k.art === "haupt") ? ROHR.haupt : 0;
  for (const x of vorbereitet) for (const r of x.adapter) {
    const netz = (geteilt.get(adapterKey(r)) ?? 0) > 1 ? netzVon(x.v).split("~")[0] : netzVon(x.v);
    const radius = Math.max(r.radius, r.endRadius);
    router.vorbelegen(r.punkte, netz, radius, Math.max(radius, gegen));
    router.anschlussSperren(r.punkte, netz, radius, Math.max(radius, gegen));
  }
  for (const [x, weg] of direkt) router.vorbelegen(weg, netzVon(x.v), x.radius, Math.max(x.radius, gegen));
  router.spurenFestlegen([...vorbereitet.filter((x) => x.a && x.b && !direkt.has(x)).map((x) => ({ netz: netzVon(x.v), a: x.a!, b: x.b! })), ...weitereSpuren]);
  // Durchgang 2: Wege.
  for (const x of vorbereitet) {
    const { v, radius, adapter, a, b } = x;
    if (!a || !b) continue;
    let punkte: V3[];
    const direktWeg = direkt.get(x);
    if (direktWeg) punkte = direktWeg;
    else if (Math.abs(a[1] - b[1]) < 0.01) {
      // Anschluesse (routerAnschluss) enden senkrecht auf der Leitungsebene; eine waagrechte Abgangsrichtung gibt es nicht.
      punkte = router.weg(a, b, netzVon(v), radius);
      // Hauptleitungen untereinander: kein Parallellauf am geteilten Anschluss (Task 8).
      if (v.art === "haupt") punkte = router.hauptNachbessern(a, b, punkte, netzVon(v), radius);
      // Am geteilten Anschluss (Kopf gehoert zu `haupt`) bleibt die Umgebung fuer die andere Hauptverbindung offen.
      const kopf = adapter.filter((r) => (geteilt.get(adapterKey(r)) ?? 0) > 1).map((r) => r.punkte.at(-1)!);
      router.belegen(punkte, netzVon(v), radius, kopf, netzVon(v).split("~")[0]);
    } else {
      // Endpunkte auf verschiedenen Hoehen (Leitung ueber Geschosse): Strang mit Steigleitung in der Steigzone.
      const baum = router.strang(a, [{ schluessel: v.nach, punkt: b }], 0, welt.steigzone ?? null, netzVon(v));
      punkte = bereinigen(baum.segmente.flat());
    }
    const neueAdapter = adapter.filter((r) => {
      const key = JSON.stringify([r.punkte, r.radius, r.endRadius]);
      if (adapterSchluessel.has(key)) return false;
      adapterSchluessel.add(key); return true;
    });
    stuecke.push(...neueAdapter, { punkte, radius, startRadius: x.startRadius, endRadius: x.endRadius, boden: x.boden,
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
        p[achse] = w.mitte[achse] + seite * (w.groesse[achse] / 2 + 0.045); p[quer] = q; n[achse] = seite;
        hinzu(p, n, "wand");
      }
    }
  }
  return [...ergebnis.values()];
}
