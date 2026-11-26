import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { frischeDb } from "./hilfe.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let L: string, G: string, GS: string, E: string, D: string;
const q = (sql: string, p: unknown[] = []) => db.pool.query(sql, p);
const abschnitt = (p: Record<string, unknown> = {}) => {
  const w: Record<string, unknown> = { ort_art: "seite", ort: 1, text: "Wärmepumpe Heizleistung 12.4 kW", ...p };
  return q(`insert into dokument_abschnitt(dokument_id, nr, ${Object.keys(w).join(", ")})
    values ($1, (select coalesce(max(nr) + 1, 0) from dokument_abschnitt where dokument_id=$1), ${Object.keys(w).map((_, i) => `$${i + 2}`).join(", ")}) returning *`,
    [D, ...Object.values(w)]);
};

beforeAll(async () => {
  db = await frischeDb();
  L = (await q("insert into liegenschaft(name) values ('L') returning id")).rows[0].id;
  G = (await q("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,'G','quader',30,15,1) returning id", [L])).rows[0].id;
  GS = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3.2) returning id", [L, G])).rows[0].id;
  E = (await q("insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, reihenfolge) values ($1,$2,'Technik','technik',0) returning id", [L, GS])).rows[0].id;
  D = (await q(`insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von)
    values ($1,$2,'a.pdf','k','s',10,1,$3) returning id`, [G, L, randomUUID()])).rows[0].id;
});
afterAll(async () => { await db.ende(); });

describe("Migration 019 Suche", () => {
  it("Extensions pg_trgm und unaccent", async () => {
    const r = (await q("select extname from pg_extension where extname in ('pg_trgm','unaccent') order by 1")).rows.map((x) => x.extname);
    expect(r).toEqual(["pg_trgm", "unaccent"]);
  });
  it("dokument: Startwerte text_status offen, kein Ort", async () => {
    expect((await q("select text_status, text_grund, ort_geschoss_id, ort_einheit_id, allgemein from dokument where id=$1", [D])).rows[0])
      .toEqual({ text_status: "offen", text_grund: null, ort_geschoss_id: null, ort_einheit_id: null, allgemein: false });
    await expect(q("update dokument set text_status='kaputt' where id=$1", [D])).rejects.toThrow(/check/);
    await expect(q("update dokument set text_grund=$2 where id=$1", [D, "x".repeat(301)])).rejects.toThrow(/check/);
  });
  it("hoechstens ein Ort; Geschoss geloescht -> Ort leer", async () => {
    await expect(q("update dokument set ort_geschoss_id=$2, allgemein=true where id=$1", [D, GS])).rejects.toThrow(/check/);
    await expect(q("update dokument set ort_geschoss_id=$2, ort_einheit_id=$3 where id=$1", [D, GS, E])).rejects.toThrow(/check/);
    await q("update dokument set ort_einheit_id=$2 where id=$1", [D, E]);
    await q("delete from geschoss where id=$1", [GS]); // cascade auf einheit, dokument.ort_* -> null
    expect((await q("select ort_geschoss_id, ort_einheit_id from dokument where id=$1", [D])).rows[0]).toEqual({ ort_geschoss_id: null, ort_einheit_id: null });
  });
  it("Abschnitt: tsv generiert mit unaccent, Trigramm ohne Umlaut", async () => {
    const a = (await abschnitt()).rows[0];
    expect((await q("select tsv @@ websearch_to_tsquery('german', planora_unaccent('warmepumpe')) ok from dokument_abschnitt where id=$1", [a.id])).rows[0].ok).toBe(true);
    expect((await q("select planora_unaccent('WÄRMEPUNPE') <% planora_unaccent(text) ok from dokument_abschnitt where id=$1", [a.id])).rows[0].ok).toBe(true);
  });
  it("Abschnitt: Pruefungen", async () => {
    await expect(abschnitt({ ort_art: "kapitel" })).rejects.toThrow(/check/);
    await expect(abschnitt({ vektor: [0.1, 0.2] })).rejects.toThrow(/check/); // vektor ohne modell
    await expect(abschnitt({ vektor: [0.1, 0.2], modell: "m" })).resolves.toBeDefined();
    await expect(abschnitt({ text: "" })).rejects.toThrow(/check/);
  });
  it("Abschnitte fallen mit dem Dokument weg", async () => {
    const d = (await q(`insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von)
      values ($1,$2,'b.pdf','k','t',10,1,$3) returning id`, [G, L, randomUUID()])).rows[0].id;
    await q("insert into dokument_abschnitt(dokument_id, nr, ort_art, ort, text) values ($1,0,'name',0,'b')", [d]);
    await q("delete from dokument where id=$1", [d]);
    expect((await q("select 1 from dokument_abschnitt where dokument_id=$1", [d])).rowCount).toBe(0);
  });
  it("preis_lesung.zweck: Standard preis, nur bekannte Zwecke", async () => {
    expect((await q("insert into preis_lesung(modell, tokens_ein, tokens_aus, kosten_usd) values ('m',1,1,0) returning zweck")).rows[0].zweck).toBe("preis");
    await expect(q("insert into preis_lesung(modell, tokens_ein, tokens_aus, kosten_usd, zweck) values ('m',1,1,0,'x')")).rejects.toThrow(/check/);
  });
  it("planora_app darf Abschnitte lesen, schreiben, aendern, loeschen", async () => {
    expect((await q("select has_table_privilege('planora_app', 'dokument_abschnitt', 'select,insert,update,delete') ok")).rows[0].ok).toBe(true);
  });
});
