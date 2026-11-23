import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { frischeDb } from "./hilfe.js";
import { pdf } from "./hilfe-dateien.js";
import { dateiAblage, type Ablage } from "../src/ablage/ablage.js";
import { legeDokumentAn } from "../src/dokumente/speicher.js";
import { EICAR, fakeScanner, type VirenScanner } from "../src/dokumente/scanner.js";
import { erzeugePruefer, raeumeAbgelehnteAuf, SCAN_FEHLER_TEXT } from "../src/dokumente/pruefer.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let ablage: Ablage, quarantaene: Ablage;
let L: string, G: string, G2: string, B: string;
const q = (sql: string, p: unknown[] = []) => db.pool.query(sql, p);
const zeile = async (id: string) => (await q("select * from dokument where id=$1", [id])).rows[0];
async function neuesDokument(daten: Buffer, gid = () => G) {
  const x = await quarantaene.schreibeNeu(Readable.from(daten));
  return (await legeDokumentAn(db.pool, { gebaeudeId: gid(), liegenschaftId: L, dateiname: "x.pdf", schluessel: x.schluessel, sha256: x.sha256, groesse: x.groesse,
    seiten: 1, von: randomUUID(), status: "aus", scanStatus: "quarantaene" })).id;
}

beforeAll(async () => {
  db = await frischeDb();
  const wurzel = mkdtempSync(join(tmpdir(), "pruefer-"));
  ablage = dateiAblage(wurzel, { pool: db.pool });
  quarantaene = dateiAblage(join(wurzel, "quarantaene"));
  L = (await q("insert into liegenschaft(name) values ('L') returning id")).rows[0].id;
  const geb = async (name: string) => (await q("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,$2,'quader',30,15,1) returning id", [L, name])).rows[0].id;
  G = await geb("G"); G2 = await geb("G2");
  const gs = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3.2) returning id", [L, G])).rows[0].id;
  B = (await q("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',0) returning id", [L, G, gs])).rows[0].id;
});
afterAll(async () => { await db.ende(); });

describe("Pruefer", () => {
  it("sauber: in die Ablage uebernommen, Referenz gesetzt, Quarantaene-Kopie weg", async () => {
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    const id = await neuesDokument(pdf(1, "% sauber"));
    p.starte(id); await p.warteLeer();
    const d = await zeile(id);
    expect([d.scan_status, d.scan_grund, d.gescannt_am !== null]).toEqual(["sauber", null, true]);
    expect((await q("select 1 from datei_referenz where objekt=$1", [`dokument:${id}`])).rowCount).toBe(1);
    expect([await ablage.existiert(d.schluessel), await quarantaene.existiert(d.schluessel)]).toEqual([true, false]);
  });
  it("Befund: abgelehnt mit Signatur, Verknuepfungen weg, Audit, keine Referenz, Kopie bleibt", async () => {
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    const id = await neuesDokument(Buffer.concat([pdf(1, "% eicar"), Buffer.from(EICAR)]));
    await q("insert into dokument_bauteil(dokument_id, bauteil_id) values ($1,$2)", [id, B]);
    p.starte(id); await p.warteLeer();
    const d = await zeile(id);
    expect([d.scan_status, d.scan_grund]).toEqual(["abgelehnt", "Eicar-Test-Signature"]);
    expect((await q("select 1 from dokument_bauteil where dokument_id=$1", [id])).rowCount).toBe(0);
    expect((await q("select 1 from audit_eintrag where art='dokument.abgelehnt' and daten->>'dokumentId'=$1", [id])).rowCount).toBe(1);
    expect((await q("select 1 from datei_referenz where objekt=$1", [`dokument:${id}`])).rowCount).toBe(0);
    expect(await quarantaene.existiert(d.schluessel)).toBe(true);
  });
  it("Ausfall oder fehlende Quarantaene-Datei: scan_fehler mit festem Text", async () => {
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner({ ausfall: () => true }));
    const id = await neuesDokument(pdf(1, "% ausfall"));
    p.starte(id); await p.warteLeer();
    expect([(await zeile(id)).scan_status, (await zeile(id)).scan_grund]).toEqual(["scan_fehler", SCAN_FEHLER_TEXT]);
    const id2 = await neuesDokument(pdf(1, "% fehlt"));
    await quarantaene.entferne((await zeile(id2)).schluessel);
    const p2 = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    p2.starte(id2); await p2.warteLeer();
    expect((await zeile(id2)).scan_status).toBe("scan_fehler");
  });
  it("hoechstens 2 gleichzeitig", async () => {
    let offen = 0, max = 0;
    const basis = fakeScanner({ verzoegerungMs: 50 });
    const zaehlend: VirenScanner = { async pruefe(d) { offen++; max = Math.max(max, offen); try { return await basis.pruefe(d); } finally { offen--; } } };
    const p = erzeugePruefer(db.pool, ablage, quarantaene, zaehlend);
    const ids = [await neuesDokument(pdf(1, "% g1")), await neuesDokument(pdf(1, "% g2")), await neuesDokument(pdf(1, "% g3"))];
    ids.forEach((id) => p.starte(id)); await p.warteLeer();
    expect(max).toBe(2);
    for (const id of ids) expect((await zeile(id)).scan_status).toBe("sauber");
  });
  it("Neustart: reiheNeuEin prueft alle Quarantaene-Dokumente", async () => {
    const ids = [await neuesDokument(pdf(1, "% n1")), await neuesDokument(pdf(1, "% n2"))];
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    expect(await p.reiheNeuEin()).toBe(2);
    await p.warteLeer();
    for (const id of ids) expect((await zeile(id)).scan_status).toBe("sauber");
  });
  it("gleicher Inhalt in zwei Gebaeuden: Kopie bleibt bis zum letzten Scan", async () => {
    const daten = pdf(1, "% zwei");
    const a = await neuesDokument(daten), b = await neuesDokument(daten, () => G2);
    const p = erzeugePruefer(db.pool, ablage, quarantaene, fakeScanner());
    p.starte(a); await p.warteLeer();
    expect(await quarantaene.existiert((await zeile(b)).schluessel)).toBe(true);
    p.starte(b); await p.warteLeer();
    expect(await quarantaene.existiert((await zeile(b)).schluessel)).toBe(false);
  });
  it("Bereinigung: abgelehnt aelter als 7 Tage -> Zeile und Kopie weg", async () => {
    const alt = await neuesDokument(pdf(1, "% alt")), jung = await neuesDokument(pdf(1, "% jung"));
    await q("update dokument set scan_status='abgelehnt', scan_grund='X', gescannt_am=now() - interval '8 days' where id=$1", [alt]);
    await q("update dokument set scan_status='abgelehnt', scan_grund='X', gescannt_am=now() - interval '6 days' where id=$1", [jung]);
    const schluessel = (await zeile(alt)).schluessel;
    expect(await raeumeAbgelehnteAuf(db.pool, quarantaene)).toBe(1);
    expect([await zeile(alt), (await zeile(jung)).scan_status]).toEqual([undefined, "abgelehnt"]);
    expect(await quarantaene.existiert(schluessel)).toBe(false);
  });
});
