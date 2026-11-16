import type { EinheitVerweis, HeizArt, Heizung } from "../typen";
import type { Positionen } from "./beschreibung";
import type { AssistentZustand, VorlageFeld, ZVorlage } from "./zustand";

/** Spiegel von app/src/welt/vorlage.ts (Geschosse als IDs). */
interface VorlageDaten { schluessel: string; name: string; plaetze: { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }
export interface VorlagenEingabe { version: 1; vorlagen: VorlageDaten[]; zuordnung: { einheit: EinheitVerweis; vorlage: string; platz: string; abweichend: VorlageFeld[] }[] }
export interface VorlagenGespeichert { version: 1; vorlagen: VorlageDaten[]; zuordnung: Record<string, { vorlage: string; platz: string; abweichend: VorlageFeld[] }> }

const FELDER = new Set<VorlageFeld>(["art", "bezeichnung", "ausnahme", "mengen"]);

/** Zustand → Feld `vorlagen` für PUT Beschreibung; null ohne Vorlagen (Backend löscht dann den Eintrag). */
export function vorlagenZurEingabe(z: AssistentZustand, positionen: Positionen): VorlagenEingabe | null {
  if (z.vorlagen.length === 0) return null;
  const id = new Map(z.gebaeude.geschosse.filter((g) => g.id).map((g) => [g.code, g.id!]));
  const zuId = (codes: string[]) => codes.flatMap((c) => (id.has(c) ? [id.get(c)!] : []));
  const zuordnung: VorlagenEingabe["zuordnung"] = [];
  for (const e of z.einheiten) {
    if (!e.vorlage) continue;
    const i = positionen.einheiten.indexOf(e.schluessel);
    if (i < 0) continue;
    zuordnung.push({ einheit: e.id !== undefined ? { einheitId: e.id } : { einheitIndex: i }, vorlage: e.vorlage.schluessel, platz: e.vorlage.platz, abweichend: [...(e.abweichend ?? [])] });
  }
  return {
    version: 1,
    vorlagen: z.vorlagen.map((v) => ({ schluessel: v.schluessel, name: v.name, plaetze: v.plaetze.map((p) => ({ ...p })), geschosse: zuId(v.geschosse),
      ausgelassen: v.ausgelassen.flatMap((o) => (id.has(o.geschoss) ? [{ geschoss: id.get(o.geschoss)!, platz: o.platz }] : [])) })),
    zuordnung,
  };
}

/**
 * Gespeicherte Vorlagen in einen aus der Beschreibung geladenen Zustand einlesen (Einheit-Schlüssel = ID).
 * Fehlende Geschosse, Einheiten, Plätze oder eine fremde Version werden verworfen und als «abgelöst» gemeldet.
 */
export function vorlagenEinlesen(z: AssistentZustand, daten: unknown): { zustand: AssistentZustand; abgeloest: boolean } {
  if (daten === null || daten === undefined) return { zustand: z, abgeloest: false };
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
  return { zustand: { ...z, vorlagen, einheiten }, abgeloest };
}
