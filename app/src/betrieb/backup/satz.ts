import pg from "pg";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { MANIFEST_VERSION } from "../../module/manifest.js";
import { dateiHash, pruefeDatei, quelldatei, snapshotAbgleichen, type Datei, type Manifest } from "./manifest.js";
import { erfolgreich, prozess, type Prozess } from "./prozess.js";
import { pruefeKonfiguration, type Instanzkonfiguration } from "./konfiguration.js";
export type SicherungsOptionen = {
  betrieb: pg.Pool; backupDb: pg.ClientConfig; pgEnv: NodeJS.ProcessEnv;
  resticEnv: NodeJS.ProcessEnv; dokumente: string; staging: string; release: string;
  konfiguration: Instanzkonfiguration; anlass: string; lauf?: Prozess; heartbeatMs?: number;
  jetzt?: () => Date;
};
export async function sichern(o: SicherungsOptionen) {
  if (!o.release) throw new Error("Release fehlt");
  pruefeKonfiguration(o.konfiguration);
  const backupId = randomUUID(), ordner = resolve(o.staging, backupId);
  const lauf = o.lauf ?? prozess, abbruch = new AbortController();
  const exporter = new pg.Client(o.backupDb);
  const ausfall = () => abbruch.abort(new Error("Snapshot-Verbindung ausgefallen"));
  exporter.on("error", ausfall);
  let heartbeat: ReturnType<typeof setInterval> | undefined, heartbeatArbeit = Promise.resolve();
  let registriert = false, verbunden = false;
  const schritt = (programm: string, args: string[], extra = {}) => erfolgreich(lauf, { programm, args, signal: abbruch.signal, ...extra });
  try {
    await o.betrieb.query("select backup_lauf_start($1)", [backupId]); registriert = true;
    heartbeat = setInterval(() => {
      heartbeatArbeit = heartbeatArbeit.then(async () => {
        await o.betrieb.query("select backup_lauf_heartbeat($1)", [backupId]);
      }).catch(() => { abbruch.abort(new Error("Backup-Heartbeat ausgefallen")); });
    }, o.heartbeatMs ?? 60_000);
    await fs.mkdir(ordner, { recursive: true, mode: 0o700 });
    await exporter.connect(); verbunden = true;
    await exporter.query("begin isolation level repeatable read read only");
    const snapshot = (await exporter.query("select pg_export_snapshot() id")).rows[0].id as string;
    const instanzId = (await exporter.query("select wert from instanz_einstellung where schluessel='instanz_id'")).rows[0]?.wert;
    const dateien = (await exporter.query(`select d.schluessel,d.sha256,d.groesse::float8 groesse from datei d where exists
      (select 1 from datei_referenz r where r.schluessel=d.schluessel) order by d.schluessel`)).rows as Datei[];
    const manifest: Manifest = {
      format: 1, backupId, instanzId, release: o.release, modulVersion: MANIFEST_VERSION,
      schema: (await exporter.query("select name,pruefsumme from migration_journal order by name")).rows,
      journalSeq: String((await exporter.query("select seq from journal_zaehler where id=1")).rows[0].seq),
      anlass: o.anlass, satzPfad: ordner.replaceAll("\\", "/"), dateien, bestandteile: [],
    };
    if (!instanzId) throw new Error("Instanz-ID fehlt");
    if (o.konfiguration.instanzId!==instanzId || o.konfiguration.release!==o.release) throw new Error("Instanzkonfiguration passt nicht zur Sicherung");
    // Exporter muss bis zum erfolgreichen Ende des Dumps offen bleiben.
    await schritt("pg_dump", ["-Fc", `--snapshot=${snapshot}`, "--no-password", "--file", join(ordner,"daten.dump")], { env: o.pgEnv });
    await exporter.query("select 1");
    await exporter.query("commit");
    await schritt("pg_dumpall", ["--roles-only", "--no-role-passwords", "--no-password", "--file", join(ordner,"rollen.sql")], { env: o.pgEnv });
    await fs.writeFile(join(ordner,"konfiguration.json"), JSON.stringify(o.konfiguration), { mode: 0o600, flag: "wx" });
    for (const d of dateien) {
      const quelle = await quelldatei(o.dokumente,d), ziel = join(ordner,"dokumente",d.schluessel);
      await fs.mkdir(dirname(ziel), { recursive: true });
      await fs.copyFile(quelle,ziel); await pruefeDatei(ziel,d);
    }
    for (const schluessel of ["daten.dump","rollen.sql","konfiguration.json"]) manifest.bestandteile.push({ schluessel, ...await dateiHash(join(ordner,schluessel)) });
    await fs.writeFile(join(ordner,"manifest.json"), JSON.stringify(manifest), { mode: 0o600, flag: "wx" });
    const ausgabe = await schritt("restic", ["backup", "--json", "--force", "--tag", backupId, ordner], { env: o.resticEnv });
    const zusammenfassung = ausgabe.trim().split("\n").map((z) => JSON.parse(z)).find((z) => z.message_type === "summary");
    const snapshotId: string = zusammenfassung?.snapshot_id;
    if (!/^[0-9a-f]{8,64}$/.test(snapshotId ?? "")) throw new Error("Restic-Snapshot-ID fehlt");
    await o.betrieb.query("select backup_lauf_setze($1,'gesichert')", [backupId]);
    const inhalt = await schritt("restic", ["ls", "--json", snapshotId], { env: o.resticEnv });
    snapshotAbgleichen(inhalt,manifest);
    // [A] Vollpruefung am ersten Monatstag, sonst 5 Prozent (Spec 7.1).
    await schritt("restic", ["check", ...((o.jetzt?.() ?? new Date()).getUTCDate() === 1 ? ["--read-data"] : ["--read-data-subset=5%"] )], { env: o.resticEnv });
    abbruch.signal.throwIfAborted();
    if (heartbeat) clearInterval(heartbeat); await heartbeatArbeit;
    abbruch.signal.throwIfAborted();
    await o.betrieb.query("select backup_lauf_setze($1,'geprueft')", [backupId]);
    return { backupId, zustand: "geprueft" as const };
  } catch (e) {
    if (registriert) await o.betrieb.query("select backup_lauf_setze($1,'fehlgeschlagen')", [backupId]).catch(() => {});
    throw e;
  } finally {
    if (heartbeat) clearInterval(heartbeat); await heartbeatArbeit;
    if (verbunden) await exporter.end().catch(() => {});
    exporter.removeListener("error",ausfall);
    // Nur das fuer diese UUID angelegte Staging entfernen, niemals fremde Saetze.
    await fs.rm(ordner, { recursive: true, force: true });
  }
}
