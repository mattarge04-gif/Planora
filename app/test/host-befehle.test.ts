// PP11a-N (Befund 8, Verdrahtung): echte host-cli-Befehlsauswertung mit Fake-Docker, ohne Prozessstart.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hostBefehl } from "../src/betrieb/host-befehle.js";
import type { Ausfuehrer } from "../src/betrieb/update/docker.js";

let dir: string, alt: Record<string, string | undefined>;
const instanz = "kunde-a";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "planora-hostbefehl-"));
  alt = { etc: process.env.PLANORA_ETC, var: process.env.PLANORA_VAR };
  process.env.PLANORA_ETC = join(dir, "etc"); process.env.PLANORA_VAR = join(dir, "var");
  mkdirSync(join(dir, "etc", instanz), { recursive: true }); mkdirSync(join(dir, "bundle"));
  writeFileSync(join(dir, "etc", instanz, "instanz.env"), `PLANORA_BUNDLE_DIR=${join(dir, "bundle").replace(/\\/g, "/")}\nPLANORA_DOMAIN=planora.test\n`);
});
afterEach(() => {
  for (const [k, v] of [["PLANORA_ETC", alt.etc], ["PLANORA_VAR", alt.var]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  rmSync(dir, { recursive: true, force: true });
});
const journal = () => readFileSync(join(dir, "var", instanz, "alarm", "journal.jsonl"), "utf8").trim().split("\n").map((z) => JSON.parse(z));

function fakeDocker(o: { reconcileFehler: () => boolean }) {
  const aufrufe: string[] = [];
  const docker: Ausfuehrer = async (args) => {
    const b = args.includes("reconcile") ? "reconcile" : args.includes("journal") && args.includes("up") ? "journal-up" : args.includes("sichern") ? "sichern" : args.includes("aufbewahren") ? "aufbewahren" : args.includes("psql") ? "psql" : args[0];
    aufrufe.push(b);
    if (b === "reconcile" && o.reconcileFehler()) return { code: 1, stdout: "", stderr: "Engine weg" };
    if (b === "ps") return { code: 0, stdout: "", stderr: "" };
    if (b === "psql") return { code: 0, stdout: "false", stderr: "" };
    if (b === "reconcile") return { code: 0, stdout: JSON.stringify({ fehlgeschlagen: 0 }), stderr: "" };
    return { code: 0, stdout: JSON.stringify({ ok: b, offeneSaetze: 0 }), stderr: "" };
  };
  return { docker, aufrufe };
}

describe("host-cli Verdrahtung", () => {
  it("dienst: initialer Reconcile-Fehler beendet den Dienst nicht; Wiederholung im 5-min-Takt, Stoerung einmal gemeldet", async () => {
    let runden = 0;
    const ende = new AbortController();
    const f = fakeDocker({ reconcileFehler: () => runden < 3 });
    const wartezeiten: number[] = [];
    await hostBefehl(["dienst", "--instanz", instanz], { docker: f.docker, ende: ende.signal, warte: async (ms) => { wartezeiten.push(ms); if (++runden >= 14) ende.abort(); } });
    expect(f.aufrufe.filter((x) => x === "reconcile").length).toBeGreaterThanOrEqual(4);
    expect(f.aufrufe.filter((x) => x === "journal-up")).toHaveLength(1);
    expect(wartezeiten.every((w) => w === 300_000)).toBe(true);
    const arten = journal().map((j) => j.art);
    expect(arten.filter((a) => a === "erzeugt")).toHaveLength(2); // Stoerung + Behoben
    expect(arten.filter((a) => a === "aggregiert")).toHaveLength(2);
    expect(journal().find((j) => j.art === "erzeugt").ereignis.text).toMatch(/^Backup-Reconcile fehlgeschlagen/);
  });
  it("sichern/aufbewahren: nutzen update.lock/update.json der Instanz und geben die Sperre frei", async () => {
    const f = fakeDocker({ reconcileFehler: () => false });
    await hostBefehl(["sichern", "--instanz", instanz, "--anlass", "manuell"], { docker: f.docker });
    await hostBefehl(["aufbewahren", "--instanz", instanz], { docker: f.docker });
    expect(f.aufrufe.filter((x) => ["sichern", "aufbewahren"].includes(x))).toEqual(["sichern", "aufbewahren", "aufbewahren"]);
    expect(existsSync(join(dir, "var", instanz, "update.lock"))).toBe(false);
    // Verwaiste Restore-Sperre derselben Instanz: Sicherung ausgesetzt, Exitcode 75
    writeFileSync(join(dir, "var", instanz, "update.lock"), JSON.stringify({ pid: 2 ** 22 + 1, host: (await import("node:os")).hostname(), zweck: "Restore" }));
    const vorher = process.exitCode;
    await hostBefehl(["sichern", "--instanz", instanz], { docker: f.docker });
    expect(process.exitCode).toBe(75);
    process.exitCode = vorher;
  });
});
