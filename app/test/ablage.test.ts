import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import pg from "pg";
import { dateiAblage, speichereUndReferenziere, type Ablage } from "../src/ablage/ablage.js";
import { GC_LOCK, sammleMuell } from "../src/ablage/gc.js";
import { neuerPool } from "../src/db/pool.js";
import { frischeDb } from "./hilfe.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
const ordner: string[] = [];
beforeAll(async () => { db = await frischeDb(); });
afterAll(async () => { await db.ende(); });
afterEach(async () => {
  await db.pool.query("truncate datei_referenz, datei, loesch_journal, backup_lauf; update journal_zaehler set seq=0");
  for (const pfad of ordner.splice(0)) await fs.rm(pfad, { recursive: true, force: true });
});

async function ablageNeu() {
  const wurzel = await fs.mkdtemp(join(tmpdir(), "planora-ablage-"));
  ordner.push(wurzel);
  return { wurzel, ablage: dateiAblage(wurzel, { belegung: async () => 0.1 }) };
}
async function inhalt(daten: Readable): Promise<Buffer> {
  const teile: Buffer[] = [];
  for await (const teil of daten) teile.push(Buffer.from(teil));
  return Buffer.concat(teile);
}
async function vormerken(ablage: Ablage, zustand = "quittiert", tage = 31) {
  const datei = await ablage.schreibeNeu(Readable.from([randomUUID()]));
  await db.pool.query("insert into datei(schluessel, sha256, groesse) values ($1,$2,$3)", [datei.schluessel, datei.sha256, datei.groesse]);
  const seq = (await db.pool.query("select journal_eintrag('datei.loeschen',$1) seq", [datei.schluessel])).rows[0].seq;
  await db.pool.query("update loesch_journal set zustand=$2, zeit=now()-make_interval(days=>$3) where seq=$1", [seq, zustand, tage]);
  return datei.schluessel;
}

describe("Dateisystem-Ablage", () => {
  it("adressiert nach SHA-256, zaehlt Bytes und schuetzt die Datei gegen Schreiben", async () => {
    const { wurzel, ablage } = await ablageNeu();
    const daten = Buffer.from("Gruezi Zürich 🌍");
    const sha256 = createHash("sha256").update(daten).digest("hex");
    const datei = await ablage.schreibeNeu(Readable.from([daten.subarray(0, 4), daten.subarray(4)]));
    expect(datei).toEqual({ schluessel: `sha256/${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}`, sha256, groesse: daten.length });
    const pfad = join(wurzel, datei.schluessel);
    if (process.platform === "win32") await expect(fs.access(pfad, constants.W_OK)).rejects.toThrow();
    else expect((await fs.stat(pfad)).mode & 0o222).toBe(0);
    expect(await inhalt(ablage.lese(datei.schluessel))).toEqual(daten);
    expect(await ablage.existiert(datei.schluessel)).toBe(true);
  });
  it("dedupliziert gleichen Inhalt auch bei parallelem Schreiben ohne Ueberschreiben", async () => {
    const { wurzel, ablage } = await ablageNeu();
    const datei = await ablage.schreibeNeu(Readable.from(["gleich"]));
    const vorher = await fs.stat(join(wurzel, datei.schluessel));
    const wiederholungen = await Promise.all(Array.from({ length: 5 }, () => ablage.schreibeNeu(Readable.from(["gleich"]))));
    expect(wiederholungen.every((d) => d.schluessel === datei.schluessel)).toBe(true);
    const nachher = await fs.stat(join(wurzel, datei.schluessel));
    expect(nachher.ino).toBe(vorher.ino);
    expect(nachher.mtimeMs).toBe(vorher.mtimeMs);
    expect(await fs.readdir(join(wurzel, "tmp"))).toEqual([]);
  });
  it("liest Range inklusive Endbyte und den gesamten Inhalt", async () => {
    const { ablage } = await ablageNeu();
    const { schluessel } = await ablage.schreibeNeu(Readable.from(["0123456789"]));
    expect((await inhalt(ablage.lese(schluessel, { start: 2, ende: 5 }))).toString()).toBe("2345");
    expect((await inhalt(ablage.lese(schluessel, { start: 0, ende: 0 }))).toString()).toBe("0");
  });
  it("weist ungueltige Schluessel bei Lesen, Pruefen und Entfernen zurueck", async () => {
    const { ablage } = await ablageNeu();
    for (const schluessel of ["../x", "sha256/../../x", "C:\\x", "/tmp/x", "sha256/aa/bb/" + "c".repeat(64)]) {
      expect(() => ablage.lese(schluessel)).toThrow(/ungueltiger Schluessel/);
      await expect(ablage.existiert(schluessel)).rejects.toThrow(/ungueltiger Schluessel/);
      await expect(ablage.entferne(schluessel)).rejects.toThrow(/ungueltiger Schluessel/);
    }
  });
  it("stoppt bei mindestens 90 Prozent Belegung und akzeptiert einen eigenen Grenzwert", async () => {
    const { wurzel } = await ablageNeu();
    for (const belegt of [0.9, 0.95]) await expect(dateiAblage(wurzel, { belegung: async () => belegt }).schreibeNeu(Readable.from(["x"]))).rejects.toThrow(/Speicher voll/);
    await expect(dateiAblage(wurzel, { belegung: async () => 0.8, maxBelegung: 0.8 }).schreibeNeu(Readable.from(["x"]))).rejects.toThrow(/Speicher voll/);
    expect((await dateiAblage(wurzel, { belegung: async () => 0.95, maxBelegung: 0.99 }).schreibeNeu(Readable.from(["x"]))).groesse).toBe(1);
  });
  it("kann die reale Belegung einer neu angelegten Wurzel lesen", async () => {
    const { wurzel } = await ablageNeu();
    expect((await dateiAblage(join(wurzel, "neu"), { maxBelegung: 1 }).schreibeNeu(Readable.from(["x"]))).groesse).toBe(1);
  });
  it("entfernt temporaere Dateien nach einem fehlerhaften Stream", async () => {
    const { wurzel, ablage } = await ablageNeu();
    const quelle = Readable.from((async function* () { yield "teil"; throw new Error("Upload abgebrochen"); })());
    await expect(ablage.schreibeNeu(quelle)).rejects.toThrow(/Upload abgebrochen/);
    expect(await fs.readdir(join(wurzel, "tmp"))).toEqual([]);
  });
  it("entfernt schreibgeschuetzte Dateien und behandelt fehlende Dateien idempotent", async () => {
    const { ablage } = await ablageNeu();
    const { schluessel } = await ablage.schreibeNeu(Readable.from(["loeschen"]));
    await ablage.entferne(schluessel);
    await ablage.entferne(schluessel);
    expect(await ablage.existiert(schluessel)).toBe(false);
  });
  it("weist Symlink-Verzeichnisse fuer alle Operationen zurueck", async () => {
    const { wurzel, ablage } = await ablageNeu();
    const aussen = await fs.mkdtemp(join(tmpdir(), "planora-aussen-"));
    ordner.push(aussen);
    const daten = "ausserhalb";
    const hash = createHash("sha256").update(daten).digest("hex");
    const schluessel = `sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`;
    await fs.mkdir(join(aussen, hash.slice(0, 2), hash.slice(2, 4)), { recursive: true });
    const ziel = join(aussen, hash.slice(0, 2), hash.slice(2, 4), hash);
    await fs.writeFile(ziel, daten);
    await fs.symlink(aussen, join(wurzel, "sha256"), process.platform === "win32" ? "junction" : "dir");
    await expect(inhalt(ablage.lese(schluessel))).rejects.toThrow(/ungueltiger Schluessel/);
    await expect(ablage.existiert(schluessel)).rejects.toThrow(/ungueltiger Schluessel/);
    await expect(ablage.entferne(schluessel)).rejects.toThrow(/ungueltiger Schluessel/);
    await expect(ablage.schreibeNeu(Readable.from([daten]))).rejects.toThrow(/ungueltiger Schluessel/);
    expect(await fs.readFile(ziel, "utf8")).toBe(daten);
  });
  it("weist eine verlinkte Wurzel und ein verlinktes Temporaerverzeichnis zurueck", async () => {
    const { wurzel } = await ablageNeu();
    const aussen = await fs.mkdtemp(join(tmpdir(), "planora-aussen-"));
    ordner.push(aussen);
    const art = process.platform === "win32" ? "junction" : "dir";
    await fs.symlink(aussen, join(wurzel, "link"), art);
    await expect(dateiAblage(join(wurzel, "link")).schreibeNeu(Readable.from(["x"]))).rejects.toThrow(/ungueltiger Schluessel/);
    await fs.symlink(aussen, join(wurzel, "tmp"), art);
    await expect(dateiAblage(wurzel).schreibeNeu(Readable.from(["x"]))).rejects.toThrow(/ungueltiger Schluessel/);
    expect(await fs.readdir(aussen)).toEqual([]);
  });
  it("PP8-6: weist eine Wurzel unter einem verlinkten Vorfahren fuer alle Operationen zurueck", async () => {
    const { wurzel } = await ablageNeu();
    const aussen = await fs.mkdtemp(join(tmpdir(), "planora-aussen-"));
    ordner.push(aussen);
    await fs.symlink(aussen, join(wurzel, "link"), process.platform === "win32" ? "junction" : "dir");
    const echt = dateiAblage(join(aussen, "ablage"), { belegung: async () => 0.1 });
    const { schluessel } = await echt.schreibeNeu(Readable.from(["fremd"]));
    for (const unter of [join(wurzel, "link", "ablage"), join(wurzel, "link", "neu", "ablage")]) {
      const ablage = dateiAblage(unter, { belegung: async () => 0.1 });
      await expect(ablage.schreibeNeu(Readable.from(["x"]))).rejects.toThrow(/verlinkt/);
      await expect(inhalt(ablage.lese(schluessel))).rejects.toThrow(/verlinkt/);
      await expect(ablage.existiert(schluessel)).rejects.toThrow(/verlinkt/);
      await expect(ablage.entferne(schluessel)).rejects.toThrow(/verlinkt/);
    }
    expect(await echt.existiert(schluessel)).toBe(true);
    expect(await fs.readdir(aussen)).toEqual(["ablage"]);
  });
  it("nimmt den geteilten GC-Lock auch bei bereits vorhandenem Hash", async () => {
    const { wurzel, ablage } = await ablageNeu();
    await ablage.schreibeNeu(Readable.from(["vorhanden"]));
    const schreibPool = new pg.Pool({ ...db.cfg, options: "-c statement_timeout=200" });
    const c = await db.pool.connect();
    try {
      await c.query("select pg_advisory_lock($1)", [GC_LOCK]);
      const geschuetzt = dateiAblage(wurzel, { pool: schreibPool, belegung: async () => 0.1 });
      for (const daten of ["neu", "vorhanden"]) await expect(geschuetzt.schreibeNeu(Readable.from([daten]))).rejects.toThrow(/statement timeout/);
    } finally { await c.query("select pg_advisory_unlock($1)", [GC_LOCK]); c.release(); await schreibPool.end(); }
  });
});

describe("GC und Loeschjournal", () => {
  it("entfernt ausschliesslich referenzfreie Dateien mit quittiertem altem Journal", async () => {
    const { ablage } = await ablageNeu();
    const alt = await vormerken(ablage);
    const offen = await vormerken(ablage, "offen");
    const jung = await vormerken(ablage, "quittiert", 29);
    const referenziert = await vormerken(ablage);
    await db.pool.query("insert into datei_referenz values ($1,'dokument:1')", [referenziert]);
    const ohneJournal = await vormerken(ablage);
    await db.pool.query("delete from loesch_journal where ziel=$1", [ohneJournal]);
    expect(await sammleMuell(db.pool, ablage)).toEqual([alt]);
    expect(await ablage.existiert(alt)).toBe(false);
    expect((await db.pool.query("select 1 from datei where schluessel=$1", [alt])).rowCount).toBe(0);
    for (const schluessel of [offen, jung, referenziert, ohneJournal]) expect(await ablage.existiert(schluessel)).toBe(true);
  });
  it("respektiert auch zusaetzliche offene Journal-Eintraege", async () => {
    const { ablage } = await ablageNeu();
    const schluessel = await vormerken(ablage);
    await db.pool.query("select journal_eintrag('datei.loeschen',$1)", [schluessel]);
    expect(await sammleMuell(db.pool, ablage)).toEqual([]);
    expect(await ablage.existiert(schluessel)).toBe(true);
  });
  it("PP8-4: nur die juengste Loeschabsicht zaehlt (alte Quittung + neue Vormerkung)", async () => {
    const { ablage } = await ablageNeu();
    const schluessel = await vormerken(ablage, "quittiert", 31);
    const seq = (await db.pool.query("select journal_eintrag('datei.loeschen',$1) seq", [schluessel])).rows[0].seq;
    await db.pool.query("update loesch_journal set zustand='quittiert' where seq=$1", [seq]);
    expect(await sammleMuell(db.pool, ablage)).toEqual([]);
    expect(await ablage.existiert(schluessel)).toBe(true);
    await db.pool.query("update loesch_journal set zeit=now()-interval '31 days' where seq=$1", [seq]);
    expect(await sammleMuell(db.pool, ablage)).toEqual([schluessel]);
  });
  it("PP8-4: neue Referenz entwertet eine aeltere Loeschabsicht", async () => {
    const { ablage } = await ablageNeu();
    const schluessel = await vormerken(ablage, "quittiert", 31);
    await db.pool.query("insert into datei_referenz values ($1,'dokument:2')", [schluessel]);
    await db.pool.query("delete from datei_referenz where schluessel=$1", [schluessel]);
    expect(await sammleMuell(db.pool, ablage)).toEqual([]);
    expect(await ablage.existiert(schluessel)).toBe(true);
    const seq = (await db.pool.query("select journal_eintrag('datei.loeschen',$1) seq", [schluessel])).rows[0].seq;
    await db.pool.query("update loesch_journal set zustand='quittiert', zeit=now()-interval '31 days' where seq=$1", [seq]);
    expect(await sammleMuell(db.pool, ablage)).toEqual([schluessel]);
  });
  it("pausiert bei laufendem Backup und laeuft nach dessen Abschluss weiter", async () => {
    const { ablage } = await ablageNeu();
    const schluessel = await vormerken(ablage);
    await db.pool.query("insert into backup_lauf(id,zustand,heartbeat) values ($1,'laufend',now())", [randomUUID()]);
    expect(await sammleMuell(db.pool, ablage)).toEqual([]);
    expect(await ablage.existiert(schluessel)).toBe(true);
    await db.pool.query("update backup_lauf set zustand='geprueft'");
    expect(await sammleMuell(db.pool, ablage)).toEqual([schluessel]);
  });
  it("wendet eine angepasste Aufbewahrungsfrist an", async () => {
    const { ablage } = await ablageNeu();
    const schluessel = await vormerken(ablage, "quittiert", 8);
    expect(await sammleMuell(db.pool, ablage, 7)).toEqual([schluessel]);
  });
  it("gibt bei gehaltenem geteiltem Lock sofort leer zurueck und gibt eigene Locks frei", async () => {
    const { ablage } = await ablageNeu();
    const schluessel = await vormerken(ablage);
    const c = await db.pool.connect();
    try {
      await c.query("select pg_advisory_lock_shared($1)", [GC_LOCK]);
      expect(await sammleMuell(db.pool, ablage)).toEqual([]);
      expect(await ablage.existiert(schluessel)).toBe(true);
    } finally { await c.query("select pg_advisory_unlock_shared($1)", [GC_LOCK]); c.release(); }
    expect(await sammleMuell(db.pool, ablage)).toEqual([schluessel]);
    expect((await db.pool.query("select count(*)::int n from pg_locks where locktype='advisory' and objid=$1", [GC_LOCK])).rows[0].n).toBe(0);
  });
  it("haelt den exklusiven Lock bis zum Entfernen und loest ihn auch bei Fehlern", async () => {
    const { ablage } = await ablageNeu();
    const schluessel = await vormerken(ablage);
    let gesehen = false;
    await expect(sammleMuell(db.pool, { ...ablage, async entferne() {
      const c = await db.pool.connect();
      try {
        const r = await c.query("select pg_try_advisory_lock_shared($1) ok", [GC_LOCK]);
        if (r.rows[0].ok) await c.query("select pg_advisory_unlock_shared($1)", [GC_LOCK]);
        expect(r.rows[0].ok).toBe(false);
        gesehen = true;
        throw new Error("Dateisystem ausgefallen");
      } finally { c.release(); }
    } })).rejects.toThrow(/Dateisystem ausgefallen/);
    expect(gesehen).toBe(true);
    expect((await db.pool.query("select count(*)::int n from pg_locks where locktype='advisory' and objid=$1", [GC_LOCK])).rows[0].n).toBe(0);
    expect(await sammleMuell(db.pool, ablage)).toEqual([schluessel]);
  });
  it("erzeugt Journal-Sequenzen unter App-Rechten und laesst nach Rollback keine Luecke", async () => {
    const appPool = neuerPool(db.cfg, "planora_app");
    const c = await appPool.connect();
    try {
      await c.query("begin");
      expect((await c.query("select journal_eintrag('datei.loeschen','a') seq")).rows[0].seq).toBe("1");
      await c.query("rollback");
      expect((await c.query("select journal_eintrag('datei.loeschen','b') seq")).rows[0].seq).toBe("1");
      expect((await c.query("select journal_eintrag('datei.loeschen','c') seq")).rows[0].seq).toBe("2");
      await expect(c.query("update journal_zaehler set seq=0")).rejects.toThrow(/permission denied/);
      await expect(c.query("update loesch_journal set zustand='quittiert'")).rejects.toThrow(/permission denied/);
    } finally { await c.query("rollback"); c.release(); await appPool.end(); }
  });
  it("PP8-3: haelt den geteilten GC-Lock bei Deduplikation bis zum Referenz-Commit (Barriere mit parallelem GC)", async () => {
    const { ablage } = await ablageNeu();
    const alt = await ablage.schreibeNeu(Readable.from(["alter Inhalt"]));
    await db.pool.query("insert into datei(schluessel, sha256, groesse) values ($1,$2,$3)", [alt.schluessel, alt.sha256, alt.groesse]);
    const seq = (await db.pool.query("select journal_eintrag('datei.loeschen',$1) seq", [alt.schluessel])).rows[0].seq;
    await db.pool.query("update loesch_journal set zustand='quittiert', zeit=now()-interval '31 days' where seq=$1", [seq]);
    let geschrieben!: () => void; const barriere = new Promise<void>((r) => { geschrieben = r; });
    let weiter!: () => void; const freigabe = new Promise<void>((r) => { weiter = r; });
    const angehalten: Ablage = { ...ablage, async schreibeNeu(daten, kontext) { const d = await ablage.schreibeNeu(daten, kontext); geschrieben(); await freigabe; return d; } };
    const appPool = neuerPool(db.cfg, "planora_app");
    try {
      const speichern = speichereUndReferenziere(appPool, angehalten, Readable.from(["alter Inhalt"]), "dokument:9");
      await barriere; // Hash existiert bereits (Dedup), Metadaten/Referenz noch nicht committet
      expect(await sammleMuell(db.pool, ablage)).toEqual([]);
      expect(await ablage.existiert(alt.schluessel)).toBe(true);
      weiter();
      expect((await speichern).schluessel).toBe(alt.schluessel);
      expect((await db.pool.query("select objekt from datei_referenz where schluessel=$1", [alt.schluessel])).rows).toEqual([{ objekt: "dokument:9" }]);
      expect(await sammleMuell(db.pool, ablage)).toEqual([]);
      expect(await ablage.existiert(alt.schluessel)).toBe(true);
      // Neue Datei: legt Metadaten und Referenz unter der Laufzeitrolle an
      const neu = await speichereUndReferenziere(appPool, ablage, Readable.from(["neuer Inhalt"]), "dokument:10");
      expect((await db.pool.query("select groesse::int from datei where schluessel=$1", [neu.schluessel])).rows[0].groesse).toBe(12);
    } finally { weiter(); await appPool.end(); }
    expect((await db.pool.query("select count(*)::int n from pg_locks where locktype='advisory' and objid=$1", [GC_LOCK])).rows[0].n).toBe(0);
  });
  it("PP8b-1: kein Deadlock, wenn Adapter und Helfer denselben Pool mit max:1 nutzen", async () => {
    const { wurzel } = await ablageNeu();
    const engPool = new pg.Pool({ ...db.cfg, max: 1, connectionTimeoutMillis: 400 });
    try {
      const ablage = dateiAblage(wurzel, { pool: engPool, belegung: async () => 0.1 });
      const erst = await speichereUndReferenziere(engPool, ablage, Readable.from(["eng"]), "dokument:20");
      const dedup = await speichereUndReferenziere(engPool, ablage, Readable.from(["eng"]), "dokument:21");
      expect(dedup.schluessel).toBe(erst.schluessel);
      expect((await db.pool.query("select count(*)::int n from datei_referenz where schluessel=$1", [erst.schluessel])).rows[0].n).toBe(2);
    } finally { await engPool.end(); }
  });
  it("PP8-3: wartet auf einen laufenden GC und publiziert danach neu", async () => {
    const { ablage } = await ablageNeu();
    const c = await db.pool.connect();
    const appPool = neuerPool(db.cfg, "planora_app");
    try {
      await c.query("select pg_advisory_lock($1)", [GC_LOCK]);
      let fertig = false;
      const speichern = speichereUndReferenziere(appPool, ablage, Readable.from(["spaeter"]), "dokument:11").then((d) => { fertig = true; return d; });
      await new Promise((r) => setTimeout(r, 300));
      expect(fertig).toBe(false);
      await c.query("select pg_advisory_unlock($1)", [GC_LOCK]);
      const d = await speichern;
      expect(await ablage.existiert(d.schluessel)).toBe(true);
    } finally { await c.query("select pg_advisory_unlock_all()"); c.release(); await appPool.end(); }
  });
  it("serialisiert Backup-Start und neue Referenzen gegen den exklusiven GC-Lock", async () => {
    const { ablage } = await ablageNeu();
    const schluessel = await vormerken(ablage);
    const c = await db.pool.connect();
    const schreiber = new pg.Client({ ...db.cfg, options: "-c statement_timeout=200" });
    await schreiber.connect();
    try {
      await c.query("select pg_advisory_lock($1)", [GC_LOCK]);
      await expect(schreiber.query("insert into backup_lauf(id,zustand) values ($1,'laufend')", [randomUUID()])).rejects.toThrow(/statement timeout/);
      await expect(schreiber.query("insert into datei_referenz values ($1,'neu')", [schluessel])).rejects.toThrow(/statement timeout/);
    } finally { await c.query("select pg_advisory_unlock($1)", [GC_LOCK]); c.release(); await schreiber.end(); }
    expect((await db.pool.query("select count(*)::int n from backup_lauf")).rows[0].n).toBe(0);
    expect((await db.pool.query("select count(*)::int n from datei_referenz")).rows[0].n).toBe(0);
  });
});
