// A3: Compose-Paket startet aus dem Nichts, Health ueber Caddy, Migrator Exit 0, Setup-Token → Erstadmin → Login.
// Projekt und Host-Ports aus TEST (Standard planora-a, 18080/18443). Bricht ab, wenn das Projekt schon existiert;
// abgebaut wird nur, was dieser Lauf selbst angelegt hat.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DOCKER_TESTS, TEST, baueImage, cookies, docker, https, legeErstadminAn, melde, testInstanz, type TestInstanz } from "./paket-hilfe.js";

let inst: TestInstanz;

describe.skipIf(!DOCKER_TESTS)("Compose-Paket (Docker)", () => {
  beforeAll(async () => {
    const image = await baueImage(TEST.tag(1), "test-1");
    inst = testInstanz({ image: image.referenz });
    await inst.starte();
  });
  afterAll(async () => { await inst?.aufraeumen(); });

  it("ein zweiter Start desselben Projekts wird abgelehnt und loescht nichts (PP9-2)", async () => {
    const zweite = testInstanz({ image: "egal:1" });
    try {
      await expect(zweite.starte()).rejects.toThrow(/existiert bereits/);
      await zweite.aufraeumen(); // nicht selbst angelegt → baut nichts ab
      expect((await https(inst.basis, "GET", "/api/health")).status).toBe(200);
    } finally { await zweite.aufraeumen(); }
  });

  it("Health 200 ueber Caddy (tls internal) mit Release aus dem Image", async () => {
    const r = await https(inst.basis, "GET", "/api/health");
    expect(r.status).toBe(200);
    expect(r.json()).toEqual({ ok: true, db: true, wartung: false, release: "test-1" });
  });

  it("Migrator endet mit Exit 0 und hat alle Migrationen angewendet", async () => {
    const m = await inst.inspect("migrator");
    expect([m.State.Status, m.State.ExitCode]).toEqual(["exited", 0]);
    expect(Number((await inst.sql("planora_betrieb", "select count(*) from migration_journal")).text)).toBeGreaterThanOrEqual(8);
    expect((await inst.sql("planora_betrieb", "select wert from instanz_einstellung where schluessel='wartung'")).text).toBe("false");
  });

  it("nur der Proxy veroeffentlicht Ports; api laeuft non-root, read-only, ohne Docker-Socket und ohne Weg nach aussen", async () => {
    const ps = (await inst.compose(["ps", "--format", "{{.Service}}|{{.Ports}}"])).stdout.trim().split(/\r?\n/);
    const veroeffentlicht = ps.filter((z) => z.includes("->")).map((z) => z.split("|")[0]);
    expect(veroeffentlicht).toEqual(["proxy"]);
    const api = await inst.inspect("api");
    expect(api.Config.User).toBe("node");
    expect(api.HostConfig.ReadonlyRootfs).toBe(true);
    expect(api.Mounts.map((m: any) => m.Destination).filter((d: string) => d.includes("docker.sock"))).toEqual([]);
    const netze = [`${inst.projekt}_intern`, `${inst.projekt}_vorne`];
    expect(Object.keys(api.NetworkSettings.Networks).sort()).toEqual(netze);
    for (const n of netze) {
      expect((await docker(["network", "inspect", n, "--format", "{{.Internal}}"])).stdout.trim()).toBe("true");
    }
    const db = await inst.inspect("db");
    expect(Object.keys(db.NetworkSettings.Networks)).toEqual([`${inst.projekt}_intern`]);
  });

  it("DB-Rollen (PP9-3): planora_owner NOLOGIN besitzt alles; DDL nur ueber den Rollenwechsel des Migrators; app/betrieb/konsole ohne DDL", async () => {
    const rollen = (await inst.sql("postgres", "select rolname || ':' || rolcanlogin || ':' || rolsuper from pg_roles where rolname like 'planora%' order by 1")).text.split(/\r?\n/);
    expect(rollen).toEqual(["planora_app:true:false", "planora_backup:true:false", "planora_betrieb:true:false", "planora_migrator:true:false", "planora_owner:false:false"]);
    expect((await inst.sql("postgres", "select distinct tableowner from pg_tables where schemaname='public'")).text).toBe("planora_owner");
    expect((await inst.sql("postgres", "select pg_get_userbyid(datdba) from pg_database where datname='planora'")).text).toBe("planora_owner");
    expect((await inst.sql("postgres", "select distinct pg_get_userbyid(proowner) from pg_proc where pronamespace='public'::regnamespace")).text).toBe("planora_owner");
    // nur planora_migrator darf in die Eigentuemerrolle wechseln
    expect((await inst.sql("postgres", "select string_agg(member::regrole::text, ',') from pg_auth_members where roleid='planora_owner'::regrole")).text).toBe("planora_migrator");
    for (const rolle of ["planora_app", "planora_betrieb", "planora_backup", "planora_migrator"]) {
      const ddl = await inst.sql(rolle, "create table darf_nicht(x int)", { erlaubeFehler: true });
      expect(ddl.code, rolle).not.toBe(0);
      expect(ddl.stderr, rolle).toMatch(/permission denied/);
    }
    for (const rolle of ["planora_app", "planora_betrieb", "planora_backup"]) {
      const wechsel = await inst.sql(rolle, "set role planora_owner", { erlaubeFehler: true });
      expect(wechsel.code, rolle).not.toBe(0);
    }
    // der Migrator kommt nur ueber den ausdruecklichen Rollenwechsel zu DDL (und nimmt die Probe wieder weg)
    expect((await inst.sql("planora_migrator", "set role planora_owner; create table ddl_probe(x int); drop table ddl_probe; select current_user")).text.split(/\r?\n/).pop()).toBe("planora_owner");
    // planora_owner kann sich nicht anmelden (auch nicht mit einem bekannten Passwort)
    const login = await inst.compose(["exec", "-T", "db", "sh", "-c", 'PGPASSWORD="$(cat /run/secrets/db_migrator_passwort)" psql -X -h 127.0.0.1 -U planora_owner -d planora -Atc "select 1"'], { erlaubeFehler: true });
    expect(login.code).not.toBe(0);
    // api/worker verbinden sich als planora_app; die Konsole bekommt nur das Passwort der Betriebsrolle
    const nutzer = (await inst.sql("postgres", "select distinct usename from pg_stat_activity where application_name in ('planora-api','planora-worker')")).text;
    expect(nutzer).toBe("planora_app");
    const konsole = await inst.compose(["--profile", "konsole", "run", "--rm", "-T", "--entrypoint", "ls", "konsole", "/run/secrets"]);
    expect(konsole.stdout.trim().split(/\r?\n/)).toEqual(["db_betrieb_passwort"]);
    const api = await inst.compose(["exec", "-T", "api", "ls", "/run/secrets"]);
    expect(api.stdout.trim().split(/\r?\n/).sort()).toEqual(["auth_secret", "db_app_passwort"]);
  });

  it("PP9-1: jede Rolle meldet sich ueber TCP mit dem Passwort aus ihrer Secret-Datei an; falsches Passwort scheitert", async () => {
    const tcp = (rolle: string, passwortBefehl: string) => inst.compose(["exec", "-T", "db", "sh", "-c",
      `PGPASSWORD="$(${passwortBefehl})" PGCONNECT_TIMEOUT=10 psql -X -h 127.0.0.1 -U ${rolle} -d planora -Atc "select current_user"`], { erlaubeFehler: true });
    for (const kurz of ["app", "migrator", "backup", "betrieb"]) {
      const ok = await tcp(`planora_${kurz}`, `cat /run/secrets/db_${kurz}_passwort`);
      expect(ok.code, kurz).toBe(0);
      expect(ok.stdout.trim()).toBe(`planora_${kurz}`);
      const falsch = await tcp(`planora_${kurz}`, "echo falsch");
      expect(falsch.code, kurz).not.toBe(0);
      expect(falsch.stderr).toMatch(/password authentication failed/);
    }
  });

  it("PP9-1: erzeugeSecrets als root unter Linux → Kopien gehoeren der Container-UID (db 999, app 1000), Modus 600, fremde UID liest nichts", async () => {
    const image = (await inst.inspect("api")).Config.Image as string;
    const volume = `${inst.projekt}-secretprobe-${Date.now()}`;
    await docker(["volume", "create", volume]);
    try {
      await docker(["run", "--rm", "-u", "0", "-v", `${volume}:/s`, image, "node", "--input-type=module", "-e",
        "import { erzeugeSecrets } from '/app/dist/betrieb/install/plan.js'; erzeugeSecrets('/s/secrets');"]);
      const stat = (await docker(["run", "--rm", "-u", "0", "-v", `${volume}:/s`, image, "sh", "-c",
        "cd /s/secrets && stat -c '%u %a %n' . db app db/* app/* db_app_passwort auth_secret"])).stdout.trim().split(/\r?\n/);
      expect(stat).toEqual([
        "0 700 .", "999 700 db", "1000 700 app",
        "999 600 db/db_app_passwort", "999 600 db/db_backup_passwort", "999 600 db/db_betrieb_passwort", "999 600 db/db_migrator_passwort", "999 600 db/db_superuser_passwort",
        "1000 600 app/auth_secret", "1000 600 app/db_app_passwort", "1000 600 app/db_betrieb_passwort", "1000 600 app/db_migrator_passwort",
        "0 600 db_app_passwort", "0 600 auth_secret",
      ]);
      // Wie im Paket: der Container sieht nur sein Unterverzeichnis (dort Datei-Bind-Mounts, hier Volume-Subpath).
      const lies = (uid: string, unter: string, datei: string) => docker(["run", "--rm", "-u", uid, "--mount", `type=volume,src=${volume},dst=/x,volume-subpath=secrets/${unter}`, image, "sh", "-c", `wc -c < /x/${datei}`], { erlaubeFehler: true });
      expect((await lies("999:999", "db", "db_app_passwort")).stdout.trim()).toBe("64");
      expect((await lies("1000:1000", "app", "db_app_passwort")).stdout.trim()).toBe("64");
      expect((await lies("1000:1000", "db", "db_app_passwort")).code).not.toBe(0);
      expect((await lies("999:999", "app", "auth_secret")).code).not.toBe(0);
      expect((await lies("65534:65534", "app", "auth_secret")).code).not.toBe(0);
    } finally { await docker(["volume", "rm", "-f", volume], { erlaubeFehler: true }); }
  });

  it("Setup-Token auf der Host-Konsole → Erstadmin → Login ueber Caddy → /api/ich", async () => {
    expect((await https(inst.basis, "GET", "/api/ich")).status).toBe(401);
    const admin = await legeErstadminAn(inst);
    expect(admin.token.length).toBeGreaterThanOrEqual(32);
    const login = await melde(inst, admin.email, admin.passwort);
    expect(login.status).toBe(200);
    const ich = await https(inst.basis, "GET", "/api/ich", { headers: { cookie: cookies(login) } });
    expect(ich.status).toBe(200);
    expect(ich.json()).toEqual({ id: admin.benutzerId });
    // Token ist verbraucht: zweiter Erstadmin mit demselben Token scheitert
    const nochmal = await inst.compose(["--profile", "konsole", "run", "--rm", "-T", "konsole", "erstadmin"],
      { eingabe: JSON.stringify({ token: admin.token, email: "zwei@planora.invalid", name: "Zwei", passwort: admin.passwort }), erlaubeFehler: true });
    expect(nochmal.code).not.toBe(0);
    // falsche Herkunft wird abgelehnt (Origin-Pruefung wirkt hinter dem Proxy)
    const fremd = await https(inst.basis, "POST", "/api/auth/sign-in/email", { headers: { origin: "https://boese.invalid" }, body: { email: admin.email, password: admin.passwort } });
    expect(fremd.status).toBe(403);
  });

  it("PP9-4: X-Forwarded-For gilt nur vom Caddy; ein anderer interner Peer kann keine Client-IP behaupten", async () => {
    const proxy = await inst.inspect("proxy"), api = await inst.inspect("api");
    expect(proxy.NetworkSettings.Networks[`${inst.projekt}_vorne`].IPAddress).toBe(inst.vorne.proxy);
    expect(api.NetworkSettings.Networks[`${inst.projekt}_vorne`].IPAddress).toBe(inst.vorne.api);
    expect(api.Config.Env).toContain(`PLANORA_VERTRAUTE_PROXIES=${inst.vorne.proxy}`);
    // Zaehler der Fehlversuchssperre je Client-IP: zeigt, welche Adresse api als Client angesehen hat
    const zaehler = async () => new Map((await inst.sql("postgres", "select schluessel || '=' || anzahl from anmelde_fehlversuch where schluessel like 'ip:%'")).text
      .split(/\r?\n/).filter(Boolean).map((z) => { const i = z.lastIndexOf("="); return [z.slice(0, i), Number(z.slice(i + 1))] as const; }));
    const gestiegen = (vorher: Map<string, number>, nachher: Map<string, number>) => [...nachher].filter(([k, n]) => n > (vorher.get(k) ?? 0)).map(([k]) => k);
    // negativ: Worker (Netz intern) ruft api direkt und behauptet eine fremde Client-IP
    const z0 = await zaehler();
    const skript = `fetch("http://api:3000/api/auth/sign-in/email",{method:"POST",headers:{"content-type":"application/json",origin:process.env.O,"x-forwarded-for":"203.0.113.23"},body:JSON.stringify({email:"peer@planora.invalid",password:"falsch-falsch-1"})}).then(r=>{console.log(r.status)})`;
    const direkt = await inst.compose(["exec", "-T", "-e", `O=${inst.basis}`, "worker", "node", "-e", skript]);
    expect(direkt.stdout.trim()).toBe("401");
    const workerIp = (await inst.inspect("worker")).NetworkSettings.Networks[`${inst.projekt}_intern`].IPAddress as string;
    const z1 = await zaehler();
    expect(gestiegen(z0, z1)).toEqual([`ip:${workerIp}`]);
    expect(z1.has("ip:203.0.113.23")).toBe(false);
    // positiv: ueber Caddy zaehlt die Adresse, die Caddy als Client sieht – nicht die des Proxys und nicht ein vom Client gesetzter Header
    const ueberCaddy = await https(inst.basis, "POST", "/api/auth/sign-in/email", { headers: { origin: inst.basis, "x-forwarded-for": "203.0.113.99" }, body: { email: "caddy@planora.invalid", password: "falsch-falsch-1" } });
    expect(ueberCaddy.status).toBe(401);
    const z2 = await zaehler();
    const client = gestiegen(z1, z2);
    expect(client).toHaveLength(1);
    expect([`ip:${inst.vorne.proxy}`, "ip:203.0.113.99", `ip:${workerIp}`]).not.toContain(client[0]);
    expect(z2.has(`ip:${inst.vorne.proxy}`)).toBe(false);
    expect(z2.has("ip:203.0.113.99")).toBe(false);
  });

  it("Wartungsschalter in Caddy: alle Routen 503 mit Wartungsseite, /api/health bleibt; Schalter aus → normal", async () => {
    await inst.compose(["exec", "-T", "proxy", "sh", "-c", "mkdir -p /data/wartung && touch /data/wartung/aktiv"]);
    try {
      for (const pfad of ["/", "/api/ich", "/api/auth/ok", "/irgendwas/tief"]) {
        const r = await https(inst.basis, "GET", pfad);
        expect(r.status, pfad).toBe(503);
        expect(r.text).toContain("Planora wird gerade gewartet");
        expect(r.headers["retry-after"]).toBe("120");
      }
      expect((await https(inst.basis, "POST", "/api/auth/sign-in/email", { headers: { origin: inst.basis }, body: {} })).status).toBe(503);
      const h = await https(inst.basis, "GET", "/api/health");
      expect(h.status).toBe(200);
      expect(h.json().ok).toBe(true);
    } finally { await inst.compose(["exec", "-T", "proxy", "rm", "-f", "/data/wartung/aktiv"]); }
    expect((await https(inst.basis, "GET", "/api/ich")).status).toBe(401);
  });

  it("Wartungsflag in der DB sperrt Mutationen auch hinter dem Proxy; Worker meldet wartung", async () => {
    await inst.sql("planora_betrieb", "select setze_wartung(true)");
    try {
      const r = await https(inst.basis, "POST", "/api/auth/sign-in/email", { headers: { origin: inst.basis }, body: { email: "x@planora.invalid", password: "x" } });
      expect(r.status).toBe(503);
      expect(r.json()).toEqual({ fehler: "wartung" });
      expect((await https(inst.basis, "GET", "/api/health")).json().wartung).toBe(true);
      await new Promise((r) => setTimeout(r, 6000)); // Worker prueft alle 5 s
      expect((await inst.compose(["logs", "--no-log-prefix", "worker"])).stdout).toContain('"status":"wartung"');
    } finally { await inst.sql("planora_betrieb", "select setze_wartung(false)"); }
  });
});
