import { expect, it } from "vitest";
import { backupLaeuft, reconcileHost } from "../src/betrieb/host.js";
import type { Ausfuehrer } from "../src/betrieb/update/docker.js";

it("Host bestaetigt nur beendete Backups; One-offs, paused und unbekannte Zustaende halten die Lease", async () => {
  for (const [status, erwartet] of [["exited\ndead", false], ["paused", true], ["created", true], ["restarting", true], ["running", true], ["unbekannt", true]] as const) {
    const aufrufe: string[][] = [];
    const docker: Ausfuehrer = async (args) => { aufrufe.push(args); return { code: 0, stdout: args[0] === "ps" ? (status.includes("\n") ? "a\nb" : "a") : args[0] === "inspect" ? status : "{}", stderr: "" }; };
    expect(await backupLaeuft(docker, "planora-eigen")).toBe(erwartet);
    await reconcileHost(docker, { projekt: "planora-eigen", envDatei: "extern.env", composeDateien: ["compose.yaml", "compose.backup.yaml"] });
    expect(aufrufe.at(-1)?.slice(-3)).toEqual(["reconcile", "--container-laeuft", String(erwartet)]);
    expect(aufrufe[0]).toContain("label=com.docker.compose.project=planora-eigen");
  }
  await expect(backupLaeuft(async () => ({ code: 1, stdout: "", stderr: "Engine weg" }), "planora-eigen")).rejects.toThrow(/Engine weg/);
});
