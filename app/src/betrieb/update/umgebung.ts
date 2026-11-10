import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { composeArgs, letzteZeile, mussGelingen, sql, type Ausfuehrer, type InstanzPfad } from "./docker.js";
import { dbSperre } from "./sperre.js";
import { atomar, type Betriebsumgebung, type Zustand } from "./zustand.js";
import { composeDateien, dockerInstallUmgebung, ladeUndPruefeImages } from "../install/install.js";
import { instanzPfade, leseEnv, schreibeEnv } from "../install/plan.js";
import { kanonisch, pruefeKompatibilitaet, pruefeRelease } from "../release.js";
import { backupKonfigurieren } from "../install/backup.js";
import { restoreHost } from "../restore/host.js";

const text = (s: string) => `'${s.replace(/'/g, "''")}'`;
export function dockerBetriebsumgebung(docker: Ausfuehrer, instanz: string, altesBundle: string): Betriebsumgebung {
  const pfade = instanzPfade(instanz);
  let bundle = altesBundle;
  const i = (): InstanzPfad => ({ projekt: `planora-${instanz}`, envDatei: pfade.envDatei, composeDateien: composeDateien(bundle) });
  const compose = (args: string[], timeoutMs = 600_000, eingabe?: string) => mussGelingen(docker, [...composeArgs(i()), ...args], { timeoutMs, eingabe });
  const db = (befehl: string, rolle = "planora_betrieb") => sql(docker, i(), rolle, befehl);
  const releasePruefen = (z: Zustand) => {
    const r = pruefeRelease(readFileSync(join(z.bundle, "release.json"), "utf8"), readFileSync(pfade.schluessel, "utf8"));
    if (kanonisch(r) !== kanonisch(z.release)) throw new Error("Bundle-Manifest seit Update-Beginn geaendert");
    return r;
  };
  const setzeImages = (z: Zustand) => {
    const w: Record<string, string> = { ...z.altEnv, PLANORA_RELEASE: z.release.version, PLANORA_BUNDLE_DIR: z.bundle, PLANORA_RECOVERY_BUNDLE_DIR: z.bundle };
    for (const img of z.release.images) w[img.dienst === "backup" ? "PLANORA_BACKUP_IMAGE" : `PLANORA_IMAGE_${img.dienst.toUpperCase()}`] = img.referenz;
    schreibeEnv(pfade.envDatei, w); bundle = z.bundle;
    if (w.PLANORA_BACKUP_ENV) backupKonfigurieren(instanz, JSON.parse(readFileSync(join(pfade.etc, "backup/konfiguration.json"), "utf8")).instanzId);
  };
  const starte = async (dienste: string[]) => { await compose(["up", "-d", "--no-deps", "--pull", "never", "--wait", "--wait-timeout", "180", ...dienste]); };
  const health = async (erwartet: string, wartung: boolean) => {
    const r = await compose(["exec", "-T", "api", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(async r=>{if(!r.ok)process.exit(1);console.log(JSON.stringify(await r.json()))}).catch(()=>process.exit(1))"], 30_000);
    const h = JSON.parse(letzteZeile(r.stdout));
    if (!h.ok || !h.db || h.release !== erwartet || h.wartung !== wartung) throw new Error("Health-Smoke meldet falschen Release-/Wartungsstand");
  };
  return {
    sperren: () => dbSperre(i()),
    async vorpruefen(z) {
      releasePruefen(z);
      for (const f of ["compose.yaml", "Caddyfile", "wartung.html"]) if (!existsSync(join(z.bundle, f))) throw new Error(`Bundle unvollstaendig: ${f}`);
      // Nichttransaktionale Schritte sind im M1a-Migrator noch nicht sicher wiederaufnehmbar: geschlossen ablehnen.
      if (z.release.matrix.nichttransaktionaleSchritte.length) throw new Error("Nichttransaktionale Migrationen werden von diesem Werkzeug noch nicht unterstuetzt");
      const dbImage = z.release.images.find((x) => x.dienst === "db");
      if (dbImage) {
        const id = (await compose(["ps", "-q", "db"])).stdout.trim();
        const aktuell = (await mussGelingen(docker, ["inspect", id, "--format", "{{.Image}}"])).stdout.trim();
        if (aktuell !== dbImage.imageId) throw new Error("DB-Image-Wechsel braucht eigenen Wartungsvorgang; App-Update abgelehnt");
      }
      const p = await dockerInstallUmgebung(docker, pfade.var).plattform();
      if (p.freiBytes < 20 * 2 ** 30) throw new Error("Update braucht mindestens 20 GiB freien Platz");
      const migrationen = JSON.parse(await db("select coalesce(json_agg(json_build_object('name',name,'sha256',pruefsumme) order by name),'[]') from migration_journal"));
      const fehler = pruefeKompatibilitaet(z.release, { version: z.altEnv.PLANORA_RELEASE, architektur: p.architektur, schemaVersion: migrationen.at(-1)?.name ?? "", migrationen });
      if (fehler.length) throw new Error(fehler.join("; "));
      const frisch = await db("select coalesce(max(start) > now() - interval '24 hours' and max(start) <= now(),false) from backup_lauf where zustand='geprueft'");
      if (frisch !== "t") throw new Error("Kein gepruefter Sicherungssatz juenger als 24 Stunden");
      const wartung = await db("select wert from instanz_einstellung where schluessel='wartung'");
      if (wartung !== "false") throw new Error("Instanz ist bereits in Wartung; vor neuem Update Ursache klaeren");
      if (await db("select coalesce((select wert from instanz_einstellung where schluessel='restore_gesperrt'),'false'::jsonb)") !== "false") throw new Error("Host-Freigabe nach Restore fehlt");
      // Backup-Service muss vorhanden sein; kein Update, das erst nach dem Stopp seine fehlende Sicherung entdeckt.
      if (!composeDateien(z.bundle).some((f) => f.endsWith("compose.backup.yaml"))) throw new Error("Backup-Overlay fehlt im Bundle");
    },
    async wartung(aktiv) {
      if (aktiv) {
        await db("select setze_wartung(true)");
        await compose(["exec", "-T", "proxy", "sh", "-c", "mkdir -p /data/wartung && touch /data/wartung/aktiv"]);
      } else {
        // Erst Proxy wieder routen lassen; DB bleibt waehrenddessen als Mutationsschranke geschlossen.
        await compose(["exec", "-T", "proxy", "rm", "-f", "/data/wartung/aktiv"]);
        await db("select setze_wartung(false)");
      }
    },
    async stoppen() {
      await compose(["stop", "-t", process.env.PLANORA_TEST_STOPP_SEKUNDEN ?? "60", "api", "worker"], 180_000);
      // Compose beendet nach der Grace-Zeit mit SIGKILL; explizit bestaetigen, dass kein Prozess mehr lebt.
      const laufend = (await compose(["ps", "--status", "running", "-q", "api", "worker"])).stdout.trim();
      if (laufend) throw new Error("App-/Worker-Container laufen nach Stopp noch");
      // pg_stat_activity ist absichtlich ueber den lokalen Host-Socket lesbar, nicht ueber App-Credentials.
      const verbindungen = Number(await db("select count(*) from pg_stat_activity where usename='planora_app'", "postgres"));
      if (verbindungen !== 0) throw new Error(`Nach Stopp noch ${verbindungen} App-Verbindungen`);
    },
    async backup() {
      const r = await compose(["--profile", "betrieb", "run", "--pull", "never", "--rm", "-T", "--no-deps", "backup", "sichern", "--anlass", "update"], 7_200_000);
      const b = JSON.parse(letzteZeile(r.stdout));
      if (b.zustand !== "geprueft" || !/^[0-9a-f-]{36}$/.test(b.backupId ?? "")) throw new Error("Backup ohne geprueften Sicherungssatz");
      const zustand = await db(`select zustand from backup_lauf where id=${text(b.backupId)}::uuid`);
      if (zustand !== "geprueft") throw new Error("Backup-JSON stimmt nicht mit DB-Zustand ueberein");
      return b.backupId;
    },
    async laden(z) {
      releasePruefen(z);
      await ladeUndPruefeImages(z.release, z.bundle, dockerInstallUmgebung(docker, pfade.var), z.release.images.filter((x) => x.dienst !== "clamav" || x.archiv).map((x) => x.dienst));
    },
    async migrieren(z) {
      releasePruefen(z); setzeImages(z);
      // Einmaliger Migrator; sein eigener DB-Advisory-Lock und Journal machen erneute Starts idempotent.
      await compose(["run", "--pull", "never", "--rm", "-T", "--no-deps", "migrator"], 3_600_000);
      const migrationen = JSON.parse(await db("select coalesce(json_agg(json_build_object('name',name,'sha256',pruefsumme) order by name),'[]') from migration_journal"));
      if (kanonisch(migrationen) !== kanonisch(z.release.migrationen)) throw new Error("Migrationsjournal weicht vom Release-Manifest ab");
    },
    async startenUndPruefen(z) {
      releasePruefen(z); setzeImages(z);
      await starte(["api"]); await health(z.release.version, true);
      await compose(["exec", "-T", "api", "node", "dist/start/smoke.js"], 120_000, JSON.stringify({ modulmanifestVersion: z.release.modulmanifestVersion }));
      await starte(["worker"]);
      await starte(["proxy"]);
      await health(z.release.version, true);
    },
    async freigeben(z) {
      // Auch nach Crash in Schritt 7: neuen Code/Health pruefen, dann dieselbe Freigabe idempotent beenden.
      setzeImages(z);
      const flag = await db("select wert from instanz_einstellung where schluessel='wartung'");
      if (flag === "true") {
        await health(z.release.version, true);
        await db(`select betrieb_ereignis('update.freigabe', jsonb_build_object('updateId',${text(z.id)},'release',${text(z.release.version)}))`);
        await compose(["exec", "-T", "proxy", "rm", "-f", "/data/wartung/aktiv"]);
        await db("select setze_wartung(false)");
      } else if (flag !== "false") throw new Error("Wartungsflag ungueltig");
      await health(z.release.version, false);
      copyFileSync(join(z.bundle, "release.json"), join(pfade.etc, "release.json"));
    },
    async zurueck(z, modus) {
      if (modus === "restore") {
        atomar(join(pfade.var, "restore-auftrag.json"), { backupId: z.backupId, updateId: z.id, instanz: z.instanz });
        const alt = pruefeRelease(readFileSync(join(z.altesBundle, "release.json"), "utf8"), readFileSync(pfade.schluessel, "utf8"));
        if (alt.version !== z.altEnv.PLANORA_RELEASE) throw new Error("Altes Release passt nicht zum Restore-Auftrag");
        await compose(["stop", "journal"]);
        await restoreHost(docker, i(), instanz, z.backupId!, z.altesBundle, alt.version, z.altEnv.PLANORA_RECOVERY_BUNDLE_DIR ?? z.altesBundle, z.id);
        bundle = z.altesBundle;
        copyFileSync(join(z.altesBundle, "release.json"), join(pfade.etc, "release.json"));
        await starte(["api", "worker", "proxy", "journal"]); await health(alt.version, true);
        return;
      }
      const rueckEnv = { ...z.altEnv };
      const schema = await db("select name from migration_journal order by name desc limit 1");
      // Kompatibler Image-Rueckweg laesst Migrationen stehen: der Restore braucht weiterhin deren signiertes Werkzeug.
      if (schema === z.release.schemaVersion) {
        rueckEnv.PLANORA_RECOVERY_BUNDLE_DIR = z.bundle;
        const backup = z.release.images.find((img) => img.dienst === "backup");
        if (backup) rueckEnv.PLANORA_BACKUP_IMAGE = backup.referenz;
      }
      schreibeEnv(pfade.envDatei, rueckEnv); bundle = z.altesBundle;
      if (z.altEnv.PLANORA_BACKUP_ENV) backupKonfigurieren(instanz, JSON.parse(readFileSync(join(pfade.etc, "backup/konfiguration.json"), "utf8")).instanzId);
      await starte(["api", "worker", "proxy"]); await health(z.altEnv.PLANORA_RELEASE, true);
    },
    async audit(art, z) { await db(`select betrieb_ereignis(${text(art)}, jsonb_build_object('updateId',${text(z.id)},'release',${text(z.release.version)},'backupId',${text(z.backupId ?? "")}))`); },
  };
}
