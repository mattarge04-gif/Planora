import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";
import { ladeLebensdauer, schreibeLebensdauer } from "../src/lebensdauer/speicher.js";
import { ladeBeschreibung, schreibeBeschreibung, legeGebaeudeAn } from "../src/welt/speicher.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { regelwerkFuer } from "../src/welt/regelwerk.wahl.js";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let L: string, G: string, ids: string[];
const S = 2026;

beforeAll(async () => {
  db = await frischeDb();
  L = (await db.pool.query("insert into liegenschaft(name) values ('L') returning id")).rows[0].id;
  const c = await db.pool.connect();
  try {
    G = await legeGebaeudeAn(c, L, { name: "H", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }] } as any, REGELWERK_V1);
    const leer = (await ladeBeschreibung(c, G))!;
    await schreibeBeschreibung(c, G, { ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
      einheiten: [{ geschossId: leer.geschosse![0].id, bezeichnung: "Technik", art: "technik", flaecheM2: null }],
      bauteile: [
        { katalogId: "heizung.verteiler", standort: { einheitIndex: 0 }, menge: 1, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 10, status: "bestaetigt", versorgt: [] },
      ] } as any, regelwerkFuer(1), KATALOG_V1);
    ids = (await ladeBeschreibung(c, G))!.bauteile.map((b) => b.id!);
  } finally { c.release(); }
});
afterAll(async () => { await db.ende(); });

const mit = <T>(f: (c: any) => Promise<T>) => db.pool.connect().then(async (c) => { try { return await f(c); } finally { c.release(); } });

describe("Lebensdauer-Speicher", () => {
  it("laedt ohne Kundenwerte: grau, Typen mit Standard", async () => {
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.heizungBaujahr).toBeNull();
    expect(s.ergebnis.zaehler.grau).toBe(2);
    expect(s.typen.map((t) => t.katalogId).sort()).toEqual(["heizung.heizkoerper", "heizung.verteiler"]);
    expect(s.typen.find((t) => t.katalogId === "heizung.verteiler")).toMatchObject({ lMittel: null, standard: 30, stueckpreis: null });
    expect(s.bauteile[0].ort).toBe("EG · Technik");
  });
  it("unbekanntes Gebaeude -> null", async () => {
    expect(await mit((c) => ladeLebensdauer(c, "00000000-0000-4000-8000-000000000999", S))).toBeNull();
  });
  it("schreibt Standard, Akte, Typ; Baujahr erhoeht den Stand", async () => {
    const vor = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    const r = await mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand, heizungBaujahr: 2008,
      bauteile: [{ id: ids[0], zustand: "schlecht", stueckpreis: 2500, notiz: "undicht" }],
      typen: [{ katalogId: "heizung.heizkoerper", stueckpreis: 800 }] }));
    expect(r).toEqual({ bauteile: 1, typen: 1, baujahrGeaendert: true });
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.stand).toBe(vor.stand + 1);
    expect(s.bauteile[0].akte).toMatchObject({ zustand: "schlecht", stueckpreis: 2500, quellePreis: "kunde", notiz: "undicht" });
    expect(s.ergebnis.bauteile[0]).toMatchObject({ ersatzjahr: 2033, kosten: 2500 });      // 2008+30-5
    expect(s.ergebnis.bauteile[1]).toMatchObject({ ersatzjahr: 2048, kosten: 8000, quellen: { preis: "typ" } });
  });
  it("ohne Baujahraenderung bleibt der Stand; null loescht", async () => {
    const vor = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    await mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand, bauteile: [{ id: ids[0], zustand: null, stueckpreis: null, notiz: null }] }));
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.stand).toBe(vor.stand);
    expect(s.bauteile[0].akte).toBeNull();
    expect((await db.pool.query("select count(*)::int n from bauteil_akte")).rows[0].n).toBe(0);
  });
  it("veralteter Stand -> 409, fremde Bauteil-ID -> 400", async () => {
    const vor = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    await expect(mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand - 1 }))).rejects.toMatchObject({ status: 409 });
    await expect(mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand, bauteile: [{ id: "00000000-0000-4000-8000-000000000999", zustand: "gut" }] })))
      .rejects.toMatchObject({ status: 400 });
  });
  it("Akte ueberlebt erneutes Uebernehmen der Beschreibung mit gleichen IDs", async () => {
    const vor = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    await mit((c) => schreibeLebensdauer(c, G, { stand: vor.stand, bauteile: [{ id: ids[1], zustand: "mittel" }] }));
    await mit(async (c) => { const b = (await ladeBeschreibung(c, G))!; await schreibeBeschreibung(c, G, b, regelwerkFuer(1), KATALOG_V1); });
    const s = (await mit((c) => ladeLebensdauer(c, G, S)))!;
    expect(s.bauteile.find((b) => b.id === ids[1])!.akte?.zustand).toBe("mittel");
  });
});
