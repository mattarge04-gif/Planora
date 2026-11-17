import type { BauteilVerweis, EinheitVerweis, GruppeVerweis, HeizArt, Heizung } from "../typen";
import { K } from "./bestueckung";
import type { Positionen } from "./beschreibung";
import type { AssistentZustand, VorlageFeld, ZGruppe, ZVorlage } from "./zustand";

/** Spiegel von app/src/welt/vorlage.ts (Geschosse als IDs). */
interface VorlageDaten { schluessel: string; name: string; plaetze: { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }
/** Merker der Automatik (E42); Spiegel von app/src/welt/vorlage.ts. */
interface MerkerGruppe<E, G> { gruppe: G; regel?: { heizart: HeizArt; geschosse?: string[]; einheit?: E }; angefasst?: boolean; vorgeschlagen?: boolean }
interface Merker<E, B, G> { fbhWmz: boolean; gruppenVorgeschlagen: boolean; fbhVerteilerAus: E[]; autoVerteiler: B[]; gruppen: MerkerGruppe<E, G>[] }
export interface VorlagenEingabe {
  version: 1; vorlagen: VorlageDaten[]; zuordnung: { einheit: EinheitVerweis; vorlage: string; platz: string; abweichend: VorlageFeld[] }[];
  automatik?: Merker<EinheitVerweis, BauteilVerweis, GruppeVerweis>;
}
export interface VorlagenGespeichert {
  version: 1; vorlagen: VorlageDaten[]; zuordnung: Record<string, { vorlage: string; platz: string; abweichend: VorlageFeld[] }>;
  automatik?: Merker<string, string, string>;
}

const FELDER = new Set<VorlageFeld>(["art", "bezeichnung", "ausnahme", "mengen"]);

/**
 * Zustand → Feld `vorlagen` für PUT Beschreibung; null ohne Vorlagen und ohne Automatik (Backend löscht dann den Eintrag).
 * Bei eingeschalteter Automatik reisen die Merker mit (E42), damit sie nach dem Wiederöffnen weiterwirkt.
 */
export function vorlagenZurEingabe(z: AssistentZustand, positionen: Positionen): VorlagenEingabe | null {
  if (z.vorlagen.length === 0 && !z.automatik) return null;
  const id = new Map(z.gebaeude.geschosse.filter((g) => g.id).map((g) => [g.code, g.id!]));
  const zuId = (codes: string[]) => codes.flatMap((c) => (id.has(c) ? [id.get(c)!] : []));
  const einheitVerweis = (s: string): EinheitVerweis[] => {
    const i = positionen.einheiten.indexOf(s);
    if (i < 0) return [];
    const e = z.einheiten.find((x) => x.schluessel === s);
    return [e?.id !== undefined ? { einheitId: e.id } : { einheitIndex: i }];
  };
  const zuordnung: VorlagenEingabe["zuordnung"] = [];
  for (const e of z.einheiten) {
    if (!e.vorlage) continue;
    for (const einheit of einheitVerweis(e.schluessel))
      zuordnung.push({ einheit, vorlage: e.vorlage.schluessel, platz: e.vorlage.platz, abweichend: [...(e.abweichend ?? [])] });
  }
  return {
    version: 1,
    vorlagen: z.vorlagen.map((v) => ({ schluessel: v.schluessel, name: v.name, plaetze: v.plaetze.map((p) => ({ ...p })), geschosse: zuId(v.geschosse),
      ausgelassen: v.ausgelassen.flatMap((o) => (id.has(o.geschoss) ? [{ geschoss: id.get(o.geschoss)!, platz: o.platz }] : [])) })),
    zuordnung,
    ...(z.automatik && { automatik: merkerZurEingabe(z, positionen, einheitVerweis, zuId) }),
  };
}

function merkerZurEingabe(z: AssistentZustand, positionen: Positionen, einheitVerweis: (s: string) => EinheitVerweis[], zuId: (codes: string[]) => string[]): NonNullable<VorlagenEingabe["automatik"]> {
  const bauteilVerweis = (s: string): BauteilVerweis[] => {
    const i = positionen.bauteile.indexOf(s);
    if (i < 0) return [];
    const t = z.bauteile.find((x) => x.schluessel === s);
    return [t?.id !== undefined ? { bauteilId: t.id } : { bauteilIndex: i }];
  };
  const gruppeVerweis = (g: ZGruppe): GruppeVerweis[] => {
    const i = positionen.gruppen.indexOf(g.schluessel);
    return i < 0 ? [] : [g.id !== undefined ? { gruppeId: g.id } : { gruppeIndex: i }];
  };
  return {
    fbhWmz: z.fbhWmz, gruppenVorgeschlagen: z.gruppenVorgeschlagen,
    fbhVerteilerAus: z.fbhVerteilerAus.flatMap(einheitVerweis),
    autoVerteiler: z.bauteile.filter((t) => t.auto && t.fbh).flatMap((t) => bauteilVerweis(t.schluessel)),
    gruppen: z.gruppen.filter((g) => g.regel || g.angefasst || g.vorgeschlagen).flatMap((g) => gruppeVerweis(g).map((gruppe) => {
      const einheit = g.regel?.einheit !== undefined ? einheitVerweis(g.regel.einheit)[0] : undefined;
      // Einheit-Regel ohne speicherbare Einheit würde zur Rest-Regel: dann ohne Regel speichern
      const regel = g.regel && (g.regel.einheit === undefined || einheit)
        ? { heizart: g.regel.heizart, ...(g.regel.geschosse && { geschosse: zuId(g.regel.geschosse) }), ...(einheit && { einheit }) } : undefined;
      return { gruppe, ...(regel && { regel }), ...(g.angefasst && { angefasst: true }), ...(g.vorgeschlagen && { vorgeschlagen: true }) };
    })),
  };
}

/**
 * Gespeicherte Vorlagen in einen aus der Beschreibung geladenen Zustand einlesen (Einheit-Schlüssel = ID).
 * Fehlende Geschosse, Einheiten, Plätze oder eine fremde Version werden verworfen und als «abgelöst» gemeldet.
 */
export function vorlagenEinlesen(z: AssistentZustand, daten: unknown): { zustand: AssistentZustand; abgeloest: boolean } {
  if (daten === null || daten === undefined) return { zustand: z, abgeloest: false };
  // Kaputte gespeicherte Daten dürfen das Laden nicht abbrechen
  try { return einlesen(z, daten); } catch { return { zustand: z, abgeloest: true }; }
}

function einlesen(z: AssistentZustand, daten: unknown): { zustand: AssistentZustand; abgeloest: boolean } {
  const d = daten as Partial<VorlagenGespeichert>;
  if (d.version !== 1 || !Array.isArray(d.vorlagen) || !d.zuordnung || typeof d.zuordnung !== "object") return { zustand: z, abgeloest: true };
  let abgeloest = false;
  const code = new Map(z.gebaeude.geschosse.filter((g) => g.id).map((g) => [g.id!, g.code]));
  const zuCode = (ids: string[]) => ids.flatMap((i) => { const c = code.get(i); if (!c) abgeloest = true; return c ? [c] : []; });
  const vorlagen: ZVorlage[] = d.vorlagen.map((v) => ({
    schluessel: v.schluessel, name: v.name, plaetze: v.plaetze.map((p) => ({ ...p, ausnahme: { ...p.ausnahme }, mengen: { ...p.mengen } })),
    geschosse: zuCode(v.geschosse),
    ausgelassen: v.ausgelassen.flatMap((o) => { const c = code.get(o.geschoss); return c ? [{ geschoss: c, platz: o.platz }] : []; }),
  }));
  const plaetze = new Map(vorlagen.map((v) => [v.schluessel, new Set(v.plaetze.map((p) => p.schluessel))]));
  const vorhanden = new Set(z.einheiten.map((e) => e.schluessel));
  for (const id of Object.keys(d.zuordnung)) if (!vorhanden.has(id)) abgeloest = true;
  const einheiten = z.einheiten.map((e) => {
    const x = d.zuordnung![e.schluessel];
    if (!x) return e;
    const v = vorlagen.find((y) => y.schluessel === x.vorlage);
    if (!plaetze.get(x.vorlage)?.has(x.platz) || !v?.geschosse.includes(e.geschoss)) { abgeloest = true; return e; }
    return { ...e, vorlage: { schluessel: x.vorlage, platz: x.platz }, abweichend: x.abweichend.filter((f) => FELDER.has(f)) };
  });
  return { zustand: merkerEinlesen({ ...z, vorlagen, einheiten }, d.automatik), abgeloest };
}

/** Automatik-Merker einlesen (E42): Automatik wieder an, FBH-Verteiler und Gruppenregeln wie vor dem Übernehmen. */
function merkerEinlesen(z: AssistentZustand, m: VorlagenGespeichert["automatik"]): AssistentZustand {
  if (!m || typeof m !== "object") return z;
  const code = new Map(z.gebaeude.geschosse.filter((g) => g.id).map((g) => [g.id!, g.code]));
  const einheiten = new Set(z.einheiten.map((e) => e.schluessel));
  const auto = new Set(m.autoVerteiler ?? []);
  const gruppen = new Map((m.gruppen ?? []).map((g) => [g.gruppe, g]));
  return {
    ...z, automatik: true, fbhWmz: m.fbhWmz === true, gruppenVorgeschlagen: m.gruppenVorgeschlagen === true || z.gruppen.length > 0,
    fbhVerteilerAus: (m.fbhVerteilerAus ?? []).filter((e) => einheiten.has(e)),
    bauteile: z.bauteile.map((t) => (auto.has(t.schluessel) && t.katalogId === K.verteiler ? { ...t, auto: true, fbh: true } : t)),
    gruppen: z.gruppen.map((g) => {
      const x = gruppen.get(g.schluessel);
      if (!x) return g;
      const regel = x.regel && (x.regel.einheit === undefined || einheiten.has(x.regel.einheit))
        ? { heizart: x.regel.heizart, ...(x.regel.geschosse && { geschosse: x.regel.geschosse.flatMap((i) => (code.has(i) ? [code.get(i)!] : [])) }), ...(x.regel.einheit !== undefined && { einheit: x.regel.einheit }) }
        : undefined;
      return { ...g, ...(regel && { regel }), ...(x.angefasst && { angefasst: true }), ...(x.vorgeschlagen && { vorgeschlagen: true }) };
    }),
  };
}
