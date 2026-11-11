// PP11a-6: Die echten CLI-Einstiege `planora sichern|aufbewahren` laufen ueber das Host-Werkzeug (Sperre,
// Update-Koordination, Alarm) und nicht mehr direkt in den Backup-Container.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PLANORA = resolve("..", "betrieb", "planora");
const sh = [process.env.PLANORA_SH, "sh", "C:/Program Files/Git/bin/sh.exe", "C:/Program Files/Git/usr/bin/sh.exe"].filter((x): x is string => !!x)
  .find((k) => { try { execFileSync(k, ["-c", "true"], { stdio: "ignore" }); return true; } catch { return false; } });

describe.skipIf(!sh)("planora Shell-Einstieg", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "planora-einstieg-"));
    mkdirSync(join(dir, "werkzeug", "betrieb"), { recursive: true });
    // Platzhalter des Host-Werkzeugs: protokolliert nur, womit es aufgerufen wurde.
    writeFileSync(join(dir, "werkzeug", "betrieb", "host-cli.js"), `require("node:fs").appendFileSync(${JSON.stringify(join(dir, "aufrufe.jsonl"))}, JSON.stringify(process.argv.slice(2)) + "\\n");`);
    writeFileSync(join(dir, "werkzeug", "package.json"), JSON.stringify({ type: "commonjs" }));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const planora = (...args: string[]) => spawnSync(sh!, [PLANORA, ...args], { env: { ...process.env, PLANORA_WERKZEUG: join(dir, "werkzeug"), PLANORA_ETC: join(dir, "etc") }, encoding: "utf8" });
  const aufrufe = () => readFileSync(join(dir, "aufrufe.jsonl"), "utf8").trim().split("\n").map((z) => JSON.parse(z));

  it("sichern und aufbewahren gehen mit allen Argumenten an host-cli", () => {
    expect(planora("sichern", "--instanz", "kunde-a", "--anlass", "manuell").status).toBe(0);
    expect(planora("aufbewahren", "--instanz", "kunde-a").status).toBe(0);
    expect(aufrufe()).toEqual([["sichern", "--instanz", "kunde-a", "--anlass", "manuell"], ["aufbewahren", "--instanz", "kunde-a"]]);
  });
  it("journal und freigabe bleiben Container-Befehle (verlangen eine installierte Instanz)", () => {
    const r = planora("journal", "--instanz", "kunde-a", "--einmal");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/nicht installiert/);
    expect(aufrufe()).toHaveLength(2);
  });
});
