// Frische Zieldatenbank im bestehenden Cluster; die bisherige DB und ihre Daten bleiben erhalten.
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { backupKonfigurieren, lesbarFuerBackup } from "../install/backup.js";
import { instanzPfade, leseEnv, restauriereSecrets, schreibeAtomar, schreibeEnv } from "../install/plan.js";
import { pruefeInventar } from "../backup/inventar.js";
import { composeArgs, imageId, letzteZeile, mussGelingen, sql, type Ausfuehrer, type InstanzPfad } from "../update/docker.js";
import { pruefeRelease } from "../release.js";

export async function restoreHost(docker: Ausfuehrer, i: InstanzPfad, instanz: string, backupId: string, bundle: string, release: string, schemaBundle = bundle, auftragId: string = randomUUID()) {
  if (![backupId, auftragId].every((id) => /^[0-9a-f-]{36}$/i.test(id))) throw new Error("Ungueltige Backup-/Auftrags-ID");
  const key = process.env.PLANORA_RECOVERY_DATEI;
  if (!key || !existsSync(key)) throw new Error("Offline-Recovery-Key ueber PLANORA_RECOVERY_DATEI bereitstellen; Instanz bleibt geschlossen");
  const p = instanzPfade(instanz), env = leseEnv(p.envDatei), d = join(p.etc, "backup");
  const manifest = pruefeRelease(readFileSync(join(bundle, "release.json"), "utf8"), readFileSync(p.schluessel, "utf8"));
  const recovery = pruefeRelease(readFileSync(join(schemaBundle, "release.json"), "utf8"), readFileSync(p.schluessel, "utf8"));
  if (recovery.version !== release && !recovery.matrix.rueckwegAltesImage.includes(release)) throw new Error("Recovery-Schema ist laut signierter Matrix nicht mit dem App-Release kompatibel");
  const backupImage = recovery.images.find((img) => img.dienst === "backup");
  if (manifest.version !== release || !backupImage || await imageId(docker, backupImage.referenz) !== backupImage.imageId) throw new Error("Restore-Release oder Backup-Image nicht nachgewiesen");
  if (!env.PLANORA_BACKUP_ENV) throw new Error("Externe Backup-Konfiguration fehlt");
  const instanzId = JSON.parse(readFileSync(join(d, "konfiguration.json"), "utf8")).instanzId;
  const auftrag = join(p.var, `restore-${auftragId}.json`);
  let stand: { datenbank: string; fertig: boolean };
  if (existsSync(auftrag)) stand = JSON.parse(readFileSync(auftrag, "utf8"));
  else { stand = { datenbank: `planora_restore_${randomBytes(10).toString("hex")}`, fertig: false }; schreibeAtomar(auftrag, JSON.stringify(stand)); }
  if (!/^planora_restore_[a-f0-9]{20}$/.test(stand.datenbank)) throw new Error("Restore-Auftrag ungueltig");
  const zielDb = stand.datenbank;
  if (!stand.fertig) {
    const temp = join(p.var, `recovery-${randomUUID()}`); mkdirSync(temp, { recursive: true, mode: 0o700 }); lesbarFuerBackup(temp, true);
    const rolle = `recovery_${randomBytes(10).toString("hex")}`, passwort = randomBytes(32).toString("hex");
    let rolleErzeugt = false;
    const hostSql = async (befehl: string, datenbank = "postgres") => {
      // SQL auf stdin, damit Geheimnisse weder Prozessargumente noch Fehlermeldungen fuellen.
      const r = await docker([...composeArgs(i), "exec", "-T", "db", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", datenbank], { eingabe: befehl, timeoutMs: 120_000 });
      if (r.code !== 0) throw new Error("Recovery-Provisionierung fehlgeschlagen; bisherige Datenbank bleibt erhalten");
    };
    try {
      // Bei einem fehlgeschlagenen Import dieselbe frische DB nie loeschen oder erneut importieren.
      const vorhanden = await sql(docker, i, "postgres", `select count(*) from pg_database where datname='${zielDb}'`);
      if (vorhanden !== "0") throw new Error(`Restore-Ziel ${zielDb} existiert bereits; erhaltene Daten pruefen und fuer neuen Versuch einen neuen Restore-Auftrag anlegen`);
      await hostSql(`create role ${rolle} login createrole password '${passwort}';\n`); rolleErzeugt = true;
      await hostSql(`grant pg_read_all_data to ${rolle} with admin true;\n${["app", "backup", "betrieb", "migrator"].map((r) => `grant planora_${r} to ${rolle} with admin true, inherit false, set false;`).join("\n")}\ncreate database ${zielDb} owner ${rolle};\n`);
      await hostSql("grant usage,create on schema public to planora_owner;", zielDb);
      copyFileSync(key, join(temp, "recovery.key")); lesbarFuerBackup(join(temp, "recovery.key"));
      const recoveryDatei = join(d, "recovery_db");
      schreibeAtomar(recoveryDatei, `postgres://${rolle}:${passwort}@db:5432/${zielDb}`); lesbarFuerBackup(recoveryDatei);
      const envDatei = join(temp, "instanz.env");
      schreibeEnv(envDatei, { ...env, PLANORA_RELEASE: release, PLANORA_BACKUP_IMAGE: backupImage.referenz, PLANORA_RECOVERY_DATEI: join(temp, "recovery.key"), PLANORA_RESTORE_AUSGABE: temp });
      const ziel: InstanzPfad = { ...i, envDatei, composeDateien: [join(bundle, "compose.yaml"), join(bundle, "compose.backup.yaml")] };
      const r = await mussGelingen(docker, [...composeArgs(ziel), "run", "--pull", "never", "--rm", "-T", "--no-deps",
        "-e", "PLANORA_ROLLEN_DB_FILE=/run/backup/recovery_db", "-e", `PLANORA_RESTORE_DB=postgres://planora_migrator@db:5432/${zielDb}`,
        "-e", "PLANORA_RESTORE_OWNER=planora_owner", "-e", `PLANORA_RELEASE=${release}`, "restore", "restore", backupId, "--instanz-id", instanzId], { timeoutMs: 7_200_000 });
      if (JSON.parse(letzteZeile(r.stdout)).zustand !== "gesperrt") throw new Error("Restore nicht gesperrt abgeschlossen");
      const inventar = JSON.parse(readFileSync(join(temp, "inventar.json"), "utf8")); pruefeInventar(inventar);
      if (inventar.instanzId !== instanzId || !inventar.appSecrets.auth || !inventar.appSecrets.db_superuser_passwort) throw new Error("Restauriertes Host-Inventar unvollstaendig");
      restauriereSecrets(p.secrets, { auth_secret: inventar.appSecrets.auth, db_superuser_passwort: inventar.appSecrets.db_superuser_passwort,
        ...Object.fromEntries(Object.entries(inventar.dbRollen).map(([name, wert]) => [`db_${name.replace('planora_', '')}_passwort`, wert])) });
      schreibeAtomar(join(d, "restic_passwort"), inventar.restic.passwort); lesbarFuerBackup(join(d, "restic_passwort"));
      schreibeAtomar(join(d, "konfiguration.json"), readFileSync(join(temp, "konfiguration.json"), "utf8")); lesbarFuerBackup(join(d, "konfiguration.json"));
      // Schema und Daten gehoeren bereits planora_owner (SET ROLE beim Import).
      // Der begrenzte Recovery-Login wird vor dem Wechsel des laufenden Pakets entfernt.
      await hostSql(`alter database ${zielDb} owner to planora_owner;\nrevoke connect on database ${zielDb} from public;\ngrant connect on database ${zielDb} to planora_app,planora_migrator,planora_backup,planora_betrieb;\n`);
      stand.fertig = true; schreibeAtomar(auftrag, JSON.stringify(stand));
    } finally {
      try {
        if (rolleErzeugt) {
          // Auch nach Fehler kein gueltiger Recovery-Login im erreichbaren Cluster.
          await hostSql(`alter role ${rolle} nologin;\n`);
          if (stand.fertig) {
            // Nur temporaere Grants entfernen; importierte Objekte gehoeren ausschliesslich planora_owner.
            await hostSql(`drop owned by ${rolle};\n`, zielDb);
            await hostSql(`drop role ${rolle};\n`);
          }
        }
      } finally {
        rmSync(join(d, "recovery_db"), { force: true }); rmSync(temp, { recursive: true, force: true });
      }
    }
  }
  const neu: Record<string, string> = { ...env, PLANORA_DB_NAME: zielDb, PLANORA_RELEASE: release, PLANORA_BUNDLE_DIR: resolve(bundle), PLANORA_RECOVERY_BUNDLE_DIR: resolve(schemaBundle) };
  for (const img of manifest.images) neu[img.dienst === "backup" ? "PLANORA_BACKUP_IMAGE" : `PLANORA_IMAGE_${img.dienst.toUpperCase()}`] = img.referenz;
  neu.PLANORA_BACKUP_IMAGE = backupImage.referenz;
  schreibeEnv(p.envDatei, neu); backupKonfigurieren(instanz, instanzId, release, zielDb);
  return { datenbank: zielDb, vorherDatenbank: env.PLANORA_DB_NAME ?? "planora", zustand: "gesperrt" };
}
