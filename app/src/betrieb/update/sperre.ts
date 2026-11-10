// Offene psql-Sitzung: Session-Advisory-Lock ueberlebt einzelne Docker-Aufrufe, aber keinen DB-Neustart.
import { spawn } from "node:child_process";
import { composeArgs, dockerBinary, dockerProzessEnv, type InstanzPfad } from "./docker.js";
import { leseEnv } from "../install/plan.js";

export async function dbSperre(i: InstanzPfad, binary = dockerBinary()) {
  const p = spawn(binary, [...composeArgs(i), "exec", "-T", "db", "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "planora_betrieb", "-d", leseEnv(i.envDatei).PLANORA_DB_NAME ?? "planora"], { env: dockerProzessEnv(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let verloren: Error | undefined, geschlossen = false, puffer = "", nummer = 0;
  const wartend = new Map<string, { ok: () => void; fehler: (e: Error) => void; timer: NodeJS.Timeout }>();
  const verliere = (e: Error) => { verloren = e; for (const w of wartend.values()) { clearTimeout(w.timer); w.fehler(e); } wartend.clear(); };
  p.on("error", () => verliere(new Error("DB-Updatesperre nicht erreichbar")));
  p.on("close", () => { if (!geschlossen) verliere(new Error("DB-Updatesperre verloren; Wartung bleibt aktiv")); });
  p.stdin.on("error", () => {}); p.stderr.on("data", () => {}); // Keine Zugangsdaten/SQL-Ausgaben in Fehlermeldungen.
  p.stdout.on("data", (d) => {
    puffer += d.toString();
    for (;;) {
      const n = puffer.indexOf("\n"); if (n < 0) break;
      const zeile = puffer.slice(0, n).trim(); puffer = puffer.slice(n + 1);
      if (zeile === "PLANORA_LOCK_BUSY") { verliere(new Error("Anderer Update-Vorgang haelt die DB-Sperre")); continue; }
      const w = wartend.get(zeile); if (w) { clearTimeout(w.timer); wartend.delete(zeile); w.ok(); }
    }
  });
  const probe = (erst = false) => new Promise<void>((ok, fehler) => {
    if (verloren) { fehler(verloren); return; }
    const marker = `PLANORA_LOCK_${++nummer}`;
    const timer = setTimeout(() => verliere(new Error("DB-Updatesperre antwortet nicht")), 5000);
    wartend.set(marker, { ok, fehler, timer });
    p.stdin.write(erst
      ? `select case when pg_try_advisory_lock(7310003) then '${marker}' else 'PLANORA_LOCK_BUSY' end;\n`
      : `select '${marker}';\n`);
  });
  try { await probe(true); } catch (e) { geschlossen = true; p.stdin.end("\\q\n"); p.kill(); throw e; }
  const heartbeat = setInterval(() => { if (!wartend.size && !verloren) void probe().catch(() => {}); }, 1000);
  return {
    async pruefen() { await probe(); },
    async loesen() {
      geschlossen = true; clearInterval(heartbeat);
      verliere(new Error("DB-Updatesperre beendet"));
      await new Promise<void>((ok) => {
        if (p.exitCode !== null) { ok(); return; }
        const t = setTimeout(() => { p.kill(); ok(); }, 3000);
        p.once("close", () => { clearTimeout(t); ok(); });
        p.stdin.end("\\q\n");
      });
    },
  };
}
