import type { BauteilStatus, Dreiwertig, Grundform, GruppenArt, HeizArt, Heizung, Punkt, Rechteck } from "../typen";
import { BESTUECKUNG_TEILE, ERZEUGER, K, bestueckungVorschlag } from "./bestueckung";

/**
 * Zustand des Interview-Assistenten (Spec Stufe 1 §7). Verlustfreies Abbild der Beschreibung mit stabilen
 * Schlüsseln statt Indizes: bestehende Elemente tragen ihre ID als Schlüssel, neue einen lokalen Schlüssel.
 * Der Zustand ist zugleich der Inhalt des Entwurfs (Autosave).
 */
export type SchrittNr = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const SCHRITTE: readonly { nr: SchrittNr; titel: string; kurz: string }[] = [
  { nr: 1, titel: "Gebäude", kurz: "Name, Form und Geschosse" },
  { nr: 2, titel: "Einheiten", kurz: "Nutzungen je Geschoss" },
  { nr: 3, titel: "Abgaben", kurz: "Heizkörper, Fussbodenheizung, TABS" },
  { nr: 4, titel: "Zentrale", kurz: "Erzeuger, Speicher und Raum" },
  { nr: 5, titel: "Hauptverteiler", kurz: "Heizgruppen und Verbraucher" },
  { nr: 6, titel: "Unterverteiler", kurz: "FBH-Verteiler je Einheit" },
  { nr: 7, titel: "Weitere Teile", kurz: "Teile an anderem Ort" },
  { nr: 8, titel: "Prüfen", kurz: "Zusammenfassung und Übernahme" },
];

export interface ZGeschoss { id?: string; code: string }
export interface ZEinheit {
  schluessel: string; id?: string; geschoss: string; // Geschoss-Code
  bezeichnung: string; art: string; flaecheM2: number | null; layoutManuell?: Rechteck | null;
  ausnahme: Partial<Heizung>;
}
export type ZStandort = { einheit: string } | { geschoss: string };
export type ZOrt = { gruppe: string } | { vorBauteil: string } | null;
export interface ZBauteil {
  schluessel: string; id?: string; katalogId: string; standort: ZStandort;
  menge: number | null; status: BauteilStatus; hersteller: string | null; typ: string | null; baujahr: number | null;
  positionManuell: Punkt | null; versorgt: string[]; ort: ZOrt;
}
export interface ZGruppe {
  schluessel: string; id?: string; verteiler: string; nummer: number; art: GruppenArt; bezeichnung: string; verbraucher: string[];
}
export interface AssistentZustand {
  version: 1;
  schritt: SchrittNr;
  /** Schritt 1 nur mit Recht `huelle.verwalten` und solange das Gebäude noch nicht angelegt ist. */
  huelleBearbeitbar: boolean;
  gebaeude: { id: string | null; liegenschaftId: string | null; name: string; grundform: Grundform; stand: number; geschosse: ZGeschoss[] };
  heizungStandard: Heizung;
  einheiten: ZEinheit[];
  bauteile: ZBauteil[];
  gruppen: ZGruppe[];
  zentraleRaum: string | null;
  zaehler: number;
}

// --- Regelwerk-Spiegel (app/src/welt/regelwerk.v1.ts / v2.ts) ---
export const EINHEIT_ARTEN: readonly { art: string; name: string; mehrzahl: string }[] = [
  { art: "buero", name: "Büro", mehrzahl: "Büros" },
  { art: "wohnung", name: "Wohnung", mehrzahl: "Wohnungen" },
  { art: "gastro", name: "Gastro", mehrzahl: "Gastro" },
  { art: "allgemein", name: "Allgemein", mehrzahl: "Allgemein" },
  { art: "technik", name: "Technik", mehrzahl: "Technik" },
  { art: "kern", name: "Kern (Treppenhaus/Lift)", mehrzahl: "Kerne" },
];
export const artName = (art: string) => EINHEIT_ARTEN.find((a) => a.art === art)?.name ?? art;
const RAUM = [K.verteiler, K.hk, K.fbh, K.tabs];
const ZENTRAL = [K.waermepumpe, K.gaskessel, K.oelkessel, K.fernwaerme, K.speicher, K.pumpe];
const ZUB = [K.pumpe, K.ventil3, K.ventil2, K.wmz];
/** Erlaubte Katalog-IDs je Einheit-Art (Regelwerk v2). */
export const ERLAUBT: Readonly<Record<string, readonly string[]>> = {
  buero: [...RAUM, ...ZUB], wohnung: [...RAUM, ...ZUB], gastro: [...RAUM, ...ZUB], allgemein: [...RAUM, ...ZUB],
  technik: [...ZENTRAL, K.verteiler, K.hk, K.ventil3, K.ventil2, K.wmz],
  kern: [K.hk],
};
export const HEIZ_ARTEN: readonly HeizArt[] = ["hk", "fbh", "tabs"];
export const ABGABE_VON: Readonly<Record<HeizArt, string>> = { hk: K.hk, fbh: K.fbh, tabs: K.tabs };
export const HEIZ_NAME: Readonly<Record<HeizArt, string>> = { hk: "Heizkörper", fbh: "Fussbodenheizung", tabs: "TABS" };
const ABGABEN = new Set<string>([K.hk, K.fbh, K.tabs]);
const ZENTRALE_GERAETE = new Set<string>([...ERZEUGER, K.speicher]);

// --- Geschosse ---
export function geschossCodes(ug: number, og: number): string[] {
  const u = Math.max(0, Math.min(3, Math.floor(ug)));
  const o = Math.max(0, Math.min(40, Math.floor(og)));
  return [...Array.from({ length: u }, (_, i) => `UG${u - i}`), "EG", ...Array.from({ length: o }, (_, i) => `OG${i + 1}`)];
}
export function geschossRang(code: string): number {
  if (code === "EG") return 0;
  if (code === "DG") return 41;
  if (code === "DACH") return 42;
  const ug = /^UG(\d+)$/.exec(code);
  if (ug) return -Number(ug[1]);
  const og = /^OG(\d+)$/.exec(code);
  return og ? Number(og[1]) : 99;
}
export function geschossAnzahl(geschosse: readonly ZGeschoss[]): { ug: number; og: number } {
  return { ug: geschosse.filter((g) => g.code.startsWith("UG")).length, og: geschosse.filter((g) => g.code.startsWith("OG")).length };
}

// --- Abfragen ---
export const wirksam = (z: AssistentZustand, e: ZEinheit): Heizung => ({ ...z.heizungStandard, ...e.ausnahme });
export const istAbgabe = (t: ZBauteil) => ABGABEN.has(t.katalogId);
export const istZentralgeraet = (t: ZBauteil) => ZENTRALE_GERAETE.has(t.katalogId);
export const einheitVon = (z: AssistentZustand, t: ZBauteil) => ("einheit" in t.standort ? z.einheiten.find((e) => e.schluessel === (t.standort as { einheit: string }).einheit) : undefined);
export const geschossVon = (z: AssistentZustand, t: ZBauteil): string | undefined =>
  "geschoss" in t.standort ? t.standort.geschoss : einheitVon(z, t)?.geschoss;
export const abgabenVon = (z: AssistentZustand, einheit: string) =>
  z.bauteile.filter((t) => istAbgabe(t) && "einheit" in t.standort && t.standort.einheit === einheit);
export const verteilerListe = (z: AssistentZustand) => z.bauteile.filter((t) => t.katalogId === K.verteiler);
export const zubehoerVon = (z: AssistentZustand, gruppe: string) =>
  z.bauteile.filter((t) => t.ort && "gruppe" in t.ort && t.ort.gruppe === gruppe);
export const gruppeVonVerbraucher = (z: AssistentZustand, bauteil: string) => z.gruppen.find((g) => g.verbraucher.includes(bauteil));

/** Hauptverteiler: Verteiler, der selbst keiner Gruppe angehört; bevorzugt mit Gruppen, dann im Zentraleraum. */
export function hauptverteiler(z: AssistentZustand): ZBauteil | undefined {
  const frei = verteilerListe(z).filter((t) => !gruppeVonVerbraucher(z, t.schluessel));
  return frei.find((t) => z.gruppen.some((g) => g.verteiler === t.schluessel))
    ?? frei.find((t) => "einheit" in t.standort && t.standort.einheit === z.zentraleRaum)
    ?? frei[0];
}
export function unterverteiler(z: AssistentZustand): ZBauteil[] {
  const h = hauptverteiler(z);
  return verteilerListe(z).filter((t) => t !== h);
}
export const zentraleGeraete = (z: AssistentZustand) => z.bauteile.filter(istZentralgeraet);
export const erzeuger = (z: AssistentZustand) => z.bauteile.filter((t) => ERZEUGER.includes(t.katalogId));

/** Hinweistext, wenn der gewählte Zentraleraum keine Technik-Einheit ist (Regelwerk erlaubt Erzeuger nur dort). */
export function zentraleRaumHinweis(z: AssistentZustand): string | null {
  if (!z.zentraleRaum) return null;
  const e = z.einheiten.find((x) => x.schluessel === z.zentraleRaum);
  if (!e) return null;
  return e.art === "technik" ? null : `«${e.bezeichnung}» ist keine Technik-Einheit. Erzeuger und Speicher sind nur in Technik-Einheiten vorgesehen.`;
}

// --- Erzeugen ---
export function leererZustand(liegenschaftId: string | null = null): AssistentZustand {
  return {
    version: 1, schritt: 1, huelleBearbeitbar: true,
    gebaeude: { id: null, liegenschaftId, name: "", grundform: "quader", stand: 0, geschosse: geschossCodes(0, 1).map((code) => ({ code })) },
    heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
    einheiten: [], bauteile: [], gruppen: [], zentraleRaum: null, zaehler: 0,
  };
}

/** Nächste freie Nummer für "Büro n" (gebäudeweit, damit Namen eindeutig bleiben). */
export function naechsteNummer(einheiten: readonly ZEinheit[], basis: string): number {
  const re = new RegExp(`^${basis.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`);
  return einheiten.reduce((m, e) => { const r = re.exec(e.bezeichnung); return r ? Math.max(m, Number(r[1])) : m; }, 0) + 1;
}

/** Ab Schritt 2 braucht es ein angelegtes Gebäude (Geschoss-IDs für Einheiten). */
export const schrittErreichbar = (z: AssistentZustand, nr: SchrittNr) => nr === 1 || z.gebaeude.id !== null;

// --- Reducer ---
export type Aktion =
  | { typ: "laden"; zustand: AssistentZustand }
  | { typ: "schritt"; nr: SchrittNr } | { typ: "weiter" } | { typ: "zurueck" }
  | { typ: "huelleBearbeitbar"; wert: boolean }
  | { typ: "gebaeude"; name?: string; grundform?: Grundform; liegenschaftId?: string }
  /** Kopfangaben aus Gebäudeliste/Welt (auch im Lesemodus). */
  | { typ: "kopf"; name?: string; grundform?: Grundform; liegenschaftId?: string }
  | { typ: "geschosse"; ug: number; og: number }
  | { typ: "gebaeudeAngelegt"; id: string; stand: number; geschosse: { id: string; code: string }[] }
  | { typ: "einheitNeu"; geschoss: string; art: string; anzahl?: number; bezeichnung?: string }
  | { typ: "einheitAendern"; schluessel: string; bezeichnung?: string; art?: string }
  | { typ: "einheitLoeschen"; schluessel: string }
  | { typ: "standard"; art: HeizArt; wert: Dreiwertig }
  | { typ: "ausnahme"; einheit: string; art: HeizArt; wert: Dreiwertig | null }
  | { typ: "abgabeNeu"; einheit: string; katalogId: string }
  | { typ: "abgabeAendern"; schluessel: string; hersteller?: string | null; geraetTyp?: string | null; menge?: number }
  | { typ: "abgabeWeissNicht"; schluessel: string }
  | { typ: "bauteilLoeschen"; schluessel: string }
  | { typ: "zentraleRaum"; einheit: string }
  | { typ: "technikraumNeu"; geschoss: string }
  | { typ: "erzeuger"; katalogId: string }
  | { typ: "speicher"; an: boolean }
  | { typ: "gruppenAnzahl"; anzahl: number }
  | { typ: "gruppeName"; schluessel: string; bezeichnung: string }
  | { typ: "gruppeArt"; schluessel: string; art: GruppenArt }
  | { typ: "bestueckung"; gruppe: string; katalogId: string; delta: 1 | -1 }
  | { typ: "gruppeWmz"; gruppe: string; an: boolean }
  | { typ: "verbraucher"; gruppe: string; bauteil: string; an: boolean }
  | { typ: "unterverteiler"; einheit: string; an: boolean }
  | { typ: "unterverteilerWmz"; verteiler: string; an: boolean }
  | { typ: "teilNeu"; katalogId: string; vor: string }
  | { typ: "teilAendern"; schluessel: string; katalogId?: string; vor?: string };

const neuerSchluessel = (z: AssistentZustand): [string, AssistentZustand] => [`k${z.zaehler + 1}`, { ...z, zaehler: z.zaehler + 1 }];

function neuesBauteil(z: AssistentZustand, t: Omit<ZBauteil, "schluessel" | "hersteller" | "typ" | "baujahr" | "positionManuell" | "versorgt" | "ort"> & Partial<ZBauteil>): [AssistentZustand, string] {
  const [s, z2] = neuerSchluessel(z);
  const b: ZBauteil = { hersteller: null, typ: null, baujahr: null, positionManuell: null, versorgt: [], ort: null, ...t, schluessel: s };
  return [{ ...z2, bauteile: [...z2.bauteile, b] }, s];
}
const ersetzeBauteil = (z: AssistentZustand, s: string, f: (t: ZBauteil) => ZBauteil): AssistentZustand =>
  ({ ...z, bauteile: z.bauteile.map((t) => (t.schluessel === s ? f(t) : t)) });

/** Entfernt Bauteile samt allen Verweisen darauf (Gruppen, Ort, Zubehör der Gruppen eines entfernten Verteilers). */
export function entferneBauteile(z: AssistentZustand, weg: Iterable<string>): AssistentZustand {
  const raus = new Set(weg);
  if (raus.size === 0) return z;
  let gruppen = z.gruppen.filter((g) => !raus.has(g.verteiler));
  const gruppenWeg = new Set(z.gruppen.filter((g) => raus.has(g.verteiler)).map((g) => g.schluessel));
  // Folgeteile: Zubehör entfernter Gruppen und Teile "vor" entfernten Bauteilen
  let geaendert = true;
  while (geaendert) {
    geaendert = false;
    for (const t of z.bauteile) {
      if (raus.has(t.schluessel) || !t.ort) continue;
      if (("gruppe" in t.ort && gruppenWeg.has(t.ort.gruppe)) || ("vorBauteil" in t.ort && raus.has(t.ort.vorBauteil))) { raus.add(t.schluessel); geaendert = true; }
    }
  }
  gruppen = gruppen.map((g) => (g.verbraucher.some((v) => raus.has(v)) ? { ...g, verbraucher: g.verbraucher.filter((v) => !raus.has(v)) } : g));
  return versorgungNachfuehren({ ...z, bauteile: z.bauteile.filter((t) => !raus.has(t.schluessel)), gruppen });
}

/** Versorgt-Liste der Verteiler mit Gruppen = Einheiten ihrer Verbraucher (Reihenfolge der Einheiten). */
function versorgungNachfuehren(z: AssistentZustand): AssistentZustand {
  const mitGruppen = new Set(z.gruppen.map((g) => g.verteiler));
  if (mitGruppen.size === 0) return z;
  const einheitenVon = (v: string) => {
    const set = new Set<string>();
    for (const g of z.gruppen) if (g.verteiler === v) for (const b of g.verbraucher) {
      const t = z.bauteile.find((x) => x.schluessel === b);
      if (t && "einheit" in t.standort) set.add(t.standort.einheit);
    }
    return z.einheiten.map((e) => e.schluessel).filter((s) => set.has(s));
  };
  return { ...z, bauteile: z.bauteile.map((t) => {
    if (!mitGruppen.has(t.schluessel)) return t;
    const v = einheitenVon(t.schluessel);
    return v.length === t.versorgt.length && v.every((x, i) => x === t.versorgt[i]) ? t : { ...t, versorgt: v };
  }) };
}

/** Abgaben einer Einheit an die wirksame Heizung anpassen: ja → mindestens eine (vorgeschlagen), nein/nicht erlaubt → entfernen, unbekannt → nur vorgeschlagen. */
function abgabenAbgleichen(z: AssistentZustand, einheit: string, arten: readonly HeizArt[] = HEIZ_ARTEN): AssistentZustand {
  const e = z.einheiten.find((x) => x.schluessel === einheit);
  if (!e) return z;
  const w = wirksam(z, e);
  const erlaubt = ERLAUBT[e.art] ?? [];
  let neu = z;
  for (const art of arten) {
    const kat = ABGABE_VON[art];
    const vorhanden = abgabenVon(neu, einheit).filter((t) => t.katalogId === kat);
    if (w[art] === "nein" || !erlaubt.includes(kat)) neu = entferneBauteile(neu, vorhanden.map((t) => t.schluessel));
    else if (w[art] === "unbekannt") for (const t of vorhanden) neu = ersetzeBauteil(neu, t.schluessel, (x) => ({ ...x, status: "vorgeschlagen" }));
    else if (vorhanden.length === 0 && e.art !== "technik")
      [neu] = neuesBauteil(neu, { katalogId: kat, standort: { einheit }, menge: null, status: "vorgeschlagen" });
  }
  return neu;
}

/** Stellt einen Zentraleraum sicher: erste Technik-Einheit, sonst neue "Technik" im untersten Geschoss. */
function mitZentraleRaum(z: AssistentZustand): AssistentZustand {
  if (z.zentraleRaum && z.einheiten.some((e) => e.schluessel === z.zentraleRaum)) return z;
  const technik = z.einheiten.find((e) => e.art === "technik");
  if (technik) return { ...z, zentraleRaum: technik.schluessel };
  const unten = [...z.gebaeude.geschosse].sort((a, b) => geschossRang(a.code) - geschossRang(b.code))[0];
  if (!unten) return z;
  const z2 = reduziere(z, { typ: "einheitNeu", geschoss: unten.code, art: "technik", bezeichnung: "Technik" });
  return { ...z2, zentraleRaum: z2.einheiten[z2.einheiten.length - 1].schluessel };
}

function mitHauptverteiler(z: AssistentZustand): [AssistentZustand, string] {
  const h = hauptverteiler(z);
  if (h) return [z, h.schluessel];
  const z1 = mitZentraleRaum(z);
  if (!z1.zentraleRaum) return [z1, ""];
  const [z2, s] = neuesBauteil(z1, { katalogId: K.verteiler, standort: { einheit: z1.zentraleRaum }, menge: 1, status: "bestaetigt" });
  return [z2, s];
}

const standortVon = (z: AssistentZustand, bauteil: string): ZStandort | null => z.bauteile.find((t) => t.schluessel === bauteil)?.standort ?? null;

function bestueckungSetzen(z: AssistentZustand, gruppe: string, art: GruppenArt): AssistentZustand {
  const g = z.gruppen.find((x) => x.schluessel === gruppe);
  const standort = g && standortVon(z, g.verteiler);
  if (!g || !standort) return z;
  // Nur vorgeschlagene Bestückung ersetzen; bestätigte Teile bleiben und decken den Vorschlag ab.
  const zub = zubehoerVon(z, gruppe).filter((t) => BESTUECKUNG_TEILE.includes(t.katalogId));
  let neu = entferneBauteile(z, zub.filter((t) => t.status === "vorgeschlagen").map((t) => t.schluessel));
  for (const v of bestueckungVorschlag(art)) {
    const bestaetigt = zub.filter((t) => t.status === "bestaetigt" && t.katalogId === v.katalogId).reduce((s, t) => s + (t.menge ?? 0), 0);
    if (v.menge > bestaetigt)
      [neu] = neuesBauteil(neu, { katalogId: v.katalogId, standort, menge: v.menge - bestaetigt, status: "vorgeschlagen", ort: { gruppe } });
  }
  return neu;
}

/** Verschiebt Zentralgeräte, Hauptverteiler und deren Zubehör in den Raum. */
function zentraleVerschieben(z: AssistentZustand, raum: string): AssistentZustand {
  const h = hauptverteiler(z);
  const bewegen = new Set<string>([...zentraleGeraete(z).map((t) => t.schluessel), ...(h ? [h.schluessel] : [])]);
  const gruppenH = new Set(z.gruppen.filter((g) => g.verteiler === h?.schluessel).map((g) => g.schluessel));
  for (const t of z.bauteile) if (t.ort && (("gruppe" in t.ort && gruppenH.has(t.ort.gruppe)) || ("vorBauteil" in t.ort && bewegen.has(t.ort.vorBauteil)))) bewegen.add(t.schluessel);
  return { ...z, zentraleRaum: raum, bauteile: z.bauteile.map((t) => (bewegen.has(t.schluessel) ? { ...t, standort: { einheit: raum } } : t)) };
}

export function reduziere(z: AssistentZustand, a: Aktion): AssistentZustand {
  switch (a.typ) {
    case "laden": return a.zustand;
    case "schritt": return schrittErreichbar(z, a.nr) ? { ...z, schritt: a.nr } : z;
    case "weiter": return z.schritt < 8 && schrittErreichbar(z, (z.schritt + 1) as SchrittNr) ? { ...z, schritt: (z.schritt + 1) as SchrittNr } : z;
    case "zurueck": return z.schritt > 1 ? { ...z, schritt: (z.schritt - 1) as SchrittNr } : z;
    case "huelleBearbeitbar": return { ...z, huelleBearbeitbar: a.wert };
    case "gebaeude":
      if (!z.huelleBearbeitbar) return z;
      return reduziere(z, { ...a, typ: "kopf" });
    case "kopf":
      return { ...z, gebaeude: { ...z.gebaeude, ...(a.name !== undefined && { name: a.name }), ...(a.grundform && { grundform: a.grundform }),
        ...(a.liegenschaftId && { liegenschaftId: a.liegenschaftId }) } };
    case "geschosse": {
      if (!z.huelleBearbeitbar) return z;
      const alt = new Map(z.gebaeude.geschosse.map((g) => [g.code, g]));
      const geschosse = geschossCodes(a.ug, a.og).map((code) => alt.get(code) ?? { code });
      const codes = new Set(geschosse.map((g) => g.code));
      const einheitenWeg = z.einheiten.filter((e) => !codes.has(e.geschoss)).map((e) => e.schluessel);
      let neu: AssistentZustand = { ...z, gebaeude: { ...z.gebaeude, geschosse } };
      for (const s of einheitenWeg) neu = reduziere(neu, { typ: "einheitLoeschen", schluessel: s });
      return neu;
    }
    case "gebaeudeAngelegt": {
      const ids = new Map(a.geschosse.map((g) => [g.code, g.id]));
      return { ...z, huelleBearbeitbar: false, gebaeude: { ...z.gebaeude, id: a.id, stand: a.stand,
        geschosse: z.gebaeude.geschosse.map((g) => ({ ...g, id: ids.get(g.code) ?? g.id })) } };
    }
    case "einheitNeu": {
      const art = EINHEIT_ARTEN.find((x) => x.art === a.art);
      const anzahl = Math.max(1, Math.min(50, a.anzahl ?? 1));
      let neu = z;
      for (let i = 0; i < anzahl; i++) {
        const [s, z2] = neuerSchluessel(neu);
        const name = art?.name ?? a.art;
        const bezeichnung = a.bezeichnung ?? `${name} ${naechsteNummer(z2.einheiten, name)}`;
        neu = { ...z2, einheiten: [...z2.einheiten, { schluessel: s, geschoss: a.geschoss, bezeichnung, art: a.art, flaecheM2: null, ausnahme: {} }] };
        neu = abgabenAbgleichen(neu, s);
      }
      return neu;
    }
    case "einheitAendern": {
      const neu = { ...z, einheiten: z.einheiten.map((e) => (e.schluessel === a.schluessel
        ? { ...e, ...(a.bezeichnung !== undefined && { bezeichnung: a.bezeichnung }), ...(a.art !== undefined && { art: a.art }) } : e)) };
      if (a.art === undefined) return neu;
      // Nicht mehr erlaubte Teile in der Einheit entfernen, Abgaben neu abgleichen
      const erlaubt = ERLAUBT[a.art] ?? [];
      const weg = neu.bauteile.filter((t) => "einheit" in t.standort && t.standort.einheit === a.schluessel && !erlaubt.includes(t.katalogId)).map((t) => t.schluessel);
      return abgabenAbgleichen(entferneBauteile(neu, weg), a.schluessel);
    }
    case "einheitLoeschen": {
      const weg = z.bauteile.filter((t) => "einheit" in t.standort && t.standort.einheit === a.schluessel).map((t) => t.schluessel);
      const neu = entferneBauteile({ ...z, einheiten: z.einheiten.filter((e) => e.schluessel !== a.schluessel) }, weg);
      return { ...neu, zentraleRaum: neu.zentraleRaum === a.schluessel ? null : neu.zentraleRaum,
        bauteile: neu.bauteile.map((t) => (t.versorgt.includes(a.schluessel) ? { ...t, versorgt: t.versorgt.filter((v) => v !== a.schluessel) } : t)) };
    }
    case "standard": {
      let neu: AssistentZustand = { ...z, heizungStandard: { ...z.heizungStandard, [a.art]: a.wert } };
      for (const e of neu.einheiten) if (e.ausnahme[a.art] === undefined) neu = abgabenAbgleichen(neu, e.schluessel, [a.art]);
      return neu;
    }
    case "ausnahme": {
      const neu = { ...z, einheiten: z.einheiten.map((e) => {
        if (e.schluessel !== a.einheit) return e;
        const ausnahme = { ...e.ausnahme };
        if (a.wert === null || a.wert === z.heizungStandard[a.art]) delete ausnahme[a.art]; else ausnahme[a.art] = a.wert;
        return { ...e, ausnahme };
      }) };
      return abgabenAbgleichen(neu, a.einheit, [a.art]);
    }
    case "abgabeNeu": {
      const e = z.einheiten.find((x) => x.schluessel === a.einheit);
      if (!e) return z;
      return neuesBauteil(z, { katalogId: a.katalogId, standort: { einheit: a.einheit }, menge: null, status: "vorgeschlagen" })[0];
    }
    case "abgabeAendern":
      return ersetzeBauteil(z, a.schluessel, (t) => {
        const n = { ...t, ...(a.hersteller !== undefined && { hersteller: a.hersteller || null }), ...(a.geraetTyp !== undefined && { typ: a.geraetTyp || null }) };
        if (a.menge === undefined) return n;
        const e = einheitVon(z, t);
        const art = HEIZ_ARTEN.find((x) => ABGABE_VON[x] === t.katalogId);
        // Bestätigt nur, wenn die Abgabe in der Einheit sicher vorhanden ist (Prüfregel bestaetigt_bei_unbekannt)
        const sicher = !e || !art || wirksam(z, e)[art] === "ja";
        return { ...n, menge: Math.max(0, Math.round(a.menge)), status: sicher ? "bestaetigt" : "vorgeschlagen" };
      });
    case "abgabeWeissNicht": return ersetzeBauteil(z, a.schluessel, (t) => ({ ...t, menge: null, status: "vorgeschlagen" }));
    case "bauteilLoeschen": return entferneBauteile(z, [a.schluessel]);
    case "zentraleRaum": return zentraleVerschieben(z, a.einheit);
    case "technikraumNeu": {
      const z2 = reduziere(z, { typ: "einheitNeu", geschoss: a.geschoss, art: "technik", bezeichnung: "Technik" });
      return zentraleVerschieben(z2, z2.einheiten[z2.einheiten.length - 1].schluessel);
    }
    case "erzeuger": {
      const z1 = mitZentraleRaum(z);
      const vorhanden = erzeuger(z1)[0];
      if (vorhanden) return ersetzeBauteil(z1, vorhanden.schluessel, (t) => ({ ...t, katalogId: a.katalogId, status: "bestaetigt", hersteller: t.katalogId === a.katalogId ? t.hersteller : null, typ: t.katalogId === a.katalogId ? t.typ : null }));
      if (!z1.zentraleRaum) return z1;
      return neuesBauteil(z1, { katalogId: a.katalogId, standort: { einheit: z1.zentraleRaum }, menge: 1, status: "bestaetigt" })[0];
    }
    case "speicher": {
      const vorhanden = z.bauteile.filter((t) => t.katalogId === K.speicher);
      if (!a.an) return entferneBauteile(z, vorhanden.map((t) => t.schluessel));
      if (vorhanden.length) return z;
      const z1 = mitZentraleRaum(z);
      if (!z1.zentraleRaum) return z1;
      return neuesBauteil(z1, { katalogId: K.speicher, standort: { einheit: z1.zentraleRaum }, menge: 1, status: "bestaetigt" })[0];
    }
    case "gruppenAnzahl": {
      const anzahl = Math.max(0, Math.min(30, Math.floor(a.anzahl)));
      const [z1, v] = mitHauptverteiler(z);
      if (!v) return z1;
      const amVerteiler = z1.gruppen.filter((g) => g.verteiler === v);
      if (anzahl < amVerteiler.length) {
        const weg = new Set(amVerteiler.slice(anzahl).map((g) => g.schluessel));
        const zub = z1.bauteile.filter((t) => t.ort && "gruppe" in t.ort && weg.has(t.ort.gruppe)).map((t) => t.schluessel);
        return entferneBauteile({ ...z1, gruppen: z1.gruppen.filter((g) => !weg.has(g.schluessel)) }, zub);
      }
      let neu = z1;
      for (let i = amVerteiler.length; i < anzahl; i++) {
        const [s, z2] = neuerSchluessel(neu);
        const nummer = Math.max(0, ...z2.gruppen.filter((g) => g.verteiler === v).map((g) => g.nummer)) + 1;
        neu = { ...z2, gruppen: [...z2.gruppen, { schluessel: s, verteiler: v, nummer, art: "ungeregelt", bezeichnung: `Gruppe ${nummer}`, verbraucher: [] }] };
        neu = bestueckungSetzen(neu, s, "ungeregelt");
      }
      return neu;
    }
    case "gruppeName": return { ...z, gruppen: z.gruppen.map((g) => (g.schluessel === a.schluessel ? { ...g, bezeichnung: a.bezeichnung } : g)) };
    case "gruppeArt": {
      const neu = { ...z, gruppen: z.gruppen.map((g) => (g.schluessel === a.schluessel ? { ...g, art: a.art } : g)) };
      return bestueckungSetzen(neu, a.schluessel, a.art);
    }
    case "bestueckung": {
      const g = z.gruppen.find((x) => x.schluessel === a.gruppe);
      const standort = g && standortVon(z, g.verteiler);
      if (!g || !standort) return z;
      const teile = zubehoerVon(z, a.gruppe).filter((t) => t.katalogId === a.katalogId);
      // Jede Änderung durch den Kunden bestätigt die Bestückung dieses Teiltyps.
      let neu = z;
      for (const t of teile) neu = ersetzeBauteil(neu, t.schluessel, (x) => ({ ...x, status: "bestaetigt" }));
      const letztes = teile[teile.length - 1];
      if (a.delta > 0) {
        if (letztes) return ersetzeBauteil(neu, letztes.schluessel, (x) => ({ ...x, menge: (x.menge ?? 0) + 1 }));
        return neuesBauteil(neu, { katalogId: a.katalogId, standort, menge: 1, status: "bestaetigt", ort: { gruppe: a.gruppe } })[0];
      }
      if (!letztes) return z;
      if ((letztes.menge ?? 0) > 1) return ersetzeBauteil(neu, letztes.schluessel, (x) => ({ ...x, menge: (x.menge ?? 0) - 1 }));
      return entferneBauteile(neu, [letztes.schluessel]);
    }
    case "gruppeWmz": {
      const vorhanden = zubehoerVon(z, a.gruppe).filter((t) => t.katalogId === K.wmz);
      if (!a.an) return entferneBauteile(z, vorhanden.map((t) => t.schluessel));
      const g = z.gruppen.find((x) => x.schluessel === a.gruppe);
      const standort = g && standortVon(z, g.verteiler);
      if (vorhanden.length || !standort) return z;
      return neuesBauteil(z, { katalogId: K.wmz, standort, menge: 1, status: "bestaetigt", ort: { gruppe: a.gruppe } })[0];
    }
    case "verbraucher": {
      // Ein Verbraucher gehört höchstens einer Gruppe: Zuteilen hängt ihn aus der alten Gruppe um.
      const gruppen = z.gruppen.map((g) => {
        const ohne = g.verbraucher.filter((v) => v !== a.bauteil);
        if (g.schluessel === a.gruppe && a.an) return { ...g, verbraucher: [...ohne, a.bauteil] };
        return ohne.length === g.verbraucher.length ? g : { ...g, verbraucher: ohne };
      });
      return versorgungNachfuehren({ ...z, gruppen });
    }
    case "unterverteiler": {
      const vorhanden = unterverteiler(z).filter((t) => "einheit" in t.standort && t.standort.einheit === a.einheit);
      if (!a.an) return entferneBauteile(z, vorhanden.map((t) => t.schluessel));
      if (vorhanden.length) return z;
      return neuesBauteil(z, { katalogId: K.verteiler, standort: { einheit: a.einheit }, menge: 1, status: "bestaetigt", versorgt: [a.einheit] })[0];
    }
    case "unterverteilerWmz": {
      const vorhanden = z.bauteile.filter((t) => t.katalogId === K.wmz && t.ort && "vorBauteil" in t.ort && t.ort.vorBauteil === a.verteiler);
      if (!a.an) return entferneBauteile(z, vorhanden.map((t) => t.schluessel));
      const standort = standortVon(z, a.verteiler);
      if (vorhanden.length || !standort) return z;
      return neuesBauteil(z, { katalogId: K.wmz, standort, menge: 1, status: "bestaetigt", ort: { vorBauteil: a.verteiler } })[0];
    }
    case "teilNeu": {
      const standort = standortVon(z, a.vor);
      if (!standort) return z;
      return neuesBauteil(z, { katalogId: a.katalogId, standort, menge: 1, status: "bestaetigt", ort: { vorBauteil: a.vor } })[0];
    }
    case "teilAendern":
      return ersetzeBauteil(z, a.schluessel, (t) => {
        const standort = a.vor !== undefined ? standortVon(z, a.vor) : null;
        return { ...t, ...(a.katalogId && { katalogId: a.katalogId }),
          ...(a.vor !== undefined && standort && a.vor !== t.schluessel && { ort: { vorBauteil: a.vor }, standort }) };
      });
  }
}

/** Teile "an anderem Ort" (Schritt 7): Ort vor einem Bauteil, ohne die WMZ der Unterverteiler (Schritt 6). */
export function weitereTeile(z: AssistentZustand): ZBauteil[] {
  const unter = new Set(unterverteiler(z).map((t) => t.schluessel));
  return z.bauteile.filter((t) => t.ort && "vorBauteil" in t.ort && !(t.katalogId === K.wmz && unter.has(t.ort.vorBauteil)));
}

/** Bestückung einer Gruppe je Teiltyp: Summe der Mengen und ob alles noch Vorschlag ist. */
export function bestueckungVon(z: AssistentZustand, gruppe: string): { katalogId: string; menge: number; vorgeschlagen: boolean }[] {
  const zub = zubehoerVon(z, gruppe);
  return BESTUECKUNG_TEILE.map((katalogId) => {
    const teile = zub.filter((t) => t.katalogId === katalogId);
    return { katalogId, menge: teile.reduce((s, t) => s + (t.menge ?? 0), 0), vorgeschlagen: teile.length > 0 && teile.every((t) => t.status === "vorgeschlagen") };
  });
}

/** Einheiten mit wirksamer FBH, in denen ein Unterverteiler sinnvoll ist (Schritt 6). */
export function unterverteilerVorschlaege(z: AssistentZustand): ZEinheit[] {
  return z.einheiten.filter((e) => wirksam(z, e).fbh === "ja" && (ERLAUBT[e.art] ?? []).includes(K.verteiler) && e.art !== "technik");
}

/** Verbraucher für die Checkliste in Schritt 5: Abgaben und Unterverteiler, geordnet nach Geschoss (oben zuerst) und Einheit. */
export function verbraucherKandidaten(z: AssistentZustand): { geschoss: string; einheiten: { einheit: ZEinheit; teile: ZBauteil[] }[] }[] {
  const unter = new Set(unterverteiler(z).map((t) => t.schluessel));
  const geschosse = [...z.gebaeude.geschosse].sort((a, b) => geschossRang(b.code) - geschossRang(a.code));
  return geschosse.map((g) => ({
    geschoss: g.code,
    einheiten: z.einheiten.filter((e) => e.geschoss === g.code).map((einheit) => ({
      einheit,
      teile: z.bauteile.filter((t) => (istAbgabe(t) || unter.has(t.schluessel)) && "einheit" in t.standort && t.standort.einheit === einheit.schluessel),
    })).filter((x) => x.teile.length > 0),
  })).filter((g) => g.einheiten.length > 0);
}

/** Bezugsgeräte für "Teil vor Bauteil X" (Schritt 7): Erzeuger, Speicher und Verteiler. */
export function vorKandidaten(z: AssistentZustand): ZBauteil[] {
  return z.bauteile.filter((t) => istZentralgeraet(t) || t.katalogId === K.verteiler);
}
