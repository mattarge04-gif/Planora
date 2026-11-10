// A3: Compose-Paket startet aus dem Nichts, Health ueber Caddy, Migrator Exit 0, Setup-Token → Erstadmin → Login.
// Projekt planora-a, Host-Ports 18080/18443. Raeumt nur das eigene Projekt ab (down -v).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DOCKER_TESTS, baueImage, cookies, docker, https, legeErstadminAn, melde, testInstanz, type TestInstanz } from "./paket-hilfe.js";

const IMAGE = "planora-app:test-1";
let inst: TestInstanz;

describe.skipIf(!DOCKER_TESTS)("Compose-Paket (Docker)", () => {
  beforeAll(async () => {
    await baueImage(IMAGE, "test-1");
    inst = testInstanz({ projekt: "planora-a", httpsPort: 18443, httpPort: 18080, image: IMAGE });
    await inst.compose(["--profile", "konsole", "down", "-v", "--remove-orphans"], { erlaubeFehler: true }); // Reste eines abgebrochenen Laufs
    await inst.compose(["up", "-d", "--pull", "never", "--wait", "--wait-timeout", "300"], { timeoutMs: 400_000 });
  });
  afterAll(async () => { await inst?.aufraeumen(); });

  it("Health 200 ueber Caddy (tls internal) mit Release aus dem Image", async () => {
    const r = await https(inst.basis, "GET", "/api/health");
    expect(r.status).toBe(200);
    expect(r.json()).toEqual({ ok: true, db: true, wartung: false, release: "test-1" });
  });

  it("Migrator endet mit Exit 0 und hat alle Migrationen angewendet", async () => {
    const z = (await docker(["inspect", "planora-a-migrator-1", "--format", "{{.State.Status}} {{.State.ExitCode}}"])).stdout.trim();
    expect(z).toBe("exited 0");
    expect(Number((await inst.sql("planora_betrieb", "select count(*) from migration_journal")).text)).toBeGreaterThanOrEqual(8);
    expect((await inst.sql("planora_betrieb", "select wert from instanz_einstellung where schluessel='wartung'")).text).toBe("false");
  });

  it("nur der Proxy veroeffentlicht Ports; api laeuft non-root, read-only, ohne Docker-Socket und ohne Weg nach aussen", async () => {
    const ps = (await inst.compose(["ps", "--format", "{{.Service}}|{{.Ports}}"])).stdout.trim().split(/\r?\n/);
    const veroeffentlicht = ps.filter((z) => z.includes("->")).map((z) => z.split("|")[0]);
    expect(veroeffentlicht).toEqual(["proxy"]);
    const api = JSON.parse((await docker(["inspect", "planora-a-api-1"])).stdout)[0];
    expect(api.Config.User).toBe("node");
    expect(api.HostConfig.ReadonlyRootfs).toBe(true);
    expect(api.Mounts.map((m: any) => m.Destination).filter((d: string) => d.includes("docker.sock"))).toEqual([]);
    expect(Object.keys(api.NetworkSettings.Networks).sort()).toEqual(["planora-a_intern", "planora-a_vorne"]);
    for (const n of ["planora-a_intern", "planora-a_vorne"]) {
      expect((await docker(["network", "inspect", n, "--format", "{{.Internal}}"])).stdout.trim()).toBe("true");
    }
    const db = JSON.parse((await docker(["inspect", "planora-a-db-1"])).stdout)[0];
    expect(Object.keys(db.NetworkSettings.Networks)).toEqual(["planora-a_intern"]);
  });

  it("DB-Rollen: Login-Rollen aus Secret-Dateien, keine ist Superuser, planora_app ohne DDL, planora_migrator besitzt die Tabellen", async () => {
    const rollen = (await inst.sql("postgres", "select rolname || ':' || rolcanlogin || ':' || rolsuper from pg_roles where rolname like 'planora%' order by 1")).text.split(/\r?\n/);
    expect(rollen).toEqual(["planora_app:true:false", "planora_backup:true:false", "planora_betrieb:true:false", "planora_migrator:true:false"]);
    expect((await inst.sql("postgres", "select distinct tableowner from pg_tables where schemaname='public'")).text).toBe("planora_migrator");
    const ddl = await inst.sql("planora_app", "create table darf_nicht(x int)", { erlaubeFehler: true });
    expect(ddl.code).not.toBe(0);
    expect(ddl.stderr).toMatch(/permission denied/);
    // api verbindet sich wirklich als planora_app (nicht als Eigentuemer)
    const nutzer = (await inst.sql("postgres", "select distinct usename from pg_stat_activity where application_name in ('planora-api','planora-worker')")).text;
    expect(nutzer).toBe("planora_app");
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
