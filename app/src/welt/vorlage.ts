import type pg from "pg";
import type { EinheitVerweis, HeizArt, Heizung } from "./typen.js";

export const VORLAGE_FELDER = ["art", "bezeichnung", "ausnahme", "mengen"] as const;
export type VorlageFeld = (typeof VORLAGE_FELDER)[number];

export interface PlatzDaten { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }
/** `geschosse` und `ausgelassen[].geschoss` sind Geschoss-IDs. */
export interface VorlageDaten { schluessel: string; name: string; plaetze: PlatzDaten[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }
export interface VorlagenEingabe {
  version: 1; vorlagen: VorlageDaten[];
  zuordnung: { einheit: EinheitVerweis; vorlage: string; platz: string; abweichend: VorlageFeld[] }[];
}
export interface VorlagenGespeichert {
  version: 1; vorlagen: VorlageDaten[];
  zuordnung: Record<string, { vorlage: string; platz: string; abweichend: VorlageFeld[] }>;
}

export async function ladeVorlagen(c: pg.ClientBase, gebaeudeId: string): Promise<VorlagenGespeichert | null> {
  const r = (await c.query("select daten from geschoss_vorlage where gebaeude_id=$1", [gebaeudeId])).rows[0];
  return r ? r.daten : null;
}

/**
 * Schreibt die Vorlagen in der Transaktion des Aufrufers (nach schreibeBeschreibung).
 * Index-Verweise zeigen auf Positionen der eben geschriebenen Beschreibung (`einheitIds`).
 * Unbekannte Einheiten, Geschosse, Vorlagen und Plaetze werden still verworfen: Uebernehmen scheitert nie an Vorlagen.
 * Ohne Eingabe oder ohne Vorlagen wird ein bestehender Eintrag geloescht.
 */
export async function schreibeVorlagen(c: pg.ClientBase, gebaeudeId: string, eingabe: VorlagenEingabe | undefined, einheitIds: string[]): Promise<number> {
  if (!eingabe || eingabe.vorlagen.length === 0) {
    await c.query("delete from geschoss_vorlage where gebaeude_id=$1", [gebaeudeId]);
    return 0;
  }
  const g = (await c.query("select liegenschaft_id from gebaeude where id=$1", [gebaeudeId])).rows[0];
  if (!g) throw new Error("Gebaeude unbekannt");
  const geschosse = new Set<string>((await c.query("select id from geschoss where gebaeude_id=$1", [gebaeudeId])).rows.map((r) => r.id));
  const einheiten = new Set(einheitIds);
  const vorlagen = eingabe.vorlagen.map((v) => {
    const plaetze = new Set(v.plaetze.map((p) => p.schluessel));
    return { ...v, geschosse: v.geschosse.filter((x) => geschosse.has(x)),
      ausgelassen: v.ausgelassen.filter((x) => geschosse.has(x.geschoss) && plaetze.has(x.platz)) };
  });
  const platzVon = new Map(vorlagen.map((v) => [v.schluessel, new Set(v.plaetze.map((p) => p.schluessel))]));
  const zuordnung: VorlagenGespeichert["zuordnung"] = {};
  for (const z of eingabe.zuordnung) {
    const id = z.einheit.einheitId ?? (z.einheit.einheitIndex !== undefined ? einheitIds[z.einheit.einheitIndex] : undefined);
    if (!id || !einheiten.has(id) || !platzVon.get(z.vorlage)?.has(z.platz)) continue;
    zuordnung[id] = { vorlage: z.vorlage, platz: z.platz, abweichend: [...z.abweichend] };
  }
  const daten: VorlagenGespeichert = { version: 1, vorlagen, zuordnung };
  await c.query(
    `insert into geschoss_vorlage(gebaeude_id, liegenschaft_id, daten) values ($1,$2,$3)
     on conflict (gebaeude_id) do update set daten=excluded.daten, geaendert_am=now()`,
    [gebaeudeId, g.liegenschaft_id, JSON.stringify(daten)]);
  return vorlagen.length;
}
