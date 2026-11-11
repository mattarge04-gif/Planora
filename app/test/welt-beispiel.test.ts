import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";
import { beispielAnlegen } from "../src/welt/beispiel.js";
import { ladeBeschreibung, ladeHuelle } from "../src/welt/speicher.js";
import { weltErzeugen } from "../src/welt/generator.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
beforeAll(async () => { db = await frischeDb(); });
afterAll(async () => { await db.ende(); });

describe("Beispieldaten erster Schnitt (ADR 0032)", () => {
  it("zwei Geschosse, gemischte Heizung, gemeinsamer Verteiler, Vorschlag fuer Buero D", async () => {
    const { gebaeudeId } = await beispielAnlegen(db.pool);
    const c = await db.pool.connect();
    try {
      const h = (await ladeHuelle(c, gebaeudeId))!;
      const b = (await ladeBeschreibung(c, gebaeudeId))!;
      expect(b.einheiten.map((e) => e.bezeichnung)).toEqual(["Buero A", "Restaurant", "Technik", "Buero C", "Buero D"]);
      expect(b.einheiten[1].heizungWirksam).toEqual({ hk: "nein", fbh: "ja", tabs: "nein" });
      expect(b.einheiten[3].heizungWirksam).toEqual({ hk: "ja", fbh: "ja", tabs: "nein" });
      expect(b.hinweise).toEqual([{ code: "verteiler_vorschlag", bezug: b.einheiten[4].id }]);
      const w = weltErzeugen(h, b, REGELWERK_V1);
      expect(w.geschosse.map((g) => g.code)).toEqual(["EG", "OG1"]);
      expect(w.symbole.filter((s) => s.katalogId === "heizung.heizkoerper").map((s) => s.hersteller)).toEqual(["Zehnder", "Prolux"]);
      const v = w.symbole.find((s) => s.katalogId === "heizung.verteiler")!;
      expect(v.versorgt).toEqual([b.einheiten[1].id, b.einheiten[3].id]);
      expect(w.symbole.filter((s) => s.mengeUnbekannt)).toHaveLength(1);
      expect(weltErzeugen(h, b, REGELWERK_V1).hash).toBe(w.hash);
    } finally { c.release(); }
  });
});
