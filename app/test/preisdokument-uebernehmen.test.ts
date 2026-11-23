import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { frischeDb } from "./hilfe.js";
import { ladeLebensdauer, schreibeLebensdauer } from "../src/lebensdauer/speicher.js";
import { uebernimm, verwirf, uebernimmAlleSicheren } from "../src/preisdokument/speicher.js";
import { loescheDokument } from "../src/preisdokument/speicher.js";
import { ladeBeschreibung, schreibeBeschreibung, legeGebaeudeAn } from "../src/welt/speicher.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { regelwerkFuer } from "../src/welt/regelwerk.wahl.js";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let L: string, G: string, pumpen: string[], hk: string, U: string, DOK: string;
const S = 2026;
const mit = <T>(f: (c: any) => Promise<T>) => db.pool.connect().then(async (c) => { try { return await f(c); } finally { c.release(); } });
const stand = async () => (await db.pool.query("select stand from gebaeude where id=$1", [G])).rows[0].stand as number;

async function vorschlag(katalogId: string | null, bauteilIds: string[], sicherheit = "hoch", preis = 1296, reihenfolge = 0) {
  const id = randomUUID();
  await db.pool.query(`insert into preis_vorschlag(id, dokument_id, reihenfolge, position, seite, zitat, ersatzpreis, rechenweg, katalog_id, bauteil_ids, sicherheit)
    values ($1,$2,$3,'Pumpe',1,'z',$4,'r',$5,$6,$7)`, [id, DOK, reihenfolge, preis, katalogId, bauteilIds, sicherheit]);
  return id;
}
const args = (vorschlagId: string, bauteilIds: string[], extra: object = {}) =>
  async () => ({ vorschlagId, gebaeudeId: G, bauteilIds, alsTyppreis: false, stand: await stand(), ueberschreibeHandeingabe: false, von: U, ...extra });
const status = async (id: string) => (await db.pool.query("select status from preis_vorschlag where id=$1", [id])).rows[0].status;

beforeAll(async () => {
  db = await frischeDb();
  L = (await db.pool.query("insert into liegenschaft(name) values ('L') returning id")).rows[0].id;
  U = randomUUID();
  const c = await db.pool.connect();
  try {
    G = await legeGebaeudeAn(c, L, { name: "H", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }] } as any, REGELWERK_V1);
    const leer = (await ladeBeschreibung(c, G))!;
    await schreibeBeschreibung(c, G, { ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
      einheiten: [{ geschossId: leer.geschosse![0].id, bezeichnung: "Technik", art: "technik", flaecheM2: null }],
      bauteile: [
        { katalogId: "heizung.umwaelzpumpe", standort: { einheitIndex: 0 }, menge: 1, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.umwaelzpumpe", standort: { einheitIndex: 0 }, menge: 1, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 10, status: "bestaetigt", versorgt: [] },
      ] } as any, regelwerkFuer(1), KATALOG_V1);
    const b = (await ladeBeschreibung(c, G))!.bauteile;
    pumpen = b.filter((x) => x.katalogId === "heizung.umwaelzpumpe").map((x) => x.id!);
    hk = b.find((x) => x.katalogId === "heizung.heizkoerper")!.id!;
  } finally { c.release(); }
});
afterAll(async () => { await db.ende(); });

beforeEach(async () => {
  await db.pool.query("delete from bauteil_akte");
  await db.pool.query("delete from lebensdauer_typ");
  await db.pool.query("delete from dokument");
  DOK = randomUUID();
  await db.pool.query(`insert into dokument(id, gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status)
    values ($1,$2,$3,'o1.pdf','k',$4,10,3,$5,'fertig')`, [DOK, G, L, randomUUID(), U]);
});

describe("Preis uebernehmen", () => {
  it("uebernimmt auf ein Bauteil mit Fundstelle", async () => {
    const v = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]]);
    expect(await mit(async (c) => uebernimm(c, await args(v, [pumpen[0]])()))).toEqual({ bauteile: 1, typ: false });
    const a = (await db.pool.query("select stueckpreis, quelle_preis, preis_vorschlag_id from bauteil_akte where bauteil_id=$1", [pumpen[0]])).rows[0];
    expect(a).toMatchObject({ stueckpreis: "1296.00", quelle_preis: "dokument", preis_vorschlag_id: v });
    expect(await status(v)).toBe("uebernommen");
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.bauteile.find((b) => b.id === pumpen[0])!.akte!.preisQuelle).toEqual({ dokumentId: DOK, dateiname: "o1.pdf", seite: 1 });
  });
  it("alsTyppreis setzt zusaetzlich den Typpreis", async () => {
    const v = await vorschlag("heizung.umwaelzpumpe", pumpen);
    await mit(async (c) => uebernimm(c, await args(v, [pumpen[0]], { alsTyppreis: true })()));
    const t = (await db.pool.query("select stueckpreis, quelle_preis, preis_vorschlag_id from lebensdauer_typ where katalog_id='heizung.umwaelzpumpe'")).rows[0];
    expect(t).toMatchObject({ stueckpreis: "1296.00", quelle_preis: "dokument", preis_vorschlag_id: v });
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.typen.find((x) => x.katalogId === "heizung.umwaelzpumpe")!.preisQuelle).toEqual({ dokumentId: DOK, dateiname: "o1.pdf", seite: 1 });
  });
  it("Handeingabe -> 409 handeingabe, mit Bestaetigung ueberschrieben", async () => {
    await db.pool.query("insert into bauteil_akte(bauteil_id, liegenschaft_id, stueckpreis, quelle_preis) values ($1,$2,500,'kunde')", [pumpen[0], L]);
    const v = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]]);
    await expect(mit(async (c) => uebernimm(c, await args(v, [pumpen[0]])()))).rejects.toMatchObject({ status: 409, fehler: [{ code: "handeingabe" }] });
    await mit(async (c) => uebernimm(c, await args(v, [pumpen[0]], { ueberschreibeHandeingabe: true })()));
    expect((await db.pool.query("select quelle_preis from bauteil_akte where bauteil_id=$1", [pumpen[0]])).rows[0].quelle_preis).toBe("dokument");
  });
  it("falscher Stand -> 409; Heizkoerper bei Pumpen-Vorschlag -> 400", async () => {
    const v = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]]);
    await expect(mit(async (c) => uebernimm(c, await args(v, [pumpen[0]], { stand: (await stand()) + 1 })()))).rejects.toMatchObject({ status: 409, fehler: [{ code: "stand_veraltet" }] });
    await expect(mit(async (c) => uebernimm(c, await args(v, [hk])()))).rejects.toMatchObject({ status: 400, fehler: [{ code: "bauteil_unpassend" }] });
  });
  it("verwerfen; danach uebernehmen -> 409 nicht_offen", async () => {
    const v = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]]);
    await mit((c) => verwirf(c, v, G, U));
    expect(await status(v)).toBe("verworfen");
    await expect(mit(async (c) => uebernimm(c, await args(v, [pumpen[0]])()))).rejects.toMatchObject({ status: 409, fehler: [{ code: "nicht_offen" }] });
    await expect(mit((c) => verwirf(c, v, G, U))).rejects.toMatchObject({ status: 409 });
  });
  it("alle sicheren: Kollision mit Handeingabe wird uebersprungen, mittel bleibt offen", async () => {
    await db.pool.query("insert into bauteil_akte(bauteil_id, liegenschaft_id, stueckpreis, quelle_preis) values ($1,$2,500,'kunde')", [pumpen[1], L]);
    const v1 = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]], "hoch", 1000, 0);
    const v2 = await vorschlag("heizung.umwaelzpumpe", [pumpen[1]], "hoch", 1100, 1);
    const v3 = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]], "mittel", 900, 2);
    expect(await mit(async (c) => { await c.query("begin"); const r = await uebernimmAlleSicheren(c, G, await stand(), U); await c.query("commit"); return r; })).toEqual({ uebernommen: 1, uebersprungen: 1 });
    expect([await status(v1), await status(v2), await status(v3)]).toEqual(["uebernommen", "offen", "offen"]);
  });
  it("Typpreis gegen Handeingabe am Typ -> 409 handeingabe", async () => {
    await db.pool.query("insert into lebensdauer_typ(liegenschaft_id, katalog_id, stueckpreis, quelle_preis) values ($1,'heizung.umwaelzpumpe',700,'kunde')", [L]);
    const v = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]]);
    await expect(mit(async (c) => uebernimm(c, await args(v, [pumpen[0]], { alsTyppreis: true })()))).rejects.toMatchObject({ status: 409, fehler: [{ code: "handeingabe" }] });
  });
  it("alle sicheren: veralteter Stand -> 409 auch ohne Kandidaten; verwerfen fremdes Gebaeude -> 409", async () => {
    await expect(mit(async (c) => { await c.query("begin"); try { return await uebernimmAlleSicheren(c, G, (await stand()) + 1, U); } finally { await c.query("rollback"); } }))
      .rejects.toMatchObject({ status: 409, fehler: [{ code: "stand_veraltet" }] });
    const v = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]]);
    await expect(mit((c) => verwirf(c, v, randomUUID(), U))).rejects.toMatchObject({ status: 409 });
    expect(await status(v)).toBe("offen");
  });
  it("Handeingabe nach Uebernahme -> Quelle kunde, Verweis weg", async () => {
    const v = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]]);
    await mit(async (c) => uebernimm(c, await args(v, [pumpen[0]])()));
    await mit(async (c) => schreibeLebensdauer(c, G, { stand: await stand(), bauteile: [{ id: pumpen[0], stueckpreis: 1500 }] }));
    const a = (await db.pool.query("select quelle_preis, preis_vorschlag_id from bauteil_akte where bauteil_id=$1", [pumpen[0]])).rows[0];
    expect(a).toEqual({ quelle_preis: "kunde", preis_vorschlag_id: null });
  });
  it("Dokument loeschen -> Preis und Quelle bleiben, Fundstelle leer", async () => {
    const v = await vorschlag("heizung.umwaelzpumpe", [pumpen[0]]);
    await mit(async (c) => uebernimm(c, await args(v, [pumpen[0]])()));
    await mit((c) => loescheDokument(c, DOK));
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.bauteile.find((b) => b.id === pumpen[0])!.akte).toMatchObject({ stueckpreis: 1296, quellePreis: "dokument", preisQuelle: { dokumentId: null, dateiname: null, seite: null } });
  });
});
