import { createHash, randomBytes } from "node:crypto";
import { constants, createWriteStream, promises as fs } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform, Readable } from "node:stream";
import type pg from "pg";
import { GC_LOCK } from "./gc.js";

export type Ablage = {
  schreibeNeu(daten: Readable): Promise<{ schluessel: string; sha256: string; groesse: number }>;
  lese(schluessel: string, range?: { start: number; ende: number }): Readable;
  existiert(schluessel: string): Promise<boolean>;
  entferne(schluessel: string): Promise<void>;
};

const MUSTER = /^sha256\/([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{64})$/;
const istFehler = (fehler: unknown, code: string) => (fehler as NodeJS.ErrnoException).code === code;

export function dateiAblage(wurzel: string, opts: {
  maxBelegung?: number;
  belegung?: () => Promise<number>;
  /** Im DB-Betrieb mitgeben: haelt den geteilten GC-Lock auch bei Deduplikation. */
  pool?: pg.Pool;
} = {}): Ablage {
  const basis = resolve(wurzel);
  const max = opts.maxBelegung ?? 0.9;
  const belegung = opts.belegung ?? (async () => {
    const s = await fs.statfs(basis);
    return 1 - s.bavail / s.blocks;
  });

  function pfad(schluessel: string): string {
    const teile = MUSTER.exec(schluessel);
    if (!teile || teile[1] !== teile[3].slice(0, 2) || teile[2] !== teile[3].slice(2, 4)) throw new Error("ungueltiger Schluessel");
    return resolve(basis, schluessel);
  }

  // lstat prueft jeden Bestandteil, nicht nur das Dateiende (auch Windows-Junctions).
  async function pruefePfad(ziel: string): Promise<boolean> {
    const teile = relative(basis, ziel).split(sep).filter(Boolean);
    let aktuell = basis;
    for (let i = -1; i < teile.length; i++) {
      if (i >= 0) aktuell = join(aktuell, teile[i]);
      let status;
      try { status = await fs.lstat(aktuell); }
      catch (e) { if (istFehler(e, "ENOENT")) return false; throw e; }
      if (status.isSymbolicLink() || (i < teile.length - 1 ? !status.isDirectory() : !status.isFile())) throw new Error("ungueltiger Schluessel: verlinkter oder falscher Pfadtyp");
    }
    return true;
  }

  async function ordnerAnlegen(ziel: string): Promise<void> {
    await fs.mkdir(basis, { recursive: true });
    let aktuell = basis;
    const teile = relative(basis, ziel).split(sep).filter(Boolean);
    for (let i = -1; i < teile.length; i++) {
      if (i >= 0) {
        aktuell = join(aktuell, teile[i]);
        try { await fs.mkdir(aktuell); }
        catch (e) { if (!istFehler(e, "EEXIST")) throw e; }
      }
      const status = await fs.lstat(aktuell);
      if (status.isSymbolicLink() || !status.isDirectory()) throw new Error("ungueltiger Schluessel: verlinktes Verzeichnis");
    }
  }

  async function schreiben(daten: Readable) {
    await ordnerAnlegen(join(basis, "tmp"));
    if ((await belegung()) >= max) throw new Error("Speicher voll");
    const tmp = join(basis, "tmp", randomBytes(12).toString("hex"));
    const hash = createHash("sha256");
    let groesse = 0;
    let publiziertesZiel: string | undefined;
    try {
      await pipeline(daten, new Transform({ transform(teil, _kodierung, weiter) {
        hash.update(teil);
        groesse += teil.length;
        weiter(null, teil);
      } }), createWriteStream(tmp, { flags: "wx", mode: 0o600 }));
      const sha256 = hash.digest("hex");
      const schluessel = `sha256/${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}`;
      const ziel = pfad(schluessel);
      await ordnerAnlegen(dirname(ziel));
      await pruefePfad(ziel);
      await fs.chmod(tmp, 0o440);
      // Hardlink publiziert atomar, ohne ein bestehendes Ziel zu ueberschreiben.
      try { await fs.link(tmp, ziel); publiziertesZiel = ziel; }
      catch (e) {
        if (!istFehler(e, "EEXIST")) throw e;
        if (!(await pruefePfad(ziel))) throw e;
      }
      return { schluessel, sha256, groesse };
    } finally {
      try { await fs.unlink(tmp); }
      catch (e) {
        if (!istFehler(e, "ENOENT")) {
          if (process.platform !== "win32" || !istFehler(e, "EPERM")) throw e;
          // Windows hebt beim Loeschen eines Read-only-Hardlinks auch das Flag
          // des Ziels auf; nach dem Unlink daher zwingend wieder schuetzen.
          try { await fs.chmod(tmp, 0o600); await fs.unlink(tmp); }
          finally { if (publiziertesZiel) await fs.chmod(publiziertesZiel, 0o440); }
        }
      }
    }
  }

  return {
    async schreibeNeu(daten) {
      if (!opts.pool) return schreiben(daten);
      const c = await opts.pool.connect();
      let gesperrt = false;
      try {
        await c.query("select pg_advisory_lock_shared($1)", [GC_LOCK]);
        gesperrt = true;
        return await schreiben(daten);
      } finally {
        try { if (gesperrt) await c.query("select pg_advisory_unlock_shared($1)", [GC_LOCK]); }
        finally { c.release(); }
      }
    },
    lese(schluessel, range) {
      const ziel = pfad(schluessel);
      return Readable.from((async function* () {
        await pruefePfad(ziel);
        const datei = await fs.open(ziel, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try { yield* datei.createReadStream({ autoClose: false, ...(range ? { start: range.start, end: range.ende } : {}) }); }
        finally { await datei.close(); }
      })());
    },
    async existiert(schluessel) { return pruefePfad(pfad(schluessel)); },
    async entferne(schluessel) {
      const ziel = pfad(schluessel);
      if (!(await pruefePfad(ziel))) return;
      await fs.chmod(ziel, 0o640);
      await fs.rm(ziel, { force: true });
    },
  };
}
