import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { erzeugeRelease, signiereRelease, type Release } from "../src/betrieb/release.js";
import { SECRETS, erzeugeSecrets, leseEnv, planeInstanz, planeVorneNetz, ueberlappt, pruefeKollision, pruefePlattform, schreibeEnv, type Bestand, type PlattformIst } from "../src/betrieb/install/plan.js";
import { installiere, type InstallUmgebung } from "../src/betrieb/install/install.js";
import { leseArgumente } from "../src/betrieb/install/argumente.js";

const MIGRATIONEN = fileURLToPath(new URL("../src/db/migrationen", import.meta.url));
const GIB = 2 ** 30;
const plan = (ueber: object = {}) => planeInstanz({ instanz: "kunde-a", domain: "planora.kunde-a.example", tls: "internal", ...ueber });
const leer: Bestand = { projekte: [], volumes: [], instanzen: [] };

describe("Eingaben", () => {
  it("leitet Projekt, TLS-Wert und Basis-URL ab", () => {
    expect(plan()).toMatchObject({ projekt: "planora-kunde-a", tlsWert: "internal", httpsPort: 443, httpPort: 80, baseURL: "https://planora.kunde-a.example" });
    expect(plan({ httpsPort: 18443, httpPort: 18080 }).baseURL).toBe("https://planora.kunde-a.example:18443");
    expect(plan({ tls: "acme", acmeKontakt: "betrieb@planora.example" }).tlsWert).toBe("betrieb@planora.example");
  });
  it("lehnt ungueltige Namen, Domains, TLS-Angaben und Ports ab", () => {
    for (const instanz of ["", "A", "kunde_a", "-a", "a-", "a b", "../x", "x".repeat(40)]) expect(() => plan({ instanz }), instanz).toThrow(/--instanz/);
    for (const domain of ["", "http://x", "a..b", "x/y", "-a.example", "a b.example"]) expect(() => plan({ domain }), domain).toThrow(/--domain/);
    expect(() => plan({ tls: "selbst" })).toThrow(/--tls/);
    expect(() => plan({ tls: "acme" })).toThrow(/--acme-kontakt/);
    expect(() => plan({ tls: "acme", acmeKontakt: "a@b.ch", domain: "localhost" })).toThrow(/oeffentlichen Hostnamen/);
    expect(() => plan({ httpsPort: 80, httpPort: 80 })).toThrow(/Ports/);
    expect(() => plan({ httpsPort: 70000 })).toThrow(/Ports/);
  });
  it("Argumentparser: Werte, Schalter, Positionen; unbekannte Option und fehlender Wert sind Fehler", () => {
    expect(leseArgumente(["--instanz", "a", "bundle", "--fortsetzen"], ["instanz"], ["fortsetzen"])).toEqual({ werte: { instanz: "a", fortsetzen: "1" }, positionen: ["bundle"] });
    expect(() => leseArgumente(["--boese", "x"], ["instanz"])).toThrow(/Unbekannte Option/);
    expect(() => leseArgumente(["--instanz"], ["instanz"])).toThrow(/Wert fehlt/);
    expect(() => leseArgumente(["--instanz", "--domain"], ["instanz", "domain"])).toThrow(/Wert fehlt/);
  });
});

describe("Kollisionspruefung (Abnahme A2)", () => {
  it("frischer Host: keine Einwaende", () => { expect(pruefeKollision(plan(), leer)).toEqual([]); });
  it("gleicher Projektname wird abgelehnt", () => {
    expect(pruefeKollision(plan(), { ...leer, projekte: ["planora-kunde-a"] })).toEqual(["Compose-Projekt planora-kunde-a existiert bereits"]);
  });
  it("gleicher Volume-Name wird abgelehnt, fremde Volumes stoeren nicht", () => {
    const f = pruefeKollision(plan(), { ...leer, volumes: ["planora-kunde-a_pgdata", "planora-kunde-a_dokumente", "planora-kunde-ab_pgdata", "anderes_pgdata"] });
    expect(f).toEqual(["Volumes mit dem Namen dieser Instanz existieren bereits: planora-kunde-a_dokumente, planora-kunde-a_pgdata"]);
  });
  it("gleiches Backup-Ziel einer anderen Instanz wird abgelehnt (auch mit anderer Schreibweise)", () => {
    const bestand = { ...leer, instanzen: [{ instanz: "kunde-b", backupZiel: "s3:https://s3.example.ch/planora-backup/", httpsPort: 8443, httpPort: 8080 }] };
    expect(pruefeKollision(plan({ backupZiel: "S3:https://s3.example.ch/planora-backup" }), bestand)).toEqual(["Backup-Ziel wird bereits von Instanz kunde-b verwendet"]);
    expect(pruefeKollision(plan({ backupZiel: "s3:https://s3.example.ch/planora-backup-a" }), bestand)).toEqual([]);
  });
  it("gleiche Host-Ports einer anderen Instanz und bereits installierte Instanz werden abgelehnt", () => {
    const bestand = { ...leer, instanzen: [{ instanz: "kunde-b", httpsPort: 443, httpPort: 80 }] };
    expect(pruefeKollision(plan(), bestand)).toEqual(["Host-Port 443 wird bereits von Instanz kunde-b verwendet", "Host-Port 80 wird bereits von Instanz kunde-b verwendet"]);
    expect(pruefeKollision(plan(), { ...leer, instanzen: [{ instanz: "kunde-a" }] })).toEqual(["Instanz kunde-a ist bereits installiert (Konfiguration vorhanden)"]);
  });
});

describe("Netz vorne (PP9-4)", () => {
  it("waehlt das erste freie /29 und leitet feste Adressen fuer Proxy und api ab", () => {
    expect(planeVorneNetz(leer)).toEqual({ subnetz: "172.31.240.0/29", proxy: "172.31.240.2", api: "172.31.240.3" });
    expect(planeVorneNetz({ ...leer, subnetze: ["172.17.0.0/16", "172.31.240.0/29", "fd00::/64"] }).subnetz).toBe("172.31.240.8/29");
    expect(planeVorneNetz({ ...leer, subnetze: ["172.31.240.0/24"], instanzen: [{ instanz: "kunde-b", vorneSubnetz: "172.31.241.0/29" }] }).subnetz).toBe("172.31.241.8/29");
    expect(() => planeVorneNetz({ ...leer, subnetze: ["172.16.0.0/12"] })).toThrow(/Kein freies Subnetz/);
  });
  it("prueft ein gewuenschtes Subnetz: privat, hoechstens /29, Netzadresse, keine Ueberlappung", () => {
    expect(planeVorneNetz(leer, "10.99.0.0/29")).toEqual({ subnetz: "10.99.0.0/29", proxy: "10.99.0.2", api: "10.99.0.3" });
    expect(() => planeVorneNetz(leer, "10.99.0.0/30")).toThrow(/ungueltig/);
    expect(() => planeVorneNetz(leer, "10.99.0.4/29")).toThrow(/ungueltig/);
    expect(() => planeVorneNetz(leer, "8.8.8.0/29")).toThrow(/privat/);
    expect(() => planeVorneNetz(leer, "kaputt")).toThrow(/ungueltig/);
    expect(() => planeVorneNetz({ ...leer, subnetze: ["10.99.0.0/16"] }, "10.99.0.0/29")).toThrow(/ueberlappt/);
    expect(ueberlappt("172.31.240.0/29", "172.31.240.8/29")).toBe(false);
    expect(ueberlappt("172.31.240.0/29", "172.31.240.4/30")).toBe(true);
  });
});

describe("Plattform- und Platzcheck", () => {
  const gut: PlattformIst = { betriebssystem: "linux", architektur: "amd64", engine: "29.9.3", compose: "5.7.0", freiBytes: 120 * GIB, ramBytes: 8 * GIB, cpus: 4 };
  it("Zielplattform ohne Befund", () => { expect(pruefePlattform(gut, "amd64")).toEqual({ fehler: [], warnungen: [] }); });
  it("falsche Architektur, alte Engine/Compose, zu wenig Platz → Fehler", () => {
    expect(pruefePlattform({ ...gut, architektur: "arm64" }, "amd64").fehler).toHaveLength(2);
    expect(pruefePlattform({ ...gut, engine: "28.5.1" }).fehler[0]).toMatch(/Docker Engine 28.5.1/);
    expect(pruefePlattform({ ...gut, compose: "2.20.0" }).fehler[0]).toMatch(/Compose 2.20.0/);
    expect(pruefePlattform({ ...gut, engine: "" }).fehler[0]).toMatch(/unbekannt/);
    expect(pruefePlattform({ ...gut, freiBytes: 5 * GIB }).fehler[0]).toMatch(/freier Platz 5.0 GiB/);
  });
  it("knappe Ressourcen und fremdes Betriebssystem → nur Warnung", () => {
    const r = pruefePlattform({ ...gut, betriebssystem: "win32", freiBytes: 40 * GIB, ramBytes: 4 * GIB, cpus: 2 });
    expect(r.fehler).toEqual([]);
    expect(r.warnungen).toHaveLength(4);
  });
});

describe("Secrets und instanz.env", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "planora-install-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });
  it("legt alle Secrets zufaellig an, mit Kopien je Empfaenger, und ueberschreibt nie", () => {
    const s = join(dir, "secrets");
    erzeugeSecrets(s);
    for (const n of SECRETS) expect(readFileSync(join(s, n), "utf8")).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(SECRETS.map((n) => readFileSync(join(s, n), "utf8"))).size).toBe(SECRETS.length);
    expect(readdirSync(join(s, "db")).sort()).toEqual(["db_app_passwort", "db_backup_passwort", "db_betrieb_passwort", "db_migrator_passwort", "db_superuser_passwort"]);
    expect(readdirSync(join(s, "app")).sort()).toEqual(["auth_secret", "db_app_passwort", "db_betrieb_passwort", "db_migrator_passwort"]);
    expect(readFileSync(join(s, "app", "db_app_passwort"), "utf8")).toBe(readFileSync(join(s, "db_app_passwort"), "utf8"));
    expect(readFileSync(join(s, "db", "db_app_passwort"), "utf8")).toBe(readFileSync(join(s, "db_app_passwort"), "utf8"));
    if (process.platform !== "win32") expect(statSync(join(s, "auth_secret")).mode & 0o777).toBe(0o600);
    expect(() => erzeugeSecrets(s)).toThrow(/existiert bereits/);
  });
  it("instanz.env enthaelt nur Konfiguration und laesst sich zuruecklesen", () => {
    const datei = join(dir, "instanz.env");
    schreibeEnv(datei, { PLANORA_INSTANZ: "kunde-a", PLANORA_TLS: "internal", PLANORA_BACKUP_ZIEL: undefined });
    expect(leseEnv(datei)).toEqual({ PLANORA_INSTANZ: "kunde-a", PLANORA_TLS: "internal" });
    expect(() => schreibeEnv(datei, { X: "a\nb" })).toThrow(/Zeilenumbruch/);
    expect(readdirSync(dir)).toEqual(["instanz.env"]); // keine Temp-Datei bleibt liegen
  });
});

describe("Ablauf planora install (Fake-Umgebung)", () => {
  const ID = (z: string) => `sha256:${z.repeat(64)}`;
  let dir: string, bundle: string, pub: string, release: Release, alt: { etc?: string; var?: string };
  const paar = generateKeyPairSync("ed25519");
  const fake = (ueber: Partial<InstallUmgebung> = {}) => {
    const aufrufe: string[] = [];
    const u: InstallUmgebung = {
      plattform: async () => ({ betriebssystem: "linux", architektur: "amd64", engine: "29.9.3", compose: "5.7.0", freiBytes: 200 * GIB, ramBytes: 8 * GIB, cpus: 4 }),
      projekte: async () => [], volumes: async () => [], subnetze: async () => ["172.17.0.0/16"],
      ladeImage: async (a) => { aufrufe.push(`load ${a.replace(/\\/g, "/").split("/").slice(-2).join("/")}`); },
      imageId: async (r) => release.images.find((i) => i.referenz === r)?.imageId ?? null,
      starte: async (i) => { aufrufe.push(`up ${i.projekt}`); },
      sql: async (_i, rolle, befehl) => { aufrufe.push(`sql ${rolle} ${befehl.slice(0, 30)}`); return "0"; },
      setupToken: async () => { aufrufe.push("setup-token"); return "TOKEN-123"; },
      ...ueber,
    };
    return { u, aufrufe };
  };
  const optionen = (ueber: object = {}) => ({ instanz: "kunde-a", domain: "localhost", tls: "internal" as const, httpsPort: 18443, httpPort: 18080, bundle, schluessel: pub, ...ueber });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "planora-install-"));
    alt = { etc: process.env.PLANORA_ETC, var: process.env.PLANORA_VAR };
    process.env.PLANORA_ETC = join(dir, "etc"); process.env.PLANORA_VAR = join(dir, "var");
    bundle = join(dir, "bundle"); mkdirSync(join(bundle, "images"), { recursive: true });
    for (const f of ["compose.yaml", "Caddyfile", "wartung.html"]) writeFileSync(join(bundle, f), "");
    writeFileSync(join(bundle, "images", "app.tar"), "x");
    release = erzeugeRelease({
      version: "1.0.0", architektur: "amd64", migrationsVerzeichnis: MIGRATIONEN, modulmanifestVersion: "m1", vonVersionen: [], schemaVorher: [],
      images: [{ dienst: "app", referenz: `planora-app:1.0.0@${ID("a")}`, digest: null, imageId: ID("a"), architektur: "amd64", archiv: "images/app.tar" }],
    });
    writeFileSync(join(bundle, "release.json"), JSON.stringify(signiereRelease(release, paar.privateKey.export({ type: "pkcs8", format: "pem" }) as string)));
    pub = join(dir, "release.pub"); writeFileSync(pub, paar.publicKey.export({ type: "spki", format: "pem" }) as string);
  });
  afterEach(() => {
    for (const [k, v] of [["PLANORA_ETC", alt.etc], ["PLANORA_VAR", alt.var]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(dir, { recursive: true, force: true });
  });

  it("Reihenfolge: pruefen → Images laden → Secrets/Env → up → Profil P1 → Setup-Token", async () => {
    const { u, aufrufe } = fake();
    const r = await installiere(optionen(), u);
    expect(r).toMatchObject({ instanz: "kunde-a", projekt: "planora-kunde-a", baseURL: "https://localhost:18443", release: "1.0.0", setupToken: "TOKEN-123" });
    expect(aufrufe).toEqual(["load images/app.tar", "up planora-kunde-a", "sql planora_app select count(*) from modul_sch", "sql planora_betrieb select betrieb_ereignis('insta", "setup-token"]);
    const env = leseEnv(join(dir, "etc", "kunde-a", "instanz.env"));
    expect(env).toMatchObject({ PLANORA_INSTANZ: "kunde-a", PLANORA_RELEASE: "1.0.0", PLANORA_DOMAIN: "localhost", PLANORA_TLS: "internal", PLANORA_HTTPS_PORT: "18443", PLANORA_IMAGE_APP: `planora-app:1.0.0@${ID("a")}`,
      PLANORA_VORNE_SUBNETZ: "172.31.240.0/29", PLANORA_PROXY_IP: "172.31.240.2", PLANORA_API_IP: "172.31.240.3" });
    // keine Geheimnisse in der Env-Datei, Secrets als Dateien daneben, Vertrauensanker kopiert
    const envText = readFileSync(join(dir, "etc", "kunde-a", "instanz.env"), "utf8");
    for (const n of SECRETS) expect(envText).not.toContain(readFileSync(join(dir, "etc", "kunde-a", "secrets", n), "utf8"));
    expect(existsSync(join(dir, "etc", "kunde-a", "release.pub"))).toBe(true);
  });
  it("zweite Installation derselben Instanz wird abgelehnt und veraendert nichts", async () => {
    await installiere(optionen(), fake().u);
    const vorher = readFileSync(join(dir, "etc", "kunde-a", "secrets", "auth_secret"), "utf8");
    const { u, aufrufe } = fake();
    await expect(installiere(optionen(), u)).rejects.toThrow(/bereits installiert/);
    expect(aufrufe).toEqual([]);
    expect(readFileSync(join(dir, "etc", "kunde-a", "secrets", "auth_secret"), "utf8")).toBe(vorher);
  });
  it("zweite Instanz mit gleichem Backup-Ziel oder gleichen Ports wird abgelehnt; mit eigenen Werten angenommen", async () => {
    await installiere(optionen({ backupZiel: "s3:https://s3.example.ch/a" }), fake().u);
    await expect(installiere(optionen({ instanz: "kunde-b", backupZiel: "s3:https://s3.example.ch/a/", httpsPort: 28443, httpPort: 28080 }), fake().u)).rejects.toThrow(/Backup-Ziel wird bereits von Instanz kunde-a/);
    await expect(installiere(optionen({ instanz: "kunde-b", backupZiel: "s3:https://s3.example.ch/b" }), fake().u)).rejects.toThrow(/Host-Port 18443/);
    expect(existsSync(join(dir, "etc", "kunde-b"))).toBe(false);
    const r = await installiere(optionen({ instanz: "kunde-b", backupZiel: "s3:https://s3.example.ch/b", httpsPort: 28443, httpPort: 28080 }), fake().u);
    expect(r.projekt).toBe("planora-kunde-b");
    // eigenes Subnetz, auch wenn das Netz der ersten Instanz gerade nicht existiert
    expect(leseEnv(join(dir, "etc", "kunde-b", "instanz.env")).PLANORA_VORNE_SUBNETZ).toBe("172.31.240.8/29");
    // getrennte Secrets
    expect(readFileSync(join(dir, "etc", "kunde-b", "secrets", "auth_secret"), "utf8")).not.toBe(readFileSync(join(dir, "etc", "kunde-a", "secrets", "auth_secret"), "utf8"));
  });
  it("vorhandenes Projekt oder Volume, ungeeignete Plattform → Abbruch ohne Dateien", async () => {
    await expect(installiere(optionen(), fake({ projekte: async () => ["planora-kunde-a"] }).u)).rejects.toThrow(/Compose-Projekt/);
    await expect(installiere(optionen(), fake({ volumes: async () => ["planora-kunde-a_pgdata"] }).u)).rejects.toThrow(/Volumes/);
    await expect(installiere(optionen(), fake({ plattform: async () => ({ betriebssystem: "linux", architektur: "arm64", engine: "29.9.3", compose: "5.7.0", freiBytes: 200 * GIB, ramBytes: 8 * GIB, cpus: 4 }) }).u)).rejects.toThrow(/Plattform ungeeignet/);
    expect(existsSync(join(dir, "etc"))).toBe(false);
  });
  it("manipuliertes release.json, fremder Schluessel, falsche Image-ID, fehlendes Archiv → Abbruch vor jeder Aenderung", async () => {
    const { u, aufrufe } = fake({ imageId: async () => ID("b") });
    await expect(installiere(optionen(), u)).rejects.toThrow(/Image-ID von planora-app:1.0.0@sha256:.* weicht vom Manifest ab/);
    expect(aufrufe).toEqual(["load images/app.tar"]);
    await expect(installiere(optionen(), fake({ imageId: async () => null }).u)).rejects.toThrow(/nicht vorhanden/);
    const datei = JSON.parse(readFileSync(join(bundle, "release.json"), "utf8"));
    datei.release.images[0].imageId = ID("b");
    writeFileSync(join(bundle, "release.json"), JSON.stringify(datei));
    await expect(installiere(optionen(), fake().u)).rejects.toThrow(/Signatur/);
    const fremd = join(dir, "fremd.pub"); writeFileSync(fremd, generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }) as string);
    await expect(installiere(optionen({ schluessel: fremd }), fake().u)).rejects.toThrow(/Signatur/);
    rmSync(join(bundle, "Caddyfile"));
    await expect(installiere(optionen(), fake().u)).rejects.toThrow(/Bundle unvollstaendig: Caddyfile/);
    expect(existsSync(join(dir, "etc"))).toBe(false);
  });
  it("aktive Option nach dem Start verletzt Profil P1 → Fehler, kein Setup-Token", async () => {
    const { u, aufrufe } = fake({ sql: async () => "1" });
    await expect(installiere(optionen(), u)).rejects.toThrow(/Profil P1 verletzt/);
    expect(aufrufe).not.toContain("setup-token");
  });
});
