// Gemeinsame Hilfen der Docker-Integrationstests von Spur A (paket*, update*). Kein Test, nur Werkzeug.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

export async function baueImage(tag: string, release: string) {
  await docker(["build", "-q", "-t", tag, "--build-arg", `PLANORA_RELEASE=${release}`, APP], { timeoutMs: 900_000 });
}

export const SECRET_NAMEN = ["db_superuser_passwort", "db_app_passwort", "db_migrator_passwort", "db_backup_passwort", "db_betrieb_passwort", "auth_secret"] as const;

/** Wegwerf-Instanz: Secrets pro Lauf zufaellig in einem Temp-Verzeichnis, nie im Repo. */
export function testInstanz(o: { projekt: string; httpsPort: number; httpPort: number; image: string; zusatzDateien?: string[] }) {
  const verzeichnis = mkdtempSync(join(tmpdir(), `${o.projekt}-`));
  const secrets = join(verzeichnis, "secrets"); mkdirSync(secrets);
  for (const n of SECRET_NAMEN) writeFileSync(join(secrets, n), randomBytes(32).toString("hex"), { mode: 0o600 });
  const envDatei = join(verzeichnis, "instanz.env");
  const basis = `https://localhost:${o.httpsPort}`;
  const schreibeEnv = (image: string) => writeFileSync(envDatei, [
    `PLANORA_SECRETS=${secrets.replace(/\\/g, "/")}`, "PLANORA_DOMAIN=localhost", "PLANORA_TLS=internal",
    `PLANORA_HTTPS_PORT=${o.httpsPort}`, `PLANORA_HTTP_PORT=${o.httpPort}`, `PLANORA_BASE_URL=${basis}`, `PLANORA_IMAGE_APP=${image}`, "",
  ].join("\n"));
  schreibeEnv(o.image);
  const dateien = [join(BETRIEB, "compose.yaml"), ...(o.zusatzDateien ?? [])];
  const basisArgs = ["compose", "-p", o.projekt, "--env-file", envDatei, ...dateien.flatMap((d) => ["-f", d])];
  const compose = (args: string[], opt: Parameters<typeof docker>[1] = {}) => docker([...basisArgs, ...args], opt);
  return {
    verzeichnis, envDatei, basis, projekt: o.projekt, composeDateien: dateien, compose, schreibeEnv,
    /** SQL ueber den lokalen Socket im db-Container (wie das Betriebswerkzeug). */
    async sql(rolle: string, sql: string, opt: { erlaubeFehler?: boolean } = {}) {
      const r = await compose(["exec", "-T", "db", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", rolle, "-d", "planora", "-At", "-c", sql], opt);
      return { ...r, text: r.stdout.trim() };
    },
    /** Nur das eigene Projekt entfernen (nie fremde Ressourcen). */
    async aufraeumen() {
      await compose(["--profile", "konsole", "down", "-v", "--remove-orphans"], { erlaubeFehler: true, timeoutMs: 300_000 });
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
