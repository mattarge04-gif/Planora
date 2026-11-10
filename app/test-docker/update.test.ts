// Echter N-1 -> N-Lauf: Installationsadapter, Host-Update, neue Migration, haengender Worker, Rueckweg und Resume.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP, BETRIEB, DOCKER_TESTS, TEST, baueImage, docker, https, type TestInstanz } from "./paket-hilfe.js";
import { dockerAusfuehrer } from "../src/betrieb/update/docker.js";
import { dockerInstallUmgebung, installiere } from "../src/betrieb/install/install.js";
import { instanzPfade, leseEnv } from "../src/betrieb/install/plan.js";
import { MANIFEST_VERSION } from "../src/module/manifest.js";
import { erzeugeRelease, signiereRelease } from "../src/betrieb/release.js";
import { aktualisiere, leseZustand } from "../src/betrieb/update/zustand.js";
import { dockerBetriebsumgebung } from "../src/betrieb/update/umgebung.js";
import { composeArgs, mussGelingen, sql, type InstanzPfad } from "../src/betrieb/update/docker.js";
import { dbSperre } from "../src/betrieb/update/sperre.js";

describe.skipIf(!DOCKER_TESTS)("Host-Update (Docker)", () => {
  let dir: string, alt: Record<string, string | undefined>, altBundle: string, neuBundle: string, instanz: string, i: InstanzPfad, basis: string;
  const aus = dockerAusfuehrer();
  let angelegt = false;
  const compose = (args: string[], eingabe?: string) => mussGelingen(aus, [...composeArgs(i), ...args], { eingabe, timeoutMs: 300_000 });
  const db = (b: string, rolle = "postgres") => sql(aus, i, rolle, b);
  const opt = () => {
    const p = instanzPfade(instanz), altEnv = leseEnv(p.envDatei);
    return { datei: p.zustand, sperre: p.sperre, neu: { instanz, bundle: neuBundle, altesBundle: altBundle, altEnv, release: JSON.parse(readFileSync(join(neuBundle, "release.json"), "utf8")).release } };
  };
  const umgebung = () => dockerBetriebsumgebung(aus, instanz, altBundle);
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "planora-update-docker-"));
    alt = Object.fromEntries(["PLANORA_ETC", "PLANORA_VAR", "PLANORA_TEST_STOPP_SEKUNDEN"].map((k) => [k, process.env[k]]));
    process.env.PLANORA_ETC = join(dir, "etc"); process.env.PLANORA_VAR = join(dir, "var"); process.env.PLANORA_TEST_STOPP_SEKUNDEN = "2";
    instanz = `${TEST.projekt.replace(/^planora-/, "")}-u`;
    basis = `https://localhost:${TEST.httpsPort + 1}`;
    const kontext = join(dir, "app"); mkdirSync(kontext);
    for (const f of ["package.json", "package-lock.json", "Dockerfile", ".dockerignore"]) cpSync(join(APP, f), join(kontext, f));
    cpSync(join(APP, "src"), join(kontext, "src"), { recursive: true });
    const image1 = await baueImage(TEST.tag(11), "update-1", kontext);
    writeFileSync(join(kontext, "src/db/migrationen/010_updateprobe.sql"), "create table update_probe(id int primary key, wert text); grant select on update_probe to planora_app;\n");
    const image2 = await baueImage(TEST.tag(12), "update-2", kontext);
    const key = generateKeyPairSync("ed25519"), privat = key.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const pub = join(dir, "release.pub"); writeFileSync(pub, key.publicKey.export({ type: "spki", format: "pem" }));
    const caddy = "caddy:2.11.9-alpine@sha256:78bd35025c7ba85961dd149ae670315129954e77abe2383ac47c89106b35ade9";
    const pg = "postgres:18.6-bookworm@sha256:f1ea2a1a4fb7b68d4836be1fdcb8a6466a89b072158bf9d97663600538c294c5";
    const caddyId = (await docker(["image", "inspect", caddy, "--format", "{{.Id}}"])).stdout.trim();
    const pgId = (await docker(["image", "inspect", pg, "--format", "{{.Id}}"])).stdout.trim();
    const bundle = (name: string, image: typeof image1, migrationen: string, von: string[]) => {
      const b = join(dir, name); mkdirSync(b);
      for (const f of ["compose.yaml", "Caddyfile", "wartung.html"]) cpSync(join(BETRIEB, f), join(b, f));
      // Stub gehoert nur zum Testbundle: keine falsche Behauptung ueber einen echten Sicherungssatz.
      const backupSkript = `export PGPASSWORD="$$(cat /run/secrets/db_superuser_passwort)"; psql -X -h db -U postgres -d planora -v ON_ERROR_STOP=1 -Atc "insert into backup_lauf(id,zustand) values ('11111111-1111-4111-8111-111111111111','geprueft') on conflict(id) do update set start=now(),zustand='geprueft'" >/dev/null && echo '{"backupId":"11111111-1111-4111-8111-111111111111","zustand":"geprueft"}'`;
      writeFileSync(join(b, "compose.backup.yaml"), JSON.stringify({ services: {
        worker: { command: ["node", "-e", "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"] },
        backup: { image: pg, profiles: ["betrieb"], networks: ["intern"], entrypoint: ["sh", "-c", backupSkript], secrets: ["db_superuser_passwort"] },
      } }));
      const r = erzeugeRelease({ version: name, architektur: "amd64", migrationsVerzeichnis: migrationen, modulmanifestVersion: MANIFEST_VERSION, vonVersionen: von, schemaVorher: ["008_wartung.sql", "010_updateprobe.sql"], rueckwegAltesImage: von,
        images: [
          { dienst: "app", referenz: image.referenz, digest: null, imageId: image.imageId, architektur: "amd64" },
          { dienst: "db", referenz: pg, digest: pg.split("@")[1], imageId: pgId, architektur: "amd64" },
          { dienst: "proxy", referenz: caddy, digest: caddy.split("@")[1], imageId: caddyId, architektur: "amd64" },
        ] });
      writeFileSync(join(b, "release.json"), JSON.stringify(signiereRelease(r, privat))); return b;
    };
    altBundle = bundle("update-1", image1, join(APP, "src/db/migrationen"), []);
    neuBundle = bundle("update-2", image2, join(kontext, "src/db/migrationen"), ["update-1"]);
    // Installation prueft Projekt/Volumes/Netze VOR der ersten Mutation. Cleanup nur bei erfolgreicher Kollisionpruefung.
    const echt = dockerInstallUmgebung(aus, dir);
    const starte = echt.starte;
    echt.starte = async (x) => { i = x; angelegt = true; await starte(x); };
    await installiere({ instanz, domain: "localhost", tls: "internal", httpsPort: TEST.httpsPort + 1, httpPort: TEST.httpPort + 1, bundle: altBundle, schluessel: pub }, echt);
    await db("insert into backup_lauf(id,zustand) values('22222222-2222-4222-8222-222222222222','geprueft')");
    await db("insert into liegenschaft(id,name) values('33333333-3333-4333-8333-333333333333','Update-Daten')");
  });
  afterAll(async () => {
    if (angelegt) await compose(["--profile", "konsole", "--profile", "betrieb", "down", "-t", "2", "-v", "--remove-orphans"]).catch(() => {});
    if (alt) for (const [k, v] of Object.entries(alt)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (dir) rmSync(dir, { recursive: true, force: true });
  });
  it("DB-Advisory-Lock: paralleler Update abgelehnt, Backend-Verlust erkannt", async () => {
    const lock = await dbSperre(i);
    try {
      await expect(dbSperre(i)).rejects.toThrow(/Anderer Update/);
      await db("select pg_terminate_backend(pid) from pg_locks where locktype='advisory' and objid=7310003 and pid<>pg_backend_pid()");
      await expect(lock.pruefen()).rejects.toThrow(/Updatesperre/);
    } finally { await lock.loesen(); }
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
  });
  it("N-1 -> N: Host-Installation, erzwungener Worker-Stopp, Backup-Vertrag, neue Migration, Smoke und Freigabe", async () => {
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
    expect(await db("select name from migration_journal order by name desc limit 1")).toBe("010_updateprobe.sql");
    expect(await db("select name from liegenschaft where id='33333333-3333-4333-8333-333333333333'")).toBe("Update-Daten");
    expect(await db(`select count(*) from "user" where email like 'smoke-%@planora.invalid'`)).toBe("0");
    expect(await db("select count(*) from session")).toBe("0");
  });
});
