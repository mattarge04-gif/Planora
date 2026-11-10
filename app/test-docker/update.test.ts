// Echter N-1 -> N-Lauf: Installationsadapter, Host-Update, neue Migration, haengender Worker, Rueckweg und Resume.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { closeSync, cpSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { APP, BETRIEB, DOCKER_TESTS, TEST, baueImage, docker, https } from "./paket-hilfe.js";
import { dockerAusfuehrer, dockerBinary } from "../src/betrieb/update/docker.js";
import { reconcileHost } from "../src/betrieb/host.js";
import { dockerInstallUmgebung, installiere } from "../src/betrieb/install/install.js";
import { instanzPfade, leseEnv } from "../src/betrieb/install/plan.js";
import { MANIFEST_VERSION } from "../src/module/manifest.js";
import { erzeugeRelease, signiereRelease } from "../src/betrieb/release.js";
import { aktualisiere, leseZustand } from "../src/betrieb/update/zustand.js";
import { dockerBetriebsumgebung } from "../src/betrieb/update/umgebung.js";
import { composeArgs, mussGelingen, sql, type InstanzPfad } from "../src/betrieb/update/docker.js";
import { dbSperre } from "../src/betrieb/update/sperre.js";

describe.skipIf(!DOCKER_TESTS)("Host-Update (Docker)", () => {
  let dir: string, alt: Record<string, string | undefined>, altBundle: string, neuBundle: string, restoreBundle: string, recoveryKey: string, instanz: string, i: InstanzPfad, basis: string;
  const aus = dockerAusfuehrer();
  let angelegt = false;
  let testSperre: number | undefined;
  const testSperrPfad = join(tmpdir(), `planora-updatetest-${TEST.projekt}.lock`);
  const compose = (args: string[], eingabe?: string) => mussGelingen(aus, [...composeArgs(i), ...args], { eingabe, timeoutMs: 300_000 });
  const db = (b: string, rolle = "postgres") => sql(aus, i, rolle, b);
  const opt = () => {
    const p = instanzPfade(instanz), altEnv = leseEnv(p.envDatei);
    return { datei: p.zustand, sperre: p.sperre, neu: { instanz, bundle: neuBundle, altesBundle: altBundle, altEnv, release: JSON.parse(readFileSync(join(neuBundle, "release.json"), "utf8")).release } };
  };
  const umgebung = () => dockerBetriebsumgebung(aus, instanz, altBundle);
  beforeAll(async () => {
    testSperre = openSync(testSperrPfad, "wx", 0o600);
    dir = mkdtempSync(join(tmpdir(), "planora-update-docker-"));
    alt = Object.fromEntries(["PLANORA_ETC", "PLANORA_VAR", "PLANORA_TEST_STOPP_SEKUNDEN", "PLANORA_RECOVERY_DATEI"].map((k) => [k, process.env[k]]));
    process.env.PLANORA_ETC = join(dir, "etc"); process.env.PLANORA_VAR = join(dir, "var"); process.env.PLANORA_TEST_STOPP_SEKUNDEN = "2";
    instanz = `${TEST.projekt.replace(/^planora-/, "")}-u`;
    basis = `https://localhost:${TEST.httpsPort + 1}`;
    const kontext = join(dir, "app"); mkdirSync(kontext);
    for (const f of ["package.json", "package-lock.json", "Dockerfile", ".dockerignore"]) cpSync(join(APP, f), join(kontext, f));
    cpSync(join(APP, "src"), join(kontext, "src"), { recursive: true });
    const image1 = await baueImage(TEST.tag(11), "update-1", kontext);
    const backupKontext = join(dir, "backup-kontext"); mkdirSync(backupKontext); cpSync(kontext, join(backupKontext,"app"), { recursive:true });
    cpSync(join(APP,"tsconfig.json"),join(backupKontext,"app/tsconfig.json"));
    const backup1 = await baueImage(TEST.tag(21), "update-1", backupKontext, join(BETRIEB,"backup/Dockerfile"));
    recoveryKey = join(dir, "offline.key");
    await docker(["run","--rm","--entrypoint","age-keygen","--mount",`type=bind,source=${dir},target=/ausgabe`,backup1.referenz,"-o","/ausgabe/offline.key"]);
    const empfaenger = (await docker(["run","--rm","--entrypoint","age-keygen","--mount",`type=bind,source=${dir},target=/ausgabe,readonly`,backup1.referenz,"-y","/ausgabe/offline.key"])).stdout.trim();
    writeFileSync(join(kontext, "src/db/migrationen/011_updateprobe.sql"), "create table update_probe(id int primary key, wert text); grant select on update_probe to planora_app;\n");
    const image2 = await baueImage(TEST.tag(12), "update-2", kontext);
    cpSync(join(kontext,"src"), join(backupKontext,"app/src"), { recursive:true });
    const backup2 = await baueImage(TEST.tag(22), "update-2", backupKontext, join(BETRIEB,"backup/Dockerfile"));
    const key = generateKeyPairSync("ed25519"), privat = key.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const pub = join(dir, "release.pub"); writeFileSync(pub, key.publicKey.export({ type: "spki", format: "pem" }));
    const caddy = "caddy:2.11.9-alpine@sha256:78bd35025c7ba85961dd149ae670315129954e77abe2383ac47c89106b35ade9";
    const pg = "postgres:18.6-bookworm@sha256:f1ea2a1a4fb7b68d4836be1fdcb8a6466a89b072158bf9d97663600538c294c5";
    const caddyId = (await docker(["image", "inspect", caddy, "--format", "{{.Id}}"])).stdout.trim();
    const pgId = (await docker(["image", "inspect", pg, "--format", "{{.Id}}"])).stdout.trim();
    const bundle = (name: string, image: typeof image1, migrationen: string, von: string[]) => {
      const b = join(dir, name); mkdirSync(b);
      for (const f of ["compose.yaml", "Caddyfile", "wartung.html", "planora-betrieb@.service", "planora-sicherung@.service", "planora-sicherung@.timer"]) cpSync(join(BETRIEB, f), join(b, f));
      cpSync(join(BETRIEB,"compose.backup.yaml"), join(b,"compose.backup.yaml"));
      // Nur der Worker haengt absichtlich; Sicherung und Restore sind echte Services.
      writeFileSync(join(b,"compose.worker.yaml"), JSON.stringify({services:{worker:{command:["node","-e","process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"]}}}));
      const r = erzeugeRelease({ version: name, architektur: "amd64", migrationsVerzeichnis: migrationen, modulmanifestVersion: MANIFEST_VERSION, vonVersionen: von, schemaVorher: ["010_admin_restore.sql", "011_updateprobe.sql"], rueckwegAltesImage: von,
        images: [
          { dienst:"backup", ...(name === "update-1" ? backup1 : backup2), digest:null, architektur:"amd64" },
          { dienst: "app", referenz: image.referenz, digest: null, imageId: image.imageId, architektur: "amd64" },
          { dienst: "db", referenz: pg, digest: pg.split("@")[1], imageId: pgId, architektur: "amd64" },
          { dienst: "proxy", referenz: caddy, digest: caddy.split("@")[1], imageId: caddyId, architektur: "amd64" },
        ] });
      writeFileSync(join(b, "release.json"), JSON.stringify(signiereRelease(r, privat))); return b;
    };
    altBundle = bundle("update-1", image1, join(APP, "src/db/migrationen"), []);
    neuBundle = bundle("update-2", image2, join(kontext, "src/db/migrationen"), ["update-1"]);
    restoreBundle = join(dir,"inkompatibel"); cpSync(neuBundle,restoreBundle,{recursive:true});
    const inkompatibel = JSON.parse(readFileSync(join(neuBundle,"release.json"),"utf8")).release;
    inkompatibel.matrix.rueckwegAltesImage = [];
    writeFileSync(join(restoreBundle,"release.json"),JSON.stringify(signiereRelease(inkompatibel,privat)));
    // Installation prueft Projekt/Volumes/Netze VOR der ersten Mutation. Cleanup nur bei erfolgreicher Kollisionpruefung.
    const echt = dockerInstallUmgebung(aus, dir);
    const starte = echt.starte;
    echt.starte = async (x) => { i = x; angelegt = true; await starte(x); };
    await installiere({ instanz, domain: "localhost", tls: "internal", httpsPort: TEST.httpsPort + 1, httpPort: TEST.httpPort + 1, bundle: altBundle, schluessel: pub, backupZiel: join(dir,"ziel"), recoveryEmpfaenger: empfaenger }, echt);
    await compose(["run","--rm","-T","backup","sichern","--anlass","erstsicherung"]);
    await db("insert into liegenschaft(id,name) values('33333333-3333-4333-8333-333333333333','Update-Daten')");
  });
  afterAll(async () => {
    if (angelegt) await compose(["--profile", "konsole", "--profile", "betrieb", "down", "-t", "2", "-v", "--remove-orphans"]).catch(() => {});
    if (alt) for (const [k, v] of Object.entries(alt)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (dir) rmSync(dir, { recursive: true, force: true });
    if (testSperre !== undefined) { closeSync(testSperre); unlinkSync(testSperrPfad); }
  });
  it("DB-Advisory-Lock: paralleler Update abgelehnt, Backend-Verlust erkannt", async () => {
    const lock = await dbSperre(i);
    try {
      await expect(dbSperre(i)).rejects.toThrow(/Anderer Update/);
      await db("select pg_terminate_backend(pid) from pg_locks where locktype='advisory' and objid=7310003 and pid<>pg_backend_pid()");
      await expect(lock.pruefen()).rejects.toThrow(/Updatesperre/);
    } finally { await lock.loesen(); }
  });
  it("Host-Reconcile laesst laufende Backups stehen und erkennt einen hart beendeten echten Dump", async () => {
    const name = `${i.projekt}-abbruch`;
    const sperre = spawn(dockerBinary(), [...composeArgs(i), "exec", "-T", "db", "psql", "-X", "-qAt", "-U", "postgres", "-d", "planora"], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const geschlossen = new Promise<void>((ok) => sperre.once("close", () => ok()));
    let backup: Promise<number> | undefined;
    try {
      await new Promise<void>((ok, fehler) => {
        const zeit = setTimeout(() => fehler(new Error("Tabellenlock nicht bereit")), 10_000);
        sperre.stdout.on("data", (d) => { if (d.toString().includes("LOCK_BEREIT")) { clearTimeout(zeit); ok(); } });
        sperre.once("error", fehler);
        sperre.stdin.write("begin;lock table liegenschaft in access exclusive mode;select 'LOCK_BEREIT';\n");
      });
      const vorher = JSON.parse(await db("select coalesce(json_agg(id),'[]') from backup_lauf"));
      backup = compose(["run", "--rm", "-T", "--name", name, "backup", "sichern", "--anlass", "abbruchtest"]).then(() => 0, () => 1);
      let wartet = false;
      for (let n = 0; n < 200; n++) {
        if (await db("select count(*) from pg_stat_activity where application_name='pg_dump' and wait_event_type='Lock'") !== "0") { wartet = true; break; }
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(wartet).toBe(true);
      const ids = JSON.parse(await db("select coalesce(json_agg(id),'[]') from backup_lauf")) as string[];
      const id = ids.find((x) => !vorher.includes(x)); expect(id).toBeTruthy();
      await db(`update backup_lauf set heartbeat=now()-interval '11 minutes' where id='${id}'`);
      expect(JSON.parse((await reconcileHost(aus, i)).stdout).fehlgeschlagen).toBe(0);
      await docker(["kill", name]); expect(await backup).toBe(1);
      expect(JSON.parse((await reconcileHost(aus, i)).stdout).fehlgeschlagen).toBe(1);
      expect(await db(`select zustand from backup_lauf where id='${id}'`)).toBe("fehlgeschlagen");
    } finally {
      sperre.stdin.end("rollback;\n\\q\n"); await geschlossen; await backup;
    }
    expect(JSON.parse((await compose(["run", "--rm", "-T", "backup", "sichern", "--anlass", "nach-abbruch"])).stdout.trim().split("\n").at(-1)!).zustand).toBe("geprueft");
  });
  it("inkompatible Migration: Offline-Key, frisches Ziel, Journal und Worker-Sperre bis Host-Freigabe", async () => {
    const adminPw = randomBytes(18).toString("hex");
    await compose(["run","--rm","-T","konsole","erstadmin"], JSON.stringify({token:await dockerInstallUmgebung(aus,dir).setupToken(i),email:"restore@planora.test",name:"Restore-Admin",passwort:adminPw}));
    const o = opt(); o.neu.bundle = restoreBundle; o.neu.release = JSON.parse(readFileSync(join(restoreBundle,"release.json"),"utf8")).release;
    const u = dockerBetriebsumgebung(aus,instanz,altBundle), start = u.startenUndPruefen;
    u.startenUndPruefen = async(z) => { await start(z); throw new Error("Restore-Testabbruch"); };
    await expect(aktualisiere(o,u)).rejects.toThrow(/Restore-Testabbruch/);
    const rollback = {datei:o.datei,sperre:o.sperre,modus:"rueckweg" as const};
    await expect(aktualisiere(rollback,umgebung())).rejects.toThrow(/Offline-Recovery-Key/);
    process.env.PLANORA_RECOVERY_DATEI = recoveryKey;
    expect((await aktualisiere(rollback,umgebung())).status).toBe("zurueck");
    expect(leseEnv(instanzPfade(instanz).envDatei).PLANORA_DB_NAME).toMatch(/^planora_restore_/);
    expect(await db("select count(*) from pg_database where datname='planora'")).toBe("1");
    expect(await db("select count(*) from migration_journal where name='011_updateprobe.sql'")).toBe("0");
    expect(await db("select wert from instanz_einstellung where schluessel='restore_gesperrt'")).toBe("true");
    expect(await db("select distinct status from konto_status")).toBe("zu_bestaetigen");
    expect((await https(basis,"POST","/api/auth/sign-in/email",{headers:{origin:basis},body:{email:"restore@planora.test",password:adminPw}})).status).toBe(401);
    // Im restaurierten Paket laeuft der echte Worker, kein haengender Testhandler.
    await new Promise(r=>setTimeout(r,1000));
    expect((await compose(["logs","--no-color","worker"])).stdout).toContain('restore_gesperrt');
    // Die interaktiven Host-Schritte werden mit denselben Funktionen ausgeuebt, Tokens/Passwort ausschliesslich stdin.
    await compose(["run","--rm","-T","--entrypoint","node","backup","--input-type=module","-e",`import pg from 'pg';import{geheimnis}from'./dist/betrieb/backup/umgebung.js';import{freigabe,loeseFreigabeTokenEin}from'./dist/betrieb/freigabe.js';const p=new pg.Pool({connectionString:await geheimnis('PLANORA_BETRIEB_DB')});const t=await freigabe(p,{zeige:u=>{if(!u.journal.stand_zeit)throw Error('Journal fehlt')},bestaetige:async()=>true});let pw='';for await(const d of process.stdin)pw+=d;await loeseFreigabeTokenEin(p,t[0].token,pw);await p.end();`], randomBytes(18).toString("hex"));
    expect(await db("select wert from instanz_einstellung where schluessel='restore_gesperrt'")).toBe("false");
    await compose(["run","--rm","-T","backup","sichern","--anlass","nach-restore"]);
  });
  it("Abbruch nach Migration: Wartung bleibt, kompatibles altes Image startet verlustfrei", async () => {
    const o = opt(), f = umgebung(), start = f.startenUndPruefen;
    f.startenUndPruefen = async (z) => { await start(z); throw new Error("Testabbruch vor Freigabe"); };
    await expect(aktualisiere(o, f)).rejects.toThrow(/Testabbruch/);
    expect(leseZustand(o.datei)).toMatchObject({ bestaetigt: 5, begonnen: 6 });
    expect((await https(basis, "GET", "/api/ich")).status).toBe(503);
    expect(await db("select wert from instanz_einstellung where schluessel='wartung'")).toBe("true");
    const zurueck = await aktualisiere({ datei: o.datei, sperre: o.sperre, modus: "rueckweg" }, umgebung());
    expect(zurueck.status).toBe("zurueck");
    expect((await https(basis, "GET", "/api/health")).json()).toMatchObject({ release: "update-1", wartung: false });
    expect(await db("select name from liegenschaft where id='33333333-3333-4333-8333-333333333333'")).toBe("Update-Daten");
    expect(leseEnv(instanzPfade(instanz).envDatei).PLANORA_RECOVERY_BUNDLE_DIR).toBe(neuBundle);
    const backup = JSON.parse((await compose(["run", "--rm", "-T", "backup", "sichern", "--anlass", "kompatibler-rueckweg"])).stdout.trim().split("\n").at(-1)!);
    // Das passende signierte Recovery-Image muss auch unter dem alten App-Release den neuen Schema-Stand pruefen koennen.
    await compose(["run", "--rm", "-T", "--entrypoint", "node", "backup", "--input-type=module", "-e", `import{execFileSync as run}from'node:child_process';import{geheimnis}from'./dist/betrieb/backup/umgebung.js';import{aktuellesSchema}from'./dist/betrieb/restore/cli.js';import{pruefeRestoreManifest}from'./dist/betrieb/restore/restore.js';const env={...process.env,RESTIC_PASSWORD:await geheimnis('RESTIC_PASSWORD')};const s=JSON.parse(run('restic',['snapshots','--json','--tag','${backup.backupId}'],{env}))[0];const m=JSON.parse(run('restic',['dump',s.id,s.paths[0]+'/manifest.json'],{env}));pruefeRestoreManifest(m,{backupId:'${backup.backupId}',instanzId:m.instanzId,release:'update-1',schema:await aktuellesSchema()},s.paths[0]);`]);
  });
  it("N-1 -> N: Host-Installation, erzwungener Worker-Stopp, Backup-Vertrag, neue Migration, Smoke und Freigabe", async () => {
    i.composeDateien.push(join(altBundle,"compose.worker.yaml"));
    await compose(["up","-d","--no-deps","worker"]);
    const o = opt(), vorher = (await compose(["ps", "-q", "worker"])).stdout.trim();
    const f = umgebung(), stop = f.stoppen;
    let exitCode: number | undefined;
    f.stoppen = async (z) => { await stop(z); exitCode = Number((await docker(["inspect", vorher, "--format", "{{.State.ExitCode}}"])).stdout.trim()); };
    const start = f.startenUndPruefen;
    f.startenUndPruefen = async (z) => { await start(z); throw new Error("Testabbruch fuer Wiederaufnahme"); };
    await expect(aktualisiere(o, f)).rejects.toThrow(/Testabbruch fuer Wiederaufnahme/);
    expect((await aktualisiere({ datei: o.datei, sperre: o.sperre, modus: "fortsetzen" }, umgebung())).status).toBe("fertig");
    expect(exitCode).toBe(137); // Der haengende Handler ist durch Prozessende beendet.
    expect((await https(basis, "GET", "/api/health")).json()).toMatchObject({ release: "update-2", wartung: false });
    expect(await db("select name from migration_journal order by name desc limit 1")).toBe("011_updateprobe.sql");
    expect(await db("select name from liegenschaft where id='33333333-3333-4333-8333-333333333333'")).toBe("Update-Daten");
    expect(await db(`select count(*) from "user" where email like 'smoke-%@planora.invalid'`)).toBe("0");
    expect(await db("select count(*) from session")).toBe("0");
  });
});
