// Duenne Schicht ueber der Docker-CLI fuer das Betriebswerkzeug auf dem Host (install, update).
// Nur node:-Module (laeuft ohne node_modules). Kein Docker-Socket in Containern: das Werkzeug ruft die CLI des Hosts.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { leseEnv } from "../install/plan.js";

/** Compose darf keine Konfiguration aus der aufrufenden Shell erben. */
export const dockerProzessEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(PLANORA_|COMPOSE_)/i.test(k)));

export type Lauf = { code: number; stdout: string; stderr: string };
export type AusfuehrOptionen = { eingabe?: string; timeoutMs?: number };
/** docker <args> */
export type Ausfuehrer = (args: string[], o?: AusfuehrOptionen) => Promise<Lauf>;

const DOCKER_WINDOWS = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
export function dockerBinary(): string {
  if (process.env.PLANORA_DOCKER) return process.env.PLANORA_DOCKER;
  return process.platform === "win32" && existsSync(DOCKER_WINDOWS) ? DOCKER_WINDOWS : "docker";
}

export function dockerAusfuehrer(binary = dockerBinary()): Ausfuehrer {
  return (args, o = {}) => new Promise((ok, fehler) => {
    const p = spawn(binary, args, { env: dockerProzessEnv(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const t = setTimeout(() => { p.kill(); fehler(new Error(`Zeitueberschreitung: docker ${args.slice(0, 6).join(" ")} …`)); }, o.timeoutMs ?? 600_000);
    p.stdout.on("data", (d) => { stdout += d; }); p.stderr.on("data", (d) => { stderr += d; });
    p.on("error", (e) => { clearTimeout(t); fehler(new Error(`docker nicht ausfuehrbar: ${e.message}`)); });
    p.on("close", (code) => { clearTimeout(t); ok({ code: code ?? -1, stdout, stderr }); });
    p.stdin.on("error", () => {});
    p.stdin.end(o.eingabe ?? "");
  });
}

/** Wirft bei Exit ≠ 0 mit dem Ende von stderr (Docker-Meldungen enthalten keine Secret-Inhalte, nur Pfade). */
export async function mussGelingen(docker: Ausfuehrer, args: string[], o?: AusfuehrOptionen): Promise<Lauf> {
  const r = await docker(args, o);
  if (r.code !== 0) throw new Error(`docker ${args.slice(0, 8).join(" ")} → Exit ${r.code}: ${(r.stderr || r.stdout).trim().slice(-800)}`);
  return r;
}

/** Eine Instanz = ein Compose-Projekt mit eigener Env-Datei. */
export type InstanzPfad = { projekt: string; envDatei: string; composeDateien: string[] };
export const composeArgs = (i: InstanzPfad) => ["compose", "-p", i.projekt, "--env-file", i.envDatei, ...i.composeDateien.flatMap((d) => ["-f", d])];

/** SQL ueber den lokalen Socket im db-Container (pg_hba: local trust; wer exec darf, ist ohnehin Host-Root). Rueckgabe: -At-Ausgabe. */
export async function sql(docker: Ausfuehrer, i: InstanzPfad, rolle: string, befehl: string): Promise<string> {
  const datenbank = existsSync(i.envDatei) ? leseEnv(i.envDatei).PLANORA_DB_NAME ?? "planora" : "planora";
  const r = await mussGelingen(docker, [...composeArgs(i), "exec", "-T", "db", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", rolle, "-d", datenbank, "-At", "-c", befehl], { timeoutMs: 120_000 });
  return r.stdout.trim();
}

export async function imageId(docker: Ausfuehrer, referenz: string): Promise<string | null> {
  const r = await docker(["image", "inspect", referenz, "--format", "{{.Id}}"], { timeoutMs: 60_000 });
  return r.code === 0 ? r.stdout.trim() : null;
}

export const letzteZeile = (text: string) => text.trim().split(/\r?\n/).pop() ?? "";
