import type pg from "pg";
import { FachFehler } from "./speicher.js";
import type { Beschreibung } from "./typen.js";

export interface EntwurfGespeichert { stand: number; daten: unknown }

export async function ladeEntwurf(c: pg.ClientBase, gebaeudeId: string): Promise<EntwurfGespeichert | null> {
  const r = (await c.query("select stand, daten from entwurf where gebaeude_id=$1", [gebaeudeId])).rows[0];
  return r ? { stand: r.stand, daten: r.daten } : null;
}

/** Upsert. Neu: stand 1. Vorhanden: nur wenn der Stand des Aufrufers dem gespeicherten entspricht (sonst 409). */
export async function speichereEntwurf(c: pg.ClientBase, gebaeudeId: string, stand: number, daten: unknown): Promise<number> {
  const g = (await c.query("select liegenschaft_id from gebaeude where id=$1 for update", [gebaeudeId])).rows[0];
  if (!g) throw new Error("Gebaeude unbekannt");
  const alt = (await c.query("select stand from entwurf where gebaeude_id=$1", [gebaeudeId])).rows[0];
  if (!alt) {
    await c.query("insert into entwurf(gebaeude_id, liegenschaft_id, stand, daten) values ($1,$2,1,$3)", [gebaeudeId, g.liegenschaft_id, JSON.stringify(daten)]);
    return 1;
  }
  if (alt.stand !== stand) throw new FachFehler([{ pfad: "stand", code: "stand_veraltet", meldung: "Entwurf wurde inzwischen geaendert; bitte neu laden" }], 409);
  await c.query("update entwurf set stand=stand+1, daten=$2, geaendert_am=now() where gebaeude_id=$1", [gebaeudeId, JSON.stringify(daten)]);
  return alt.stand + 1;
}

export async function loescheEntwurf(c: pg.ClientBase, gebaeudeId: string): Promise<void> {
  await c.query("delete from entwurf where gebaeude_id=$1", [gebaeudeId]);
}

/**
 * Vergibt fuer Elemente ohne `id` deterministische Platzhalter (`neu-e-<index>`, `neu-b-<index>`, `neu-g-<index>`)
 * und loest Index-Verweise zu IDs auf. Nur fuer die Vorschau; setzt eine bestandene pruefeBeschreibung voraus.
 */
export function mitPlatzhalterIds(b: Beschreibung): Beschreibung {
  const eId = (i: number) => b.einheiten[i].id ?? `neu-e-${i}`;
  const bId = (i: number) => b.bauteile[i].id ?? `neu-b-${i}`;
  const gId = (i: number) => (b.gruppen ?? [])[i].id ?? `neu-g-${i}`;
  const einheitV = (v: { einheitId?: string; einheitIndex?: number }) => ({ einheitId: v.einheitId ?? eId(v.einheitIndex!) });
  const bauteilV = (v: { bauteilId?: string; bauteilIndex?: number }) => ({ bauteilId: v.bauteilId ?? bId(v.bauteilIndex!) });
  const gruppeV = (v: { gruppeId?: string; gruppeIndex?: number }) => ({ gruppeId: v.gruppeId ?? gId(v.gruppeIndex!) });
  return {
    ...b,
    einheiten: b.einheiten.map((e, i) => ({ ...e, id: eId(i) })),
    bauteile: b.bauteile.map((t, j) => {
      const { ort, ...rest } = t;
      return {
        ...rest, id: bId(j),
        standort: t.standort.geschossId !== undefined ? { geschossId: t.standort.geschossId } : einheitV(t.standort),
        versorgt: t.versorgt.map(einheitV),
        ...(ort && { ort: "gruppe" in ort ? { gruppe: gruppeV(ort.gruppe) } : { vorBauteil: bauteilV(ort.vorBauteil) } }),
      };
    }),
    ...(b.gruppen && { gruppen: b.gruppen.map((g, i) => ({ ...g, id: gId(i), verteiler: bauteilV(g.verteiler), verbraucher: g.verbraucher.map(bauteilV) })) }),
  };
}
