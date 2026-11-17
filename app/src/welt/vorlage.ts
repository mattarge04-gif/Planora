import type pg from "pg";
import type { BauteilVerweis, EinheitVerweis, GruppeVerweis, HeizArt, Heizung } from "./typen.js";

export const VORLAGE_FELDER = ["art", "bezeichnung", "ausnahme", "mengen"] as const;
export type VorlageFeld = (typeof VORLAGE_FELDER)[number];

export interface PlatzDaten { schluessel: string; art: string; ausnahme: Partial<Heizung>; mengen: Partial<Record<HeizArt, number>> }
/** `geschosse` und `ausgelassen[].geschoss` sind Geschoss-IDs. */
export interface VorlageDaten { schluessel: string; name: string; plaetze: PlatzDaten[]; geschosse: string[]; ausgelassen: { geschoss: string; platz: string }[] }
/** Merker der Assistent-Automatik (E42): FBH-Verteiler und Gruppenregeln ueber das Uebernehmen hinaus. */
export interface AutomatikEingabe {
  fbhWmz: boolean; gruppenVorgeschlagen: boolean;
  fbhVerteilerAus: EinheitVerweis[]; autoVerteiler: BauteilVerweis[];
  gruppen: { gruppe: GruppeVerweis; regel?: { heizart: HeizArt; geschosse?: string[]; einheit?: EinheitVerweis }; angefasst?: boolean; vorgeschlagen?: boolean }[];
}
/** Gespeichert: alle Verweise als IDs. */
export interface AutomatikGespeichert {
  fbhWmz: boolean; gruppenVorgeschlagen: boolean;
  fbhVerteilerAus: string[]; autoVerteiler: string[];
  gruppen: { gruppe: string; regel?: { heizart: HeizArt; geschosse?: string[]; einheit?: string }; angefasst?: boolean; vorgeschlagen?: boolean }[];
}
export interface VorlagenEingabe {
  version: 1; vorlagen: VorlageDaten[];
  zuordnung: { einheit: EinheitVerweis; vorlage: string; platz: string; abweichend: VorlageFeld[] }[];
  automatik?: AutomatikEingabe;
}
export interface VorlagenGespeichert {
  version: 1; vorlagen: VorlageDaten[];
  zuordnung: Record<string, { vorlage: string; platz: string; abweichend: VorlageFeld[] }>;
  automatik?: AutomatikGespeichert;
}
/** IDs der eben geschriebenen Beschreibung in Positionsreihenfolge (Aufloesung von Index-Verweisen). */
export interface GeschriebeneIds { einheitIds: string[]; bauteilIds: string[]; gruppeIds: string[] }

export async function ladeVorlagen(c: pg.ClientBase, gebaeudeId: string): Promise<VorlagenGespeichert | null> {
  const r = (await c.query("select daten from geschoss_vorlage where gebaeude_id=$1", [gebaeudeId])).rows[0];
  return r ? r.daten : null;
}

/**
 * Schreibt die Vorlagen in der Transaktion des Aufrufers (nach schreibeBeschreibung).
 * Index-Verweise zeigen auf Positionen der eben geschriebenen Beschreibung (`einheitIds`).
 * Unbekannte Einheiten, Geschosse, Vorlagen und Plaetze werden still verworfen: Uebernehmen scheitert nie an Vorlagen.
 * Ohne Eingabe oder ohne Vorlagen und ohne Automatik-Merker wird ein bestehender Eintrag geloescht.
 */
export async function schreibeVorlagen(c: pg.ClientBase, gebaeudeId: string, eingabe: VorlagenEingabe | undefined, ids: GeschriebeneIds): Promise<number> {
  const { einheitIds } = ids;
  if (!eingabe || (eingabe.vorlagen.length === 0 && !eingabe.automatik)) {
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
  const daten: VorlagenGespeichert = { version: 1, vorlagen, zuordnung,
    ...(eingabe.automatik && { automatik: automatikAufloesen(eingabe.automatik, ids, geschosse) }) };
  await c.query(
    `insert into geschoss_vorlage(gebaeude_id, liegenschaft_id, daten) values ($1,$2,$3)
     on conflict (gebaeude_id) do update set daten=excluded.daten, geaendert_am=now()`,
    [gebaeudeId, g.liegenschaft_id, JSON.stringify(daten)]);
  return vorlagen.length;
}

/** Verweise der Automatik-Merker in IDs aufloesen; Unbekanntes still verwerfen. */
function automatikAufloesen(a: AutomatikEingabe, ids: GeschriebeneIds, geschosse: Set<string>): AutomatikGespeichert {
  const einheiten = new Set(ids.einheitIds), bauteile = new Set(ids.bauteilIds), gruppen = new Set(ids.gruppeIds);
  const nurBekannt = (id: string | undefined, set: Set<string>) => (id !== undefined && set.has(id) ? [id] : []);
  const einheit = (v: EinheitVerweis) => nurBekannt(v.einheitId ?? (v.einheitIndex !== undefined ? ids.einheitIds[v.einheitIndex] : undefined), einheiten);
  const bauteil = (v: BauteilVerweis) => nurBekannt(v.bauteilId ?? (v.bauteilIndex !== undefined ? ids.bauteilIds[v.bauteilIndex] : undefined), bauteile);
  const gruppe = (v: GruppeVerweis) => nurBekannt(v.gruppeId ?? (v.gruppeIndex !== undefined ? ids.gruppeIds[v.gruppeIndex] : undefined), gruppen);
  return {
    fbhWmz: a.fbhWmz, gruppenVorgeschlagen: a.gruppenVorgeschlagen,
    fbhVerteilerAus: [...new Set(a.fbhVerteilerAus.flatMap(einheit))],
    autoVerteiler: [...new Set(a.autoVerteiler.flatMap(bauteil))],
    gruppen: a.gruppen.flatMap((g) => gruppe(g.gruppe).map((id) => {
      let regel: AutomatikGespeichert["gruppen"][number]["regel"];
      if (g.regel) {
        const e = g.regel.einheit ? einheit(g.regel.einheit) : [];
        // Einheit-Regel ohne bekannte Einheit waere sonst eine Rest-Regel: dann verwerfen
        if (!g.regel.einheit || e.length > 0)
          regel = { heizart: g.regel.heizart, ...(g.regel.geschosse && { geschosse: g.regel.geschosse.filter((x) => geschosse.has(x)) }), ...(e.length > 0 && { einheit: e[0] }) };
      }
      return { gruppe: id, ...(regel && { regel }), ...(g.angefasst && { angefasst: true }), ...(g.vorgeschlagen && { vorgeschlagen: true }) };
    })),
  };
}
