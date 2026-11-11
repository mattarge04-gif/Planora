import type pg from "pg";
import { REGELWERK_V1 } from "./regelwerk.v1.js";
import { KATALOG_V1 } from "./katalog.v1.js";
import { ladeHuelle, legeGebaeudeAn, schreibeBeschreibung } from "./speicher.js";
import type { Beschreibung } from "./typen.js";

/** Erster durchgehender Schnitt nach ADR 0032 / Spec §9. Nur fuer Entwicklung und Tests. */
export async function beispielAnlegen(pool: pg.Pool): Promise<{ liegenschaftId: string; gebaeudeId: string }> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const liegenschaftId: string = (await c.query("insert into liegenschaft(name) values ('Beispielliegenschaft M2a') returning id")).rows[0].id;
    const gebaeudeId = await legeGebaeudeAn(c, liegenschaftId,
      { name: "Beispielgebaeude", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] }, REGELWERK_V1);
    const h = (await ladeHuelle(c, gebaeudeId))!;
    const [eg, og1] = h.geschosse;
    const b: Beschreibung = {
      gebaeudeId, stand: h.stand, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
      einheiten: [
        { geschossId: eg.id, bezeichnung: "Buero A", art: "buero", flaecheM2: null },
        { geschossId: eg.id, bezeichnung: "Restaurant", art: "gastro", flaecheM2: 150, heizungAusnahme: { hk: "nein", fbh: "ja" } },
        { geschossId: eg.id, bezeichnung: "Technik", art: "technik", flaecheM2: 30 },
        { geschossId: og1.id, bezeichnung: "Buero C", art: "buero", flaecheM2: null, heizungAusnahme: { fbh: "ja" } },
        { geschossId: og1.id, bezeichnung: "Buero D", art: "buero", flaecheM2: null, heizungAusnahme: { fbh: "ja" } },
      ],
      bauteile: [
        { katalogId: "heizung.waermepumpe", standort: { einheitIndex: 2 }, menge: 1, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.speicher", standort: { einheitIndex: 2 }, menge: 1, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 12, status: "bestaetigt", hersteller: "Zehnder", versorgt: [] },
        { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 3, status: "bestaetigt", hersteller: "Prolux", versorgt: [] },
        { katalogId: "heizung.fbh_kreis", standort: { einheitIndex: 1 }, menge: 6, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.fbh_kreis", standort: { einheitIndex: 3 }, menge: 4, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.fbh_kreis", standort: { einheitIndex: 4 }, menge: null, status: "bestaetigt", versorgt: [] },
        { katalogId: "heizung.verteiler", standort: { einheitIndex: 2 }, menge: 1, status: "bestaetigt", versorgt: [{ einheitIndex: 1 }, { einheitIndex: 3 }] },
      ],
    };
    await schreibeBeschreibung(c, gebaeudeId, b, REGELWERK_V1, KATALOG_V1);
    await c.query("commit");
    return { liegenschaftId, gebaeudeId };
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
