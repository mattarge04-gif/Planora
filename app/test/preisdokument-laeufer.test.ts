import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { frischeDb } from "./hilfe.js";
import { dateiAblage, speichereUndReferenziere } from "../src/ablage/ablage.js";
import { erzeugeLaeufer, markiereAbgebrochen, ladeKontext } from "../src/preisdokument/laeufer.js";
import { legeDokumentAn } from "../src/preisdokument/speicher.js";
import { fakeAdapter } from "../src/preisdokument/fake.js";
import { LeseFehler, type LeseAdapter } from "../src/preisdokument/adapter.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
const ablage = () => dateiAblage(mkdtempSync(join(tmpdir(), "ablage-")));
let L: string, G: string, B2: string;
const U = randomUUID();

beforeAll(async () => {
  db = await frischeDb();
  const q = async (s: string, p: unknown[]) => (await db.pool.query(s, p)).rows[0].id as string;
  L = await q("insert into liegenschaft(name) values ('L') returning id", []);
  G = await q("insert into gebaeude(liegenschaft_id,name,grundform,breite_m,tiefe_m,regelwerk_version) values ($1,'H','quader',30,15,2) returning id", [L]);
  const eg = await q("insert into geschoss(liegenschaft_id,gebaeude_id,code,reihenfolge,hoehe_m) values ($1,$2,'EG',0,3) returning id", [L, G]);
  const e = await q("insert into einheit(liegenschaft_id,geschoss_id,bezeichnung,art,reihenfolge) values ($1,$2,'Buero A','buero',0) returning id", [L, eg]);
  await q("insert into bauteil(liegenschaft_id,gebaeude_id,katalog_id,einheit_id,menge,status,reihenfolge) values ($1,$2,'heizung.heizkoerper',$3,4,'bestaetigt',0) returning id", [L, G, e]);
  await db.pool.query("insert into modul_schalter(modul_id, aktiv) values ('preisdokument', true) on conflict (modul_id) do update set aktiv=true");
  B2 = await q("insert into bauteil(liegenschaft_id,gebaeude_id,katalog_id,geschoss_id,menge,status,reihenfolge) values ($1,$2,'heizung.umwaelzpumpe',$3,1,'bestaetigt',1) returning id", [L, G, eg]);
});
afterAll(async () => { await db.ende(); });

async function neuesDokument(a: ReturnType<typeof ablage>, status = "neu") {
  const daten = Buffer.from(`%PDF-1.7\n${randomBytes(16).toString("hex")}\n%%EOF`);
  const d = await speichereUndReferenziere(db.pool, a, Readable.from(daten), `dokument:${randomUUID()}`);
  const r = await legeDokumentAn(db.pool, { gebaeudeId: G, liegenschaftId: L, dateiname: "o.pdf", schluessel: d.schluessel, sha256: d.sha256, groesse: d.groesse, seiten: 2, von: U, status: status as "neu" });
  return r.id;
}
const zeile = async (id: string) => (await db.pool.query("select * from dokument where id=$1", [id])).rows[0];
const gueltig = () => ({ vorschlaege: [{ position: "Pumpe", seite: 1, zitat: "Pumpe 1240.00", materialNetto: 1116, rabattText: "10 %", montageAnteil: 180,
  ersatzpreis: 1296, rechenweg: "1240 - 10 % + 180", katalogId: "heizung.umwaelzpumpe", bauteilIds: [B2], sicherheit: "hoch" }] });
const anzahl = async (id: string) => Number((await db.pool.query("select count(*) n from preis_vorschlag where dokument_id=$1", [id])).rows[0].n);

describe("Laeufer", () => {
  it("ladeKontext liefert Bauteile mit Ort und Katalog", async () => {
    const k = await ladeKontext(db.pool, G);
    expect(k.bauteile.map((b) => b.ort)).toEqual(["EG · Buero A", "EG"]);
    expect(k.katalog.map((e) => e.id).sort()).toEqual(["heizung.heizkoerper", "heizung.umwaelzpumpe"]);
  });
  it("gueltiger Vorschlag -> fertig", async () => {
    const a = ablage(), l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => gueltig()));
    const id = await neuesDokument(a);
    l.starte(id); await l.warteLeer();
    const z = await zeile(id);
    expect(z).toMatchObject({ auslesen_status: "fertig", modell: "fake" });
    expect(Number(z.kosten_usd)).toBeCloseTo(0.1, 4);
    expect(await anzahl(id)).toBe(1);
  });
  it("Ablehnung -> fehler mit festem Text", async () => {
    const a = ablage(), l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => new LeseFehler("ablehnung", "x")));
    const id = await neuesDokument(a);
    l.starte(id); await l.warteLeer();
    expect(await zeile(id)).toMatchObject({ auslesen_status: "fehler", auslesen_fehler: "Das Modell hat das Dokument abgelehnt." });
    expect(await anzahl(id)).toBe(0);
  });
  it("falsches Format -> fehler", async () => {
    const a = ablage(), l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => ({ foo: 1 })));
    const id = await neuesDokument(a);
    l.starte(id); await l.warteLeer();
    expect(await zeile(id)).toMatchObject({ auslesen_status: "fehler", auslesen_fehler: "Antwort hatte ein unerwartetes Format." });
  });
  it("unerwarteter Fehler -> nur fester Text, nie die Rohmeldung", async () => {
    const a = ablage(), l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => new Error("sk-geheim")));
    const id = await neuesDokument(a);
    l.starte(id); await l.warteLeer();
    expect(await zeile(id)).toMatchObject({ auslesen_status: "fehler", auslesen_fehler: "Interner Fehler beim Lesen." });
  });
  it("Budget: zweites Dokument scheitert, Adapter nur einmal gerufen", async () => {
    await db.pool.query("delete from preis_lesung"); // Monatsverbrauch der Vortests zuruecksetzen (Test-Superuser)
    const a = ablage(), f = fakeAdapter(() => gueltig()), l = erzeugeLaeufer(db.pool, a, f, { limitUsd: 0.1 });
    const d1 = await neuesDokument(a); const d2 = await neuesDokument(a);
    l.starte(d1); await l.warteLeer(); l.starte(d2); await l.warteLeer();
    expect((await zeile(d1)).auslesen_status).toBe("fertig");
    expect(await zeile(d2)).toMatchObject({ auslesen_status: "fehler", auslesen_fehler: "Monatsbudget erreicht." });
    expect(f.aufrufe).toHaveLength(1);
  });
  it("Gleichzeitigkeit: nie mehr als 2 offen", async () => {
    let offen = 0, spitze = 0;
    const adapter: LeseAdapter = { async lies() {
      offen++; spitze = Math.max(spitze, offen);
      await new Promise((r) => setTimeout(r, 300)); offen--;
      return { roh: gueltig(), modell: "fake", tokensEin: 1, tokensAus: 1 };
    } };
    const a = ablage(), l = erzeugeLaeufer(db.pool, a, adapter, { gleichzeitig: 2 });
    const ids = [await neuesDokument(a), await neuesDokument(a), await neuesDokument(a)];
    ids.forEach((i) => l.starte(i)); await l.warteLeer();
    expect(spitze).toBe(2);
    for (const i of ids) expect((await zeile(i)).auslesen_status).toBe("fertig");
  });
  it("ohne Adapter -> aus, kein_schluessel", async () => {
    const a = ablage(), l = erzeugeLaeufer(db.pool, a, null);
    const id = await neuesDokument(a);
    l.starte(id); await l.warteLeer();
    expect((await zeile(id)).auslesen_status).toBe("aus");
    expect(l.zustand().auslesen).toBe("kein_schluessel");
  });
  it("erneutes Lesen: neue Reihenfolge beginnt nach der hoechsten vorhandenen", async () => {
    const a = ablage(), l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => gueltig()));
    const id = await neuesDokument(a);
    l.starte(id); await l.warteLeer();
    await db.pool.query("update preis_vorschlag set status='uebernommen' where dokument_id=$1", [id]);
    await db.pool.query("update dokument set auslesen_status='neu' where id=$1", [id]);
    l.starte(id); await l.warteLeer();
    const r = (await db.pool.query("select reihenfolge from preis_vorschlag where dokument_id=$1 order by reihenfolge", [id])).rows.map((x) => x.reihenfolge);
    expect(r).toEqual([0, 1]);
  });
  it("markiereAbgebrochen: 'liest' und wartende 'neu' -> abgebrochen, danach erneut lesbar", async () => {
    await markiereAbgebrochen(db.pool); // Reste der Vortests
    const a = ablage(); const id = await neuesDokument(a, "liest"); const wartend = await neuesDokument(a, "neu");
    expect(await markiereAbgebrochen(db.pool)).toBe(2);
    expect((await zeile(id)).auslesen_status).toBe("abgebrochen");
    expect((await zeile(wartend)).auslesen_status).toBe("abgebrochen");
    const l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => gueltig()));
    l.starte(wartend); await l.warteLeer();
    expect((await zeile(wartend)).auslesen_status).toBe("fertig");
  });
  it("Budget: verrechnete, aber gescheiterte Antwort zaehlt (LeseFehler mit Verbrauch)", async () => {
    await db.pool.query("delete from preis_lesung");
    const verbrauch = { modell: "fake", tokensEin: 30000, tokensAus: 4000 };
    const a = ablage(), l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => new LeseFehler("abgeschnitten", "x", verbrauch)));
    const id = await neuesDokument(a);
    l.starte(id); await l.warteLeer();
    expect(await zeile(id)).toMatchObject({ auslesen_status: "fehler", auslesen_fehler: "Antwort war unvollständig.", modell: "fake", tokens_aus: 4000 });
    expect(await l.zustand().verbrauchtUsd()).toBeCloseTo(0.1, 4);
    // ohne Verbrauch (z. B. Netzfehler vor der Antwort) keine Ledger-Zeile
    const l2 = erzeugeLaeufer(db.pool, a, fakeAdapter(() => new LeseFehler("api", "x")));
    const id2 = await neuesDokument(a);
    l2.starte(id2); await l2.warteLeer();
    expect((await zeile(id2)).auslesen_status).toBe("fehler");
    expect(await l.zustand().verbrauchtUsd()).toBeCloseTo(0.1, 4);
  });
  it("Budget: scheitert die Transaktion nach erfolgreicher Antwort, zaehlt der Verbrauch trotzdem", async () => {
    await db.pool.query("delete from preis_lesung");
    await db.pool.query(`create or replace function test_vorschlag_sperre() returns trigger language plpgsql as $$ begin raise exception 'test'; end $$`);
    await db.pool.query("create trigger test_vorschlag_sperre before insert on preis_vorschlag for each row execute function test_vorschlag_sperre()");
    try {
      const a = ablage(), l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => gueltig()));
      const id = await neuesDokument(a);
      l.starte(id); await l.warteLeer();
      expect(await zeile(id)).toMatchObject({ auslesen_status: "fehler", auslesen_fehler: "Interner Fehler beim Lesen." });
      expect(await anzahl(id)).toBe(0);
      expect(await l.zustand().verbrauchtUsd()).toBeCloseTo(0.1, 4);
    } finally {
      await db.pool.query("drop trigger test_vorschlag_sperre on preis_vorschlag");
      await db.pool.query("drop function test_vorschlag_sperre()");
    }
  });
  it("Modul nach dem Einreihen abgeschaltet -> kein Adapter-Aufruf, Status aus", async () => {
    const a = ablage(), f = fakeAdapter(() => gueltig()), l = erzeugeLaeufer(db.pool, a, f, { istAktiv: async () => false });
    const id = await neuesDokument(a);
    l.starte(id); await l.warteLeer();
    expect(f.aufrufe).toHaveLength(0);
    expect((await zeile(id)).auslesen_status).toBe("aus");
  });
  it("Modulschalter aus der DB wird gelesen", async () => {
    await db.pool.query("update modul_schalter set aktiv=false where modul_id='preisdokument'");
    try {
      const a = ablage(), f = fakeAdapter(() => gueltig()), l = erzeugeLaeufer(db.pool, a, f);
      const id = await neuesDokument(a);
      l.starte(id); await l.warteLeer();
      expect(f.aufrufe).toHaveLength(0);
      expect((await zeile(id)).auslesen_status).toBe("aus");
    } finally { await db.pool.query("update modul_schalter set aktiv=true where modul_id='preisdokument'"); }
  });
  it("Budget: Neu lesen und Loeschen entlasten das Monatsbudget nicht", async () => {
    await db.pool.query("update dokument set gelesen_am = null"); await db.pool.query("delete from preis_lesung");
    const a = ablage(), l = erzeugeLaeufer(db.pool, a, fakeAdapter(() => gueltig()));
    const id = await neuesDokument(a);
    l.starte(id); await l.warteLeer();
    await db.pool.query("update dokument set auslesen_status='neu' where id=$1", [id]);
    l.starte(id); await l.warteLeer();
    expect(await l.zustand().verbrauchtUsd()).toBeCloseTo(0.2, 4);
    await db.pool.query("delete from dokument where id=$1", [id]);
    expect(await l.zustand().verbrauchtUsd()).toBeCloseTo(0.2, 4);
  });
});
