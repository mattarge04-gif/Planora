// Gemeinsame Hilfen der Docker-Integrationstests von Spur A (paket*, update*). Kein Test, nur Werkzeug.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { erzeugeSecrets, vorneAdressen, waehleVorneSubnetz } from "../src/betrieb/install/plan.js";

export const DOCKER_TESTS = process.env.PLANORA_DOCKER_TESTS === "1";
export const APP = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const BETRIEB = resolve(APP, "..", "betrieb");
const DOCKER_WINDOWS = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
export const DOCKER = process.env.PLANORA_DOCKER ?? (process.platform === "win32" && existsSync(DOCKER_WINDOWS) ? DOCKER_WINDOWS : "docker");

export type Ergebnis = { code: number; stdout: string; stderr: string };
export function fuehreAus(befehl: string, args: string[], o: { eingabe?: string; timeoutMs?: number; cwd?: string } = {}): Promise<Ergebnis> {
  return new Promise((ok, fehler) => {
    const p = spawn(befehl, args, { cwd: o.cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const t = setTimeout(() => { p.kill(); fehler(new Error(`Zeitueberschreitung: ${befehl} ${args.join(" ")}`)); }, o.timeoutMs ?? 300_000);
    p.stdout.on("data", (d) => { stdout += d; }); p.stderr.on("data", (d) => { stderr += d; });
    p.on("error", (e) => { clearTimeout(t); fehler(e); });
    p.on("close", (code) => { clearTimeout(t); ok({ code: code ?? -1, stdout, stderr }); });
    p.stdin.end(o.eingabe ?? "");
  });
}
/** docker <args>; wirft bei Exit ≠ 0 (ausser erlaubeFehler). */
export async function docker(args: string[], o: { eingabe?: string; timeoutMs?: number; erlaubeFehler?: boolean } = {}): Promise<Ergebnis> {
  const r = await fuehreAus(DOCKER, args, o);
  if (r.code !== 0 && !o.erlaubeFehler) throw new Error(`docker ${args.join(" ")} → Exit ${r.code}\n${r.stderr.slice(-2000)}\n${r.stdout.slice(-2000)}`);
  return r;
}

/**
 * Testkonfiguration (PP9-2): Projekt, Ports und Image-Tag kommen aus der Umgebung, damit parallele Laeufe (z.B. ein
 * Reviewer) ein eigenes Projekt nutzen: PLANORA_TEST_PROJEKT, PLANORA_TEST_HTTPS_PORT, PLANORA_TEST_HTTP_PORT.
 * Standard ist das Projekt der Spur A.
 */
const zahl = (name: string, standard: number) => {
  const n = Number(process.env[name] ?? standard);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`${name} ungueltig`);
  return n;
};
export const TEST = (() => {
  const projekt = process.env.PLANORA_TEST_PROJEKT ?? "planora-a";
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(projekt)) throw new Error("PLANORA_TEST_PROJEKT ungueltig");
  return { projekt, httpsPort: zahl("PLANORA_TEST_HTTPS_PORT", 18443), httpPort: zahl("PLANORA_TEST_HTTP_PORT", 18080), tag: (n: number) => `planora-app:${projekt}-${n}` };
})();

/** Baut das App-Image und liefert die unveraenderliche Referenz tag@sha256:<Image-ID> (PP9-6). */
export async function baueImage(tag: string, release: string, kontext = APP, datei?: string): Promise<{ referenz: string; imageId: string }> {
  await docker(["build", "-q", "-t", tag, "--build-arg", `PLANORA_RELEASE=${release}`, ...(datei ? ["-f", datei] : []), kontext], { timeoutMs: 900_000 });
  const imageId = (await docker(["image", "inspect", tag, "--format", "{{.Id}}"])).stdout.trim();
  return { referenz: `${tag}@${imageId}`, imageId };
}

/** Wegwerf-Instanz: Secrets pro Lauf zufaellig in einem Temp-Verzeichnis, nie im Repo. */
export function testInstanz(o: { image: string; zusatzDateien?: string[]; projekt?: string; httpsPort?: number; httpPort?: number }) {
  const projekt = o.projekt ?? TEST.projekt, httpsPort = o.httpsPort ?? TEST.httpsPort, httpPort = o.httpPort ?? TEST.httpPort;
  const verzeichnis = mkdtempSync(join(tmpdir(), `${projekt}-`));
  const secrets = join(verzeichnis, "secrets");
  erzeugeSecrets(secrets);
  const envDatei = join(verzeichnis, "instanz.env");
  const basis = `https://localhost:${httpsPort}`;
  let vorne = vorneAdressen("172.31.240.0/29");
  const schreibeEnv = (image: string) => writeFileSync(envDatei, [
    `PLANORA_VORNE_SUBNETZ=${vorne.subnetz}`, `PLANORA_PROXY_IP=${vorne.proxy}`, `PLANORA_API_IP=${vorne.api}`,
    `PLANORA_SECRETS=${secrets.replace(/\\/g, "/")}`, "PLANORA_DOMAIN=localhost", "PLANORA_TLS=internal",
    `PLANORA_HTTPS_PORT=${httpsPort}`, `PLANORA_HTTP_PORT=${httpPort}`, `PLANORA_BASE_URL=${basis}`, `PLANORA_IMAGE_APP=${image}`, "",
  ].join("\n"));
  schreibeEnv(o.image);
  const dateien = [join(BETRIEB, "compose.yaml"), ...(o.zusatzDateien ?? [])];
  const basisArgs = ["compose", "-p", projekt, "--env-file", envDatei, ...dateien.flatMap((d) => ["-f", d])];
  const compose = (args: string[], opt: Parameters<typeof docker>[1] = {}) => docker([...basisArgs, ...args], opt);
  let angelegt = false;
  return {
    verzeichnis, envDatei, secrets, basis, projekt, composeDateien: dateien, compose, schreibeEnv,
    get vorne() { return vorne; },
    /**
     * Startet das Paket. Existiert das Projekt oder eines seiner Volumes bereits, wird abgebrochen und NICHTS geloescht:
     * es koennte ein fremder oder parallel laufender Stand sein (PP9-2).
     */
    async starte() {
      const projekte = (JSON.parse((await docker(["compose", "ls", "-a", "--format", "json"])).stdout || "[]") as { Name: string }[]).map((p) => p.Name);
      const volumes = (await docker(["volume", "ls", "--format", "{{.Name}}"])).stdout.split(/\r?\n/).filter((v) => v.startsWith(`${projekt}_`));
      if (projekte.includes(projekt) || volumes.length) {
        throw new Error(`Compose-Projekt ${projekt} existiert bereits (Volumes: ${volumes.join(", ") || "keine"}). Der Test loescht keine fremden Ressourcen: `
          + "anderes Projekt per PLANORA_TEST_PROJEKT/PLANORA_TEST_HTTPS_PORT/PLANORA_TEST_HTTP_PORT waehlen oder selbst abbauen.");
      }
      // freies /29 fuer das Netz vorne waehlen (wie planora install)
      const ids = (await docker(["network", "ls", "-q"])).stdout.split(/\r?\n/).filter(Boolean);
      const belegt = (await docker(["network", "inspect", ...ids, "--format", "{{range .IPAM.Config}}{{.Subnet}} {{end}}"])).stdout.split(/\s+/).filter(Boolean);
      vorne = vorneAdressen(waehleVorneSubnetz(belegt));
      schreibeEnv(o.image);
      angelegt = true;
      await compose(["up", "-d", "--pull", "never", "--wait", "--wait-timeout", "300"], { timeoutMs: 400_000 });
    },
    /** Als selbst angelegt markieren (Installation ueber das Werkzeug statt starte()). */
    markiereAngelegt() { angelegt = true; },
    async containerId(dienst: string) { return (await compose(["ps", "-a", "-q", dienst])).stdout.trim().split(/\r?\n/)[0]; },
    async inspect(dienst: string) { return JSON.parse((await docker(["inspect", await this.containerId(dienst)])).stdout)[0]; },
    /** SQL ueber den lokalen Socket im db-Container (wie das Betriebswerkzeug). */
    async sql(rolle: string, sql: string, opt: { erlaubeFehler?: boolean } = {}) {
      const r = await compose(["exec", "-T", "db", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", rolle, "-d", "planora", "-At", "-c", sql], opt);
      return { ...r, text: r.stdout.trim() };
    },
    /** Baut nur ab, was dieser Lauf selbst angelegt hat. */
    async aufraeumen() {
      if (angelegt) await compose(["--profile", "konsole", "down", "-v", "--remove-orphans"], { erlaubeFehler: true, timeoutMs: 300_000 });
      rmSync(verzeichnis, { recursive: true, force: true });
    },
  };
}
export type TestInstanz = ReturnType<typeof testInstanz>;

export type Antwort = { status: number; headers: Record<string, string | string[] | undefined>; text: string; json: () => any };
/** HTTPS gegen Caddy mit `tls internal`: Zertifikat der Caddy-eigenen CA wird im Test nicht geprueft (wie curl -k). */
export function https(basis: string, methode: string, pfad: string, o: { headers?: Record<string, string>; body?: object } = {}): Promise<Antwort> {
  return new Promise((ok, fehler) => {
    const daten = o.body ? JSON.stringify(o.body) : undefined;
    const req = request(new URL(pfad, basis), {
      method: methode, rejectUnauthorized: false, timeout: 30_000,
      headers: { ...(daten ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(daten)) } : {}), ...o.headers },
    }, (res) => {
      let text = ""; res.setEncoding("utf8"); res.on("data", (d) => { text += d; });
      res.on("end", () => ok({ status: res.statusCode ?? 0, headers: res.headers, text, json: () => JSON.parse(text) }));
    });
    req.on("timeout", () => req.destroy(new Error("Zeitueberschreitung HTTPS")));
    req.on("error", fehler);
    req.end(daten);
  });
}
export const cookies = (a: Antwort) => ([] as string[]).concat(a.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");

/** Setup-Token auf der Host-Konsole erzeugen und Erstadmin anlegen; liefert die Zugangsdaten des Testlaufs. */
export async function legeErstadminAn(inst: TestInstanz, email = "admin@planora.invalid") {
  const token = (await inst.compose(["--profile", "konsole", "run", "--rm", "-T", "konsole", "setup-token"])).stdout.trim().split(/\r?\n/).pop()!;
  const passwort = randomBytes(15).toString("base64url");
  const r = await inst.compose(["--profile", "konsole", "run", "--rm", "-T", "konsole", "erstadmin"], { eingabe: JSON.stringify({ token, email, name: "Admin", passwort }) });
  return { token, email, passwort, benutzerId: JSON.parse(r.stdout.trim().split(/\r?\n/).pop()!).benutzerId as string };
}
export async function melde(inst: TestInstanz, email: string, passwort: string) {
  return https(inst.basis, "POST", "/api/auth/sign-in/email", { headers: { origin: inst.basis }, body: { email, password: passwort } });
}
