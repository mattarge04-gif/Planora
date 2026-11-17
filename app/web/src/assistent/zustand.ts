import type { BauteilStatus, Dreiwertig, Grundform, GruppenArt, HeizArt, Heizung, Punkt, Rechteck } from "../typen";
import { BESTUECKUNG_TEILE, ERZEUGER, K, bestueckungVorschlag } from "./bestueckung";

/**
 * Zustand des Interview-Assistenten (Spec Stufe 1 §7). Verlustfreies Abbild der Beschreibung mit stabilen
 * Schlüsseln statt Indizes: bestehende Elemente tragen ihre ID als Schlüssel, neue einen lokalen Schlüssel.
 * Der Zustand ist zugleich der Inhalt des Entwurfs (Autosave).
 */
export type SchrittNr = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const SCHRITTE: readonly { nr: SchrittNr; titel: string; kurz: string }[] = [
  { nr: 1, titel: "Gebäude", kurz: "Name, Form und Geschosse" },
  { nr: 2, titel: "Geschosse & Einheiten", kurz: "Regelgeschosse und Nutzungen" },
  { nr: 3, titel: "Heizung", kurz: "Standard, Hersteller und Ausnahmen" },
  { nr: 4, titel: "Zentrale", kurz: "Erzeuger, Speicher und Raum" },
  { nr: 5, titel: "Gruppen & FBH-Verteiler", kurz: "Heizgruppen und Verteiler" },
  { nr: 6, titel: "Weitere Teile", kurz: "Teile an anderem Ort" },
  { nr: 7, titel: "Prüfen", kurz: "Zusammenfassung und Übernahme" },
];
export const LETZTER_SCHRITT: SchrittNr = 7;

export type VorlageFeld = "art" | "bezeichnung" | "ausnahme" | "mengen";
/** Felder je Schritt: Schritt 2 (Einheiten) und Schritt 3 (Heizung) zählen und setzen nur ihre eigenen zurück. */
export const FELDER_EINHEITEN: readonly VorlageFeld[] = ["art", "bezeichnung"];
export const FELDER_HEIZUNG: readonly VorlageFeld[] = ["ausnahme", "mengen"];
export interface ZPlatz { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }
/** Regelgeschoss: Plätze werden in jedem zugewiesenen Geschoss (Code) als Einheit ausgerollt. */
export interface ZVorlage { schluessel: string; name: string; plaetze: ZPlatz[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }

export interface ZGeschoss { id?: string; code: string }
export interface ZEinheit {
  schluessel: string; id?: string; geschoss: string; // Geschoss-Code
  bezeichnung: string; art: string; flaecheM2: number | null; layoutManuell?: Rechteck | null;
  ausnahme: Partial<Heizung>;
  /** Herkunft aus einem Regelgeschoss und die Felder, die der Kunde hier abweichend gesetzt hat. */
  vorlage?: { schluessel: string; platz: string }; abweichend?: VorlageFeld[];
}
export type ZStandort = { einheit: string } | { geschoss: string };
export type ZOrt = { gruppe: string } | { vorBauteil: string } | null;
export interface ZBauteil {
  schluessel: string; id?: string; katalogId: string; standort: ZStandort;
  menge: number | null; status: BauteilStatus; hersteller: string | null; typ: string | null; baujahr: number | null;
  positionManuell: Punkt | null; versorgt: string[]; ort: ZOrt;
  /** Automatisch erzeugt und vom Kunden nicht angefasst (H6: bleibt «vorgeschlagen»). */
  auto?: boolean;
  /** Vom Assistenten angelegter FBH-Verteiler (nie Hauptverteiler). */
  fbh?: boolean;
}
export interface ZGruppenRegel { heizart: HeizArt; geschosse?: string[]; einheit?: string }
export interface ZGruppe {
  schluessel: string; id?: string; verteiler: string; nummer: number; art: GruppenArt; bezeichnung: string; verbraucher: string[];
  /** Vorgeschlagene Gruppe: Verbraucher werden nach Regel zugeordnet, bis der Kunde einzelne umhängt (`angefasst`). */
  regel?: ZGruppenRegel; angefasst?: boolean;
  /** Von Planora vorgeschlagen (nur `gruppenVorschlagen`) und vom Kunden nicht geändert: Badge «Vorschlag» (H6). */
  vorgeschlagen?: boolean;
}
export interface AssistentZustand {
  version: 2;
  schritt: SchrittNr;
  /** Schritt 1 nur mit Recht `huelle.verwalten` und solange das Gebäude noch nicht angelegt ist. */
  huelleBearbeitbar: boolean;
  gebaeude: { id: string | null; liegenschaftId: string | null; name: string; grundform: Grundform; stand: number; geschosse: ZGeschoss[] };
  heizungStandard: Heizung;
  /** Hersteller/Typ je Heizart am Gebäudestandard (H5); nicht gespeichert, beim Laden abgeleitet. */
  standardGeraet: Partial<Record<HeizArt, { hersteller: string | null; typ: string | null }>>;
  einheiten: ZEinheit[];
  bauteile: ZBauteil[];
  gruppen: ZGruppe[];
  vorlagen: ZVorlage[];
  zentraleRaum: string | null;
  /** FBH-Verteiler und Gruppen automatisch ableiten (neue oder leere Gebäude). */
  automatik: boolean;
  gruppenVorgeschlagen: boolean;
  /** Wärmezähler an allen FBH-Verteilern (Vorgabe für neue). */
  fbhWmz: boolean;
  /** Einheiten, in denen der Kunde den automatischen FBH-Verteiler abgewählt hat. */
  fbhVerteilerAus: string[];
  zaehler: number;
}

// --- Regelwerk-Spiegel (app/src/welt/regelwerk.v1.ts / v2.ts) ---
export const EINHEIT_ARTEN: readonly { art: string; name: string; mehrzahl: string; kurz: string }[] = [
  { art: "buero", name: "Büro", mehrzahl: "Büros", kurz: "Büro" },
  { art: "wohnung", name: "Wohnung", mehrzahl: "Wohnungen", kurz: "Wohnung" },
  { art: "gastro", name: "Gastro", mehrzahl: "Gastro", kurz: "Gastro" },
  { art: "allgemein", name: "Allgemein", mehrzahl: "Allgemein", kurz: "Allgemein" },
  { art: "technik", name: "Technik", mehrzahl: "Technik", kurz: "Technik" },
  { art: "kern", name: "Kern (Treppenhaus/Lift)", mehrzahl: "Kerne", kurz: "Kern" },
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
  const frei = verteilerListe(z).filter((t) => !t.fbh && !gruppeVonVerbraucher(z, t.schluessel));
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
    version: 2, schritt: 1, huelleBearbeitbar: true,
    gebaeude: { id: null, liegenschaftId, name: "", grundform: "quader", stand: 0, geschosse: geschossCodes(0, 1).map((code) => ({ code })) },
    heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" }, standardGeraet: {},
    einheiten: [], bauteile: [], gruppen: [], vorlagen: [], zentraleRaum: null,
    automatik: true, gruppenVorgeschlagen: false, fbhWmz: false, fbhVerteilerAus: [], zaehler: 0,
  };
}

/** Kurzform des Geschosses für Bezeichnungen: EG → 0, OG3 → 3, UG1 → U1, sonst der Code. */
export function geschossKurz(code: string): string {
  if (code === "EG") return "0";
  const og = /^OG(\d+)$/.exec(code);
  if (og) return og[1];
  const ug = /^UG(\d+)$/.exec(code);
  return ug ? `U${ug[1]}` : code;
}
/** Bezeichnung nach Geschoss und laufender Nummer, z. B. «Büro 3.01» (Entscheid 3). */
export function nummerieren(geschoss: string, art: string, lfd: number): string {
  const basis = EINHEIT_ARTEN.find((a) => a.art === art)?.kurz ?? art;
  return `${basis} ${geschossKurz(geschoss)}.${String(lfd).padStart(2, "0")}`;
}
/** Nächste laufende Nummer im Geschoss: grösste vergebene plus 1, sonst Anzahl Einheiten plus 1. */
export function naechsteLfd(einheiten: readonly ZEinheit[], geschoss: string): number {
  const kurz = geschossKurz(geschoss).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(` ${kurz}\\.(\\d{2,})$`);
  const imGeschoss = einheiten.filter((e) => e.geschoss === geschoss);
  const max = imGeschoss.reduce((m, e) => { const r = re.exec(e.bezeichnung); return r ? Math.max(m, Number(r[1])) : m; }, 0);
  return max > 0 ? max + 1 : imGeschoss.length + 1;
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
  | { typ: "einheitAnzahl"; geschoss: string; art: string; anzahl: number }
  | { typ: "einheitAendern"; schluessel: string; bezeichnung?: string; art?: string }
  | { typ: "einheitLoeschen"; schluessel: string }
  | { typ: "standard"; art: HeizArt; wert: Dreiwertig }
  | { typ: "standardGeraet"; art: HeizArt; hersteller?: string | null; geraetTyp?: string | null }
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
  | { typ: "teilAendern"; schluessel: string; katalogId?: string; vor?: string }
  | { typ: "vorlageNeu"; name?: string; ausGeschoss?: string }
  | { typ: "vorlageName"; vorlage: string; name: string }
  | { typ: "platzAnzahl"; vorlage: string; art: string; anzahl: number }
  | { typ: "platzAusnahme"; vorlage: string; platz: string; art: HeizArt; wert: Dreiwertig | null }
  | { typ: "platzMenge"; vorlage: string; platz: string; art: HeizArt; menge: number | null }
  | { typ: "vorlageZuweisen"; vorlage: string; geschoss: string; an: boolean }
  | { typ: "vorlageLoeschen"; vorlage: string }
  | { typ: "einheitZuruecksetzen"; einheit: string; felder?: readonly VorlageFeld[] }
  | { typ: "geschossZuruecksetzen"; geschoss: string; felder?: readonly VorlageFeld[] }
  /** `nurMit`: nur Einheiten, in denen auch diese Heizart erlaubt ist (z. B. HK «nein» nur dort, wo FBH möglich ist; Kern behält HK). */
  | { typ: "geschossAusnahme"; geschoss: string; art: HeizArt; wert: Dreiwertig | null; nurMit?: HeizArt }
  | { typ: "gruppenVorschlagen" }
  | { typ: "gruppeTeilen"; gruppe: string; geschosse: string[] }
  | { typ: "sondergruppe"; einheit: string; heizart: HeizArt }
  | { typ: "gruppeEntfernen"; gruppe: string }
  | { typ: "gruppeFuerArt"; heizart: HeizArt }
  | { typ: "fbhWmzAlle"; an: boolean };

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

/** Häufigste Hersteller/Typ-Angabe einer Katalog-ID (Zeilen, nicht Stück); bei Gleichstand die zuerst gefundene. */
export function haeufigstesGeraet(bauteile: readonly ZBauteil[], katalogId: string): { hersteller: string | null; typ: string | null } | undefined {
  const zaehler = new Map<string, { hersteller: string | null; typ: string | null; n: number }>();
  for (const t of bauteile) {
    if (t.katalogId !== katalogId || (!t.hersteller && !t.typ)) continue;
    const k = JSON.stringify([t.hersteller, t.typ]);
    const x = zaehler.get(k);
    if (x) x.n++; else zaehler.set(k, { hersteller: t.hersteller, typ: t.typ, n: 1 });
  }
  let best: { hersteller: string | null; typ: string | null; n: number } | undefined;
  for (const x of zaehler.values()) if (!best || x.n > best.n) best = x;
  return best && { hersteller: best.hersteller, typ: best.typ };
}

/** Abgaben einer Einheit an die wirksame Heizung anpassen. Status folgt der Heizart: ja → bestätigt, unbekannt → vorgeschlagen (Entscheid 4). */
function abgabenAbgleichen(z: AssistentZustand, einheit: string, arten: readonly HeizArt[] = HEIZ_ARTEN): AssistentZustand {
  const e = z.einheiten.find((x) => x.schluessel === einheit);
  if (!e) return z;
  const w = wirksam(z, e);
  const erlaubt = ERLAUBT[e.art] ?? [];
  let neu = z;
  for (const art of arten) {
    const kat = ABGABE_VON[art];
    const vorhanden = abgabenVon(neu, einheit).filter((t) => t.katalogId === kat);
    if (w[art] === "nein" || !erlaubt.includes(kat)) { neu = entferneBauteile(neu, vorhanden.map((t) => t.schluessel)); continue; }
    const status: BauteilStatus = w[art] === "ja" ? "bestaetigt" : "vorgeschlagen";
    for (const t of vorhanden) if (t.status !== status) neu = ersetzeBauteil(neu, t.schluessel, (x) => ({ ...x, status }));
    if (w[art] === "ja" && vorhanden.length === 0 && e.art !== "technik") {
      const g = neu.standardGeraet[art];
      [neu] = neuesBauteil(neu, { katalogId: kat, standort: { einheit }, menge: null, status, hersteller: g?.hersteller ?? null, typ: g?.typ ?? null });
    }
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
  const z2 = reduziereKern(z, { typ: "einheitNeu", geschoss: unten.code, art: "technik", bezeichnung: "Technik" });
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

// --- Automatik: FBH-Verteiler und Gruppen ---
export const GRUPPEN_ART_VON: Readonly<Record<HeizArt, GruppenArt>> = { hk: "ungeregelt", fbh: "beimisch", tabs: "einspritz" };
const gruppeSetzen = (z: AssistentZustand, s: string, f: (g: ZGruppe) => ZGruppe): AssistentZustand =>
  ({ ...z, gruppen: z.gruppen.map((g) => (g.schluessel === s ? f(g) : g)) });

/** Verbraucher einer Heizart: HK- und TABS-Abgaben; für FBH die FBH-Verteiler und FBH-Kreise in Einheiten ohne Verteiler. */
export function verbraucherDerArt(z: AssistentZustand, art: HeizArt): ZBauteil[] {
  if (art !== "fbh") return z.bauteile.filter((t) => t.katalogId === ABGABE_VON[art] && "einheit" in t.standort);
  const uv = unterverteiler(z);
  const mitUv = new Set(uv.flatMap((t) => t.versorgt));
  return [...uv, ...z.bauteile.filter((t) => t.katalogId === K.fbh && "einheit" in t.standort && !mitUv.has(t.standort.einheit))];
}

/** Je Einheit mit wirksamer FBH ein FBH-Verteiler (H4); unberührte entfallen, wenn die FBH wegfällt. */
export function fbhVerteilerAbleiten(z: AssistentZustand): AssistentZustand {
  if (!z.automatik) return z;
  const soll = new Set(unterverteilerVorschlaege(z).map((e) => e.schluessel).filter((s) => !z.fbhVerteilerAus.includes(s)));
  const einheitDes = (t: ZBauteil) => ("einheit" in t.standort ? t.standort.einheit : "");
  let neu = entferneBauteile(z, unterverteiler(z).filter((t) => t.auto && !soll.has(einheitDes(t))).map((t) => t.schluessel));
  for (const e of soll) {
    if (unterverteiler(neu).some((t) => einheitDes(t) === e)) continue;
    let s: string;
    [neu, s] = neuesBauteil(neu, { katalogId: K.verteiler, standort: { einheit: e }, menge: 1, status: "vorgeschlagen", versorgt: [e], auto: true, fbh: true });
    if (neu.fbhWmz) neu = reduziereKern(neu, { typ: "unterverteilerWmz", verteiler: s, an: true });
  }
  return neu;
}

function gruppeAnlegen(z: AssistentZustand, verteiler: string, regel: ZGruppenRegel, bezeichnung: string): [AssistentZustand, string] {
  const [s, z1] = neuerSchluessel(z);
  const nummer = Math.max(0, ...z1.gruppen.filter((g) => g.verteiler === verteiler).map((g) => g.nummer)) + 1;
  const art = GRUPPEN_ART_VON[regel.heizart];
  const neu: AssistentZustand = { ...z1, gruppen: [...z1.gruppen, { schluessel: s, verteiler, nummer, art, bezeichnung, verbraucher: [], regel }] };
  return [bestueckungSetzen(neu, s, art), s];
}

/** Je Heizart mit Verbrauchern eine Gruppe am Hauptverteiler (H3). */
export function gruppenVorschlagen(z: AssistentZustand): AssistentZustand {
  const arten = HEIZ_ARTEN.filter((a) => verbraucherDerArt(z, a).length > 0);
  if (arten.length === 0) return z;
  let [neu, v] = mitHauptverteiler(z);
  if (!v) return neu;
  const vorher = new Set(neu.gruppen.map((g) => g.schluessel));
  for (const art of arten) [neu] = gruppeAnlegen(neu, v, { heizart: art }, HEIZ_NAME[art]);
  neu = { ...neu, gruppen: neu.gruppen.map((g) => (vorher.has(g.schluessel) ? g : { ...g, vorgeschlagen: true })) };
  return gruppenVerbraucherNachfuehren({ ...neu, gruppenVorgeschlagen: true });
}

/** Regel-Gruppen (nicht angefasst) erhalten ihre Verbraucher: Einheit-Regel vor Geschoss-Regel vor Rest-Gruppe. */
export function gruppenVerbraucherNachfuehren(z: AssistentZustand): AssistentZustand {
  const regelGruppen = z.gruppen.filter((g) => g.regel && !g.angefasst);
  if (regelGruppen.length === 0) return z;
  const fest = new Set(z.gruppen.filter((g) => !(g.regel && !g.angefasst)).flatMap((g) => g.verbraucher));
  const zuteilung = new Map<string, string[]>(regelGruppen.map((g) => [g.schluessel, []]));
  for (const art of HEIZ_ARTEN) for (const t of verbraucherDerArt(z, art)) {
    if (fest.has(t.schluessel)) continue;
    const einheit = einheitVon(z, t)?.schluessel;
    const code = geschossVon(z, t);
    const kand = regelGruppen.filter((g) => g.regel!.heizart === art);
    const g = kand.find((x) => x.regel!.einheit !== undefined && x.regel!.einheit === einheit)
      ?? kand.find((x) => x.regel!.einheit === undefined && code !== undefined && (x.regel!.geschosse?.includes(code) ?? false))
      ?? kand.find((x) => x.regel!.einheit === undefined && x.regel!.geschosse === undefined);
    if (g) zuteilung.get(g.schluessel)!.push(t.schluessel);
  }
  const gruppen = z.gruppen.map((g) => {
    const v = zuteilung.get(g.schluessel);
    return v && (v.length !== g.verbraucher.length || v.some((x, i) => x !== g.verbraucher[i])) ? { ...g, verbraucher: v } : g;
  });
  return versorgungNachfuehren({ ...z, gruppen });
}

/** FBH-Verteiler je speisender Gruppe (für den Satz «9 FBH-Verteiler an Gruppe …»). */
export function fbhSpeisung(z: AssistentZustand): { gruppe: ZGruppe | null; anzahl: number }[] {
  const m = new Map<ZGruppe | null, number>();
  for (const t of unterverteiler(z)) { const g = gruppeVonVerbraucher(z, t.schluessel) ?? null; m.set(g, (m.get(g) ?? 0) + 1); }
  return [...m].map(([gruppe, anzahl]) => ({ gruppe, anzahl }));
}

/** Nach jeder Aktion: Zentrale-Raum vorbelegen, FBH-Verteiler, einmaliger Gruppenvorschlag, Regel-Verbraucher. */
function ableiten(z: AssistentZustand): AssistentZustand {
  let neu = z;
  if (!neu.zentraleRaum) {
    const technik = neu.einheiten.filter((e) => e.art === "technik");
    if (technik.length === 1) neu = { ...neu, zentraleRaum: technik[0].schluessel };
  }
  neu = fbhVerteilerAbleiten(neu);
  if (neu.automatik && !neu.gruppenVorgeschlagen && neu.schritt >= 5 && neu.gruppen.length === 0) neu = gruppenVorschlagen(neu);
  return gruppenVerbraucherNachfuehren(neu);
}

/** Verschiebt Zentralgeräte, Hauptverteiler und deren Zubehör in den Raum. */
function zentraleVerschieben(z: AssistentZustand, raum: string): AssistentZustand {
  const h = hauptverteiler(z);
  const bewegen = new Set<string>([...zentraleGeraete(z).map((t) => t.schluessel), ...(h ? [h.schluessel] : [])]);
  const gruppenH = new Set(z.gruppen.filter((g) => g.verteiler === h?.schluessel).map((g) => g.schluessel));
  for (const t of z.bauteile) if (t.ort && (("gruppe" in t.ort && gruppenH.has(t.ort.gruppe)) || ("vorBauteil" in t.ort && bewegen.has(t.ort.vorBauteil)))) bewegen.add(t.schluessel);
  return { ...z, zentraleRaum: raum, bauteile: z.bauteile.map((t) => (bewegen.has(t.schluessel) ? { ...t, standort: { einheit: raum } } : t)) };
}

// --- Regelgeschoss ---
export const vorlageVonGeschoss = (z: AssistentZustand, code: string) => z.vorlagen.find((v) => v.geschosse.includes(code));
const vorlageVon = (z: AssistentZustand, s: string) => z.vorlagen.find((v) => v.schluessel === s);
const vorlageSetzen = (z: AssistentZustand, s: string, f: (v: ZVorlage) => ZVorlage): AssistentZustand =>
  ({ ...z, vorlagen: z.vorlagen.map((v) => (v.schluessel === s ? f(v) : v)) });
const einheitSetzen = (z: AssistentZustand, s: string, f: (e: ZEinheit) => ZEinheit): AssistentZustand =>
  ({ ...z, einheiten: z.einheiten.map((e) => (e.schluessel === s ? f(e) : e)) });
function ohneVorlage(e: ZEinheit): ZEinheit {
  const { vorlage: _v, abweichend: _a, ...rest } = e;
  return rest;
}
const gleicheAusnahme = (x: Partial<Heizung>, y: Partial<Heizung>) => HEIZ_ARTEN.every((a) => x[a] === y[a]);
export const platzWirksam = (z: AssistentZustand, p: ZPlatz): Heizung => ({ ...z.heizungStandard, ...p.ausnahme });

/** Ausgelassene Plätze sind eine Abweichung der Einheiten (Schritt 2): zählen nur ohne Feldangabe oder mit `art`/`bezeichnung`. */
const mitAusgelassen = (felder?: readonly VorlageFeld[]) => !felder || felder.includes("art") || felder.includes("bezeichnung");
/** Abweichende Felder einer Einheit, eingeschränkt auf `felder` (ohne Angabe: alle). */
export const abweichendIn = (e: ZEinheit, felder?: readonly VorlageFeld[]): VorlageFeld[] =>
  (e.abweichend ?? []).filter((f) => !felder || felder.includes(f));

/** Einheiten mit Abweichung (in `felder`, ohne Angabe: alle) plus ausgelassene Plätze einer Vorlage, optional nur in einem Geschoss. */
export function abweichungen(z: AssistentZustand, vorlage: string, felder?: readonly VorlageFeld[], geschoss?: string): number {
  const v = vorlageVon(z, vorlage);
  if (!v) return 0;
  const hier = (code: string) => geschoss === undefined || code === geschoss;
  return z.einheiten.filter((e) => e.vorlage?.schluessel === vorlage && hier(e.geschoss) && abweichendIn(e, felder).length > 0).length
    + (mitAusgelassen(felder) ? v.ausgelassen.filter((o) => hier(o.geschoss)).length : 0);
}

function mengenVon(z: AssistentZustand, einheit: string): Partial<Record<HeizArt, number>> {
  const r: Partial<Record<HeizArt, number>> = {};
  for (const art of HEIZ_ARTEN) {
    const t = abgabenVon(z, einheit).find((x) => x.katalogId === ABGABE_VON[art]);
    if (t && t.menge !== null) r[art] = t.menge;
  }
  return r;
}

/** Felder einer bestehenden Einheit, die vom Platz abweichen (beim Verknüpfen einer freien Einheit). */
function abweichendVomPlatz(z: AssistentZustand, e: ZEinheit, p: ZPlatz, code: string, i: number): VorlageFeld[] {
  const r: VorlageFeld[] = [];
  if (e.bezeichnung !== nummerieren(code, p.art, i + 1)) r.push("bezeichnung");
  if (!gleicheAusnahme(e.ausnahme, p.ausnahme)) r.push("ausnahme");
  const m = mengenVon(z, e.schluessel);
  if (HEIZ_ARTEN.some((art) => (m[art] ?? null) !== (p.mengen[art] ?? null))) r.push("mengen");
  return r;
}

/**
 * Vorlage in allen zugewiesenen Geschossen durchsetzen: fehlende Plätze anlegen (freie Einheit gleicher Art bevorzugt),
 * Einheiten entfallener Plätze löschen (mit Abweichung: lösen), Felder ohne Abweichung übernehmen.
 */
function vorlageAnwenden(z: AssistentZustand, vs: string): AssistentZustand {
  const v = vorlageVon(z, vs);
  if (!v) return z;
  let neu = z;
  const verknuepfe = (s: string, platz: string, abweichend: VorlageFeld[] = []) => { neu = einheitSetzen(neu, s, (e) => ({ ...e, vorlage: { schluessel: vs, platz }, abweichend })); };
  for (const code of v.geschosse) {
    v.plaetze.forEach((p, i) => {
      if (v.ausgelassen.some((x) => x.geschoss === code && x.platz === p.schluessel)) return;
      if (neu.einheiten.some((e) => e.geschoss === code && e.vorlage?.schluessel === vs && e.vorlage.platz === p.schluessel)) return;
      const frei = neu.einheiten.find((e) => e.geschoss === code && !e.vorlage && e.art === p.art);
      // Freie Einheit übernehmen, ihre Daten aber behalten: alles, was vom Platz abweicht, gilt als Abweichung
      if (frei) { verknuepfe(frei.schluessel, p.schluessel, abweichendVomPlatz(neu, frei, p, code, i)); return; }
      neu = reduziereKern(neu, { typ: "einheitNeu", geschoss: code, art: p.art, bezeichnung: nummerieren(code, p.art, i + 1) });
      verknuepfe(neu.einheiten[neu.einheiten.length - 1].schluessel, p.schluessel);
    });
  }
  const plaetze = new Set(v.plaetze.map((p) => p.schluessel));
  for (const e of neu.einheiten.filter((x) => x.vorlage?.schluessel === vs && !plaetze.has(x.vorlage.platz)))
    neu = e.abweichend?.length ? einheitSetzen(neu, e.schluessel, ohneVorlage) : reduziereKern(neu, { typ: "einheitLoeschen", schluessel: e.schluessel });
  v.plaetze.forEach((p, i) => {
    for (const e of neu.einheiten.filter((x) => x.vorlage?.schluessel === vs && x.vorlage.platz === p.schluessel)) {
      const ab = new Set(e.abweichend ?? []);
      if (!ab.has("art") && e.art !== p.art) neu = reduziereKern(neu, { typ: "einheitAendern", schluessel: e.schluessel, art: p.art });
      if (!ab.has("bezeichnung")) {
        const b = nummerieren(e.geschoss, p.art, i + 1);
        neu = einheitSetzen(neu, e.schluessel, (x) => (x.bezeichnung === b ? x : { ...x, bezeichnung: b }));
      }
      if (!ab.has("ausnahme") && !gleicheAusnahme(e.ausnahme, p.ausnahme)) {
        neu = einheitSetzen(neu, e.schluessel, (x) => ({ ...x, ausnahme: { ...p.ausnahme } }));
        neu = abgabenAbgleichen(neu, e.schluessel);
      }
      if (!ab.has("mengen")) for (const art of HEIZ_ARTEN) {
        const t = abgabenVon(neu, e.schluessel).find((x) => x.katalogId === ABGABE_VON[art]);
        const m = p.mengen[art] ?? null;
        if (!t || t.menge === m) continue;
        neu = m === null ? reduziereKern(neu, { typ: "abgabeWeissNicht", schluessel: t.schluessel }) : reduziereKern(neu, { typ: "abgabeAendern", schluessel: t.schluessel, menge: m });
      }
    }
  });
  return neu;
}

/** Abweichung ohne die zurückgesetzten Felder (ohne Angabe: alle zurücksetzen). */
const ohneFelder = (e: ZEinheit, felder?: readonly VorlageFeld[]): VorlageFeld[] => (felder ? (e.abweichend ?? []).filter((f) => !felder.includes(f)) : []);

/** Ausnahme normalisieren: gleich wie Standard oder null → keine Ausnahme. */
function ausnahmeSetzen(aus: Partial<Heizung>, art: HeizArt, wert: Dreiwertig | null, standard: Heizung): Partial<Heizung> {
  const r = { ...aus };
  if (wert === null || wert === standard[art]) delete r[art]; else r[art] = wert;
  return r;
}

const erlaubtIn = (e: ZEinheit, art: HeizArt) => (ERLAUBT[e.art] ?? []).includes(ABGABE_VON[art]);

/**
 * Einheiten eines Geschosses, in denen die Heizart (und ggf. `nurMit`) erlaubt ist und deren Ausnahme sich durch den Wert
 * tatsächlich ändert. Gilt für Reducer und Markierung gleichermassen (N1: Kern behält Heizkörper bei «Fussbodenheizung»).
 */
function geschossAusnahmeBetroffen(z: AssistentZustand, geschoss: string, art: HeizArt, wert: Dreiwertig | null, nurMit?: HeizArt): ZEinheit[] {
  return z.einheiten.filter((e) => e.geschoss === geschoss && erlaubtIn(e, art) && (!nurMit || erlaubtIn(e, nurMit))
    && ausnahmeSetzen(e.ausnahme, art, wert, z.heizungStandard)[art] !== e.ausnahme[art]);
}

/** Erlaubte Abgabe-Arten einer Einheit als Schlüssel (Büro/Wohnung/Gastro/Allgemein gleich, Kern und Technik anders). */
const abgabeProfil = (e: ZEinheit) => HEIZ_ARTEN.filter((a) => erlaubtIn(e, a)).join("/");

/**
 * N2: Neu angelegte Einheiten eines Regelgeschosses (z. B. wiederhergestellter Platz) übernehmen die Geschoss-Heizung,
 * wenn alle übrigen Regel-Einheiten des Geschosses mit gleichem Abgabe-Profil dieselbe markierte Ausnahme tragen.
 */
function geschossHeizungErben(z: AssistentZustand, vorher: AssistentZustand): AssistentZustand {
  const alt = new Set(vorher.einheiten.map((e) => e.schluessel));
  let neu = z;
  for (const e of z.einheiten.filter((x) => !alt.has(x.schluessel) && x.vorlage && !(x.abweichend ?? []).includes("ausnahme"))) {
    const andere = z.einheiten.filter((x) => alt.has(x.schluessel) && x.geschoss === e.geschoss && x.vorlage && abgabeProfil(x) === abgabeProfil(e));
    if (andere.length === 0 || !andere.every((x) => (x.abweichend ?? []).includes("ausnahme") && gleicheAusnahme(x.ausnahme, andere[0].ausnahme))) continue;
    const ausnahme = { ...andere[0].ausnahme };
    neu = einheitSetzen(neu, e.schluessel, (x) => ({ ...x, ausnahme, abweichend: [...(x.abweichend ?? []), "ausnahme"] }));
    neu = abgabenAbgleichen(neu, e.schluessel);
  }
  return neu;
}

/** Direkte Änderungen an Einheiten eines Regelgeschosses als Abweichung merken (vor der Kernaktion). */
function abweichungMarkieren(z: AssistentZustand, a: Aktion): AssistentZustand {
  const markiere = (zz: AssistentZustand, einheit: string | undefined, feld: VorlageFeld) => {
    const e = einheit ? zz.einheiten.find((x) => x.schluessel === einheit) : undefined;
    if (!e?.vorlage || e.abweichend?.includes(feld)) return zz;
    return einheitSetzen(zz, e.schluessel, (x) => ({ ...x, abweichend: [...(x.abweichend ?? []), feld] }));
  };
  const einheitDes = (bauteil: string) => { const t = z.bauteile.find((x) => x.schluessel === bauteil); return t ? einheitVon(z, t)?.schluessel : undefined; };
  switch (a.typ) {
    case "einheitAendern": {
      let n = z;
      if (a.bezeichnung !== undefined) n = markiere(n, a.schluessel, "bezeichnung");
      if (a.art !== undefined) n = markiere(n, a.schluessel, "art");
      return n;
    }
    case "ausnahme": return markiere(z, a.einheit, "ausnahme");
    case "geschossAusnahme": return geschossAusnahmeBetroffen(z, a.geschoss, a.art, a.wert, a.nurMit).reduce((n, e) => markiere(n, e.schluessel, "ausnahme"), z);
    case "abgabeAendern": return a.menge === undefined ? z : markiere(z, einheitDes(a.schluessel), "mengen");
    case "abgabeWeissNicht": return markiere(z, einheitDes(a.schluessel), "mengen");
    case "einheitLoeschen": {
      const e = z.einheiten.find((x) => x.schluessel === a.schluessel);
      if (!e?.vorlage) return z;
      const { schluessel, platz } = e.vorlage;
      return vorlageSetzen(z, schluessel, (v) => ({ ...v, ausgelassen: [...v.ausgelassen, { geschoss: e.geschoss, platz }] }));
    }
    case "verbraucher": {
      const alt = gruppeVonVerbraucher(z, a.bauteil);
      let n = z;
      for (const s of [a.gruppe, alt?.schluessel]) if (s) n = gruppeSetzen(n, s, (g) => ({ ...g, angefasst: true }));
      return ersetzeBauteil(n, a.bauteil, (t) => (t.auto ? { ...t, auto: false, status: "bestaetigt" } : t));
    }
    case "unterverteilerWmz":
      return ersetzeBauteil(z, a.verteiler, (t) => (t.auto ? { ...t, auto: false, status: "bestaetigt" } : t));
    default: return z;
  }
}

/** Öffentlicher Reducer: Abweichung markieren, Kernaktion, dann Ableitung (FBH-Verteiler, Gruppen). */
export function reduziere(z: AssistentZustand, a: Aktion): AssistentZustand {
  if (a.typ === "laden") return a.zustand;
  return ableiten(reduziereKern(abweichungMarkieren(z, a), a));
}

function reduziereKern(z: AssistentZustand, a: Aktion): AssistentZustand {
  switch (a.typ) {
    case "laden": return a.zustand;
    case "schritt": return schrittErreichbar(z, a.nr) ? { ...z, schritt: a.nr } : z;
    case "weiter": return z.schritt < LETZTER_SCHRITT && schrittErreichbar(z, (z.schritt + 1) as SchrittNr) ? { ...z, schritt: (z.schritt + 1) as SchrittNr } : z;
    case "zurueck": return z.schritt > 1 ? { ...z, schritt: (z.schritt - 1) as SchrittNr } : z;
    case "huelleBearbeitbar": return { ...z, huelleBearbeitbar: a.wert };
    case "gebaeude":
      if (!z.huelleBearbeitbar) return z;
      return reduziereKern(z, { ...a, typ: "kopf" });
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
      for (const s of einheitenWeg) neu = reduziereKern(neu, { typ: "einheitLoeschen", schluessel: s });
      neu = { ...neu, vorlagen: neu.vorlagen.map((v) => ({ ...v, geschosse: v.geschosse.filter((g) => codes.has(g)), ausgelassen: v.ausgelassen.filter((o) => codes.has(o.geschoss)) })) };
      return neu;
    }
    case "gebaeudeAngelegt": {
      const ids = new Map(a.geschosse.map((g) => [g.code, g.id]));
      return { ...z, huelleBearbeitbar: false, gebaeude: { ...z.gebaeude, id: a.id, stand: a.stand,
        geschosse: z.gebaeude.geschosse.map((g) => ({ ...g, id: ids.get(g.code) ?? g.id })) } };
    }
    case "einheitNeu": {
      const anzahl = Math.max(1, Math.min(50, a.anzahl ?? 1));
      let neu = z;
      for (let i = 0; i < anzahl; i++) {
        const [s, z2] = neuerSchluessel(neu);
        const bezeichnung = a.bezeichnung ?? nummerieren(a.geschoss, a.art, naechsteLfd(z2.einheiten, a.geschoss));
        neu = { ...z2, einheiten: [...z2.einheiten, { schluessel: s, geschoss: a.geschoss, bezeichnung, art: a.art, flaecheM2: null, ausnahme: {} }] };
        neu = abgabenAbgleichen(neu, s);
      }
      return neu;
    }
    case "einheitAnzahl": {
      const vorhanden = z.einheiten.filter((e) => e.geschoss === a.geschoss && e.art === a.art && !e.vorlage);
      const soll = Math.max(0, Math.min(50, Math.floor(a.anzahl)));
      if (soll > vorhanden.length) return reduziereKern(z, { typ: "einheitNeu", geschoss: a.geschoss, art: a.art, anzahl: soll - vorhanden.length });
      let neu = z;
      for (const e of vorhanden.slice(soll)) neu = reduziereKern(neu, { typ: "einheitLoeschen", schluessel: e.schluessel });
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
    case "standardGeraet": {
      const alt = z.standardGeraet[a.art] ?? { hersteller: null, typ: null };
      const neuG = { hersteller: a.hersteller !== undefined ? (a.hersteller || null) : alt.hersteller, typ: a.geraetTyp !== undefined ? (a.geraetTyp || null) : alt.typ };
      const kat = ABGABE_VON[a.art];
      return { ...z, standardGeraet: { ...z.standardGeraet, [a.art]: neuG },
        bauteile: z.bauteile.map((t) => (t.katalogId === kat && t.hersteller === alt.hersteller && t.typ === alt.typ ? { ...t, hersteller: neuG.hersteller, typ: neuG.typ } : t)) };
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
      const art = HEIZ_ARTEN.find((x) => ABGABE_VON[x] === a.katalogId);
      const g = art ? z.standardGeraet[art] : undefined;
      // Wie abgabenAbgleichen: bestätigt nur bei wirksam «ja» (Prüfregel bestaetigt_bei_unbekannt)
      const status: BauteilStatus = art && wirksam(z, e)[art] === "ja" ? "bestaetigt" : "vorgeschlagen";
      return neuesBauteil(z, { katalogId: a.katalogId, standort: { einheit: a.einheit }, menge: null, status, hersteller: g?.hersteller ?? null, typ: g?.typ ?? null })[0];
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
    case "abgabeWeissNicht": return ersetzeBauteil(z, a.schluessel, (t) => {
      const e = einheitVon(z, t);
      const art = HEIZ_ARTEN.find((x) => ABGABE_VON[x] === t.katalogId);
      const sicher = !e || !art || wirksam(z, e)[art] === "ja";
      return { ...t, menge: null, status: sicher ? "bestaetigt" : "vorgeschlagen" };
    });
    case "bauteilLoeschen": return entferneBauteile(z, [a.schluessel]);
    case "zentraleRaum": return zentraleVerschieben(z, a.einheit);
    case "technikraumNeu": {
      const z2 = reduziereKern(z, { typ: "einheitNeu", geschoss: a.geschoss, art: "technik", bezeichnung: "Technik" });
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
    case "gruppeName": return { ...z, gruppen: z.gruppen.map((g) => (g.schluessel === a.schluessel ? { ...g, bezeichnung: a.bezeichnung, vorgeschlagen: false } : g)) };
    case "gruppeArt": {
      const neu = { ...z, gruppen: z.gruppen.map((g) => (g.schluessel === a.schluessel ? { ...g, art: a.art, vorgeschlagen: false } : g)) };
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
      const aus = a.an ? z.fbhVerteilerAus.filter((s) => s !== a.einheit) : [...new Set([...z.fbhVerteilerAus, a.einheit])];
      const z0 = { ...z, fbhVerteilerAus: aus };
      const vorhanden = unterverteiler(z0).filter((t) => "einheit" in t.standort && t.standort.einheit === a.einheit);
      if (!a.an) return entferneBauteile(z0, vorhanden.map((t) => t.schluessel));
      if (vorhanden.length) return z0;
      return neuesBauteil(z0, { katalogId: K.verteiler, standort: { einheit: a.einheit }, menge: 1, status: "bestaetigt", versorgt: [a.einheit], fbh: true })[0];
    }
    case "gruppenVorschlagen": return gruppenVorschlagen(z);
    case "gruppeTeilen": {
      const g = z.gruppen.find((x) => x.schluessel === a.gruppe);
      // Angefasste Gruppen ordnen nicht mehr neu zu; die neue Gruppe bliebe leer
      if (!g?.regel || g.angefasst || a.geschosse.length === 0) return z;
      const art = g.regel.heizart;
      const codes = [...a.geschosse].sort((x, y) => geschossRang(x) - geschossRang(y));
      let neu: AssistentZustand = { ...z, gruppen: z.gruppen.map((x) => (x.regel?.heizart === art && x.regel.geschosse
        ? { ...x, regel: { ...x.regel, geschosse: x.regel.geschosse.filter((c) => !codes.includes(c)) } } : x)) };
      const titel = `${HEIZ_NAME[art]} ${codes.length > 3 ? `${codes[0]}–${codes[codes.length - 1]}` : codes.join(", ")}`;
      [neu] = gruppeAnlegen(neu, g.verteiler, { heizart: art, geschosse: codes }, titel);
      return neu;
    }
    case "sondergruppe": {
      const e = z.einheiten.find((x) => x.schluessel === a.einheit);
      const [z1, v] = mitHauptverteiler(z);
      if (!e || !v) return z1;
      return gruppeAnlegen(z1, v, { heizart: a.heizart, einheit: a.einheit }, `${HEIZ_NAME[a.heizart]} ${e.bezeichnung}`)[0];
    }
    case "gruppeFuerArt": {
      const [z1, v] = mitHauptverteiler(z);
      return v ? gruppeAnlegen(z1, v, { heizart: a.heizart }, HEIZ_NAME[a.heizart])[0] : z1;
    }
    case "gruppeEntfernen":
      return entferneBauteile({ ...z, gruppen: z.gruppen.filter((g) => g.schluessel !== a.gruppe) }, zubehoerVon(z, a.gruppe).map((t) => t.schluessel));
    case "fbhWmzAlle": {
      let neu: AssistentZustand = { ...z, fbhWmz: a.an };
      for (const t of unterverteiler(neu)) neu = reduziereKern(neu, { typ: "unterverteilerWmz", verteiler: t.schluessel, an: a.an });
      return neu;
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
    case "vorlageNeu": {
      let [vs, neu] = neuerSchluessel(z);
      const name = a.name ?? (z.vorlagen.length ? `Regelgeschoss ${z.vorlagen.length + 1}` : "Regelgeschoss");
      const quelle = a.ausGeschoss ? z.einheiten.filter((e) => e.geschoss === a.ausGeschoss && !e.vorlage) : [];
      const plaetze: ZPlatz[] = [];
      const links: { einheit: string; platz: string; abweichend: VorlageFeld[] }[] = [];
      quelle.forEach((e, i) => {
        let ps: string;
        [ps, neu] = neuerSchluessel(neu);
        plaetze.push({ schluessel: ps, art: e.art, ausnahme: { ...e.ausnahme }, mengen: mengenVon(neu, e.schluessel) });
        links.push({ einheit: e.schluessel, platz: ps, abweichend: e.bezeichnung === nummerieren(e.geschoss, e.art, i + 1) ? [] : ["bezeichnung"] });
      });
      let r: AssistentZustand = neu;
      if (a.ausGeschoss) for (const v of r.vorlagen.filter((x) => x.geschosse.includes(a.ausGeschoss!)))
        r = reduziereKern(r, { typ: "vorlageZuweisen", vorlage: v.schluessel, geschoss: a.ausGeschoss, an: false });
      r = { ...r, vorlagen: [...r.vorlagen, { schluessel: vs, name, plaetze, geschosse: a.ausGeschoss ? [a.ausGeschoss] : [], ausgelassen: [] }] };
      for (const l of links) r = einheitSetzen(r, l.einheit, (e) => ({ ...e, vorlage: { schluessel: vs, platz: l.platz }, abweichend: l.abweichend }));
      return r;
    }
    case "vorlageName": return vorlageSetzen(z, a.vorlage, (v) => ({ ...v, name: a.name }));
    case "platzAnzahl": {
      const v = vorlageVon(z, a.vorlage);
      if (!v) return z;
      const soll = Math.max(0, Math.min(50, Math.floor(a.anzahl)));
      const gleiche = v.plaetze.filter((p) => p.art === a.art);
      let neu = z;
      let plaetze = v.plaetze;
      if (soll > gleiche.length) for (let i = gleiche.length; i < soll; i++) {
        const [ps, z2] = neuerSchluessel(neu);
        neu = z2;
        plaetze = [...plaetze, { schluessel: ps, art: a.art, ausnahme: {}, mengen: {} }];
      } else {
        const weg = new Set(gleiche.slice(soll).map((p) => p.schluessel));
        plaetze = plaetze.filter((p) => !weg.has(p.schluessel));
      }
      neu = vorlageSetzen(neu, a.vorlage, (x) => ({ ...x, plaetze, ausgelassen: x.ausgelassen.filter((o) => plaetze.some((p) => p.schluessel === o.platz)) }));
      return vorlageAnwenden(neu, a.vorlage);
    }
    case "platzAusnahme":
      return vorlageAnwenden(vorlageSetzen(z, a.vorlage, (v) => ({ ...v, plaetze: v.plaetze.map((p) =>
        (p.schluessel === a.platz ? { ...p, ausnahme: ausnahmeSetzen(p.ausnahme, a.art, a.wert, z.heizungStandard) } : p)) })), a.vorlage);
    case "platzMenge":
      return vorlageAnwenden(vorlageSetzen(z, a.vorlage, (v) => ({ ...v, plaetze: v.plaetze.map((p) => {
        if (p.schluessel !== a.platz) return p;
        const mengen = { ...p.mengen };
        if (a.menge === null) delete mengen[a.art]; else mengen[a.art] = Math.max(0, Math.round(a.menge));
        return { ...p, mengen };
      }) })), a.vorlage);
    case "vorlageZuweisen": {
      if (a.an) {
        let neu = z;
        for (const andere of z.vorlagen.filter((v) => v.schluessel !== a.vorlage && v.geschosse.includes(a.geschoss)))
          neu = reduziereKern(neu, { typ: "vorlageZuweisen", vorlage: andere.schluessel, geschoss: a.geschoss, an: false });
        neu = vorlageSetzen(neu, a.vorlage, (v) => (v.geschosse.includes(a.geschoss) ? v : { ...v, geschosse: [...v.geschosse, a.geschoss] }));
        return vorlageAnwenden(neu, a.vorlage);
      }
      const neu = vorlageSetzen(z, a.vorlage, (v) => ({ ...v, geschosse: v.geschosse.filter((g) => g !== a.geschoss), ausgelassen: v.ausgelassen.filter((o) => o.geschoss !== a.geschoss) }));
      return { ...neu, einheiten: neu.einheiten.map((e) => (e.geschoss === a.geschoss && e.vorlage?.schluessel === a.vorlage ? ohneVorlage(e) : e)) };
    }
    case "vorlageLoeschen":
      return { ...z, vorlagen: z.vorlagen.filter((v) => v.schluessel !== a.vorlage),
        einheiten: z.einheiten.map((e) => (e.vorlage?.schluessel === a.vorlage ? ohneVorlage(e) : e)) };
    case "einheitZuruecksetzen": {
      const e = z.einheiten.find((x) => x.schluessel === a.einheit);
      if (!e?.vorlage) return z;
      return geschossHeizungErben(vorlageAnwenden(einheitSetzen(z, e.schluessel, (x) => ({ ...x, abweichend: ohneFelder(x, a.felder) })), e.vorlage.schluessel), z);
    }
    case "geschossZuruecksetzen": {
      const v = vorlageVonGeschoss(z, a.geschoss);
      if (!v) return z;
      let neu = mitAusgelassen(a.felder)
        ? vorlageSetzen(z, v.schluessel, (x) => ({ ...x, ausgelassen: x.ausgelassen.filter((o) => o.geschoss !== a.geschoss) })) : z;
      neu = { ...neu, einheiten: neu.einheiten.map((e) => (e.geschoss === a.geschoss && e.vorlage ? { ...e, abweichend: ohneFelder(e, a.felder) } : e)) };
      return geschossHeizungErben(vorlageAnwenden(neu, v.schluessel), z);
    }
    case "geschossAusnahme": {
      let neu = z;
      for (const e of geschossAusnahmeBetroffen(z, a.geschoss, a.art, a.wert, a.nurMit))
        neu = reduziereKern(neu, { typ: "ausnahme", einheit: e.schluessel, art: a.art, wert: a.wert });
      return neu;
    }
  }
}

/** Teile "an anderem Ort" (Schritt 6, ohne WMZ der FBH-Verteiler). */
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

/** Einheiten mit wirksamer FBH, in denen ein FBH-Verteiler sinnvoll ist (Schritt 5). */
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

/** Bezugsgeräte für "Teil vor Bauteil X" (Schritt 6): Erzeuger, Speicher und Verteiler. */
export function vorKandidaten(z: AssistentZustand): ZBauteil[] {
  return z.bauteile.filter((t) => istZentralgeraet(t) || t.katalogId === K.verteiler);
}
