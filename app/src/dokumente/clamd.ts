import { connect, type Socket } from "node:net";
import type { ScanErgebnis, VirenScanner } from "./scanner.js";

export interface ClamdOptionen { host: string; port: number; timeoutMs?: number; versuche?: number; pauseMs?: number }
const BLOCK = 64 * 1024;
const VERBINDUNG = new Set(["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND", "EAI_AGAIN"]);

/** Ein Befehl an clamd (Befehle mit z-Praefix, Antwort endet mit NUL). */
function sprich(o: ClamdOptionen, sende: (s: Socket) => void): Promise<string> {
  return new Promise((ok, fehler) => {
    const s = connect({ host: o.host, port: o.port });
    const teile: Buffer[] = [];
    let fertig = false;
    s.setTimeout(o.timeoutMs ?? 120_000, () => s.destroy(new Error("clamd: Zeitueberschreitung")));
    s.once("connect", () => sende(s));
    s.on("data", (d: Buffer) => { teile.push(d); if (d.includes(0)) { fertig = true; s.end(); } });
    s.once("error", fehler);
    s.once("close", (mitFehler) => {
      if (mitFehler) return; // error wurde bereits gemeldet
      if (fertig || teile.length) ok(Buffer.concat(teile).toString("utf8").replace(/\0/g, "").trim());
      else fehler(new Error("clamd: Verbindung ohne Antwort beendet"));
    });
  });
}

/**
 * Kurze Wiederholung bei Verbindungsfehlern (kurzer Aussetzer, Neustart des Containers). Sie deckt NICHT das Laden
 * der ClamAV-Signaturen (~1 Minute) ab: dafuer wartet das Compose-Paket per Healthcheck (api startet erst nach clamav).
 */
async function mitWiederholung<T>(o: ClamdOptionen, f: () => Promise<T>): Promise<T> {
  const versuche = o.versuche ?? 3;
  for (let i = 1; ; i++) {
    try { return await f(); }
    catch (e) {
      if (i >= versuche || !VERBINDUNG.has((e as NodeJS.ErrnoException).code ?? "")) throw e;
      await new Promise((r) => setTimeout(r, (o.pauseMs ?? 2000) * i));
    }
  }
}

export function deuteAntwort(antwort: string): ScanErgebnis {
  if (antwort === "stream: OK") return { ergebnis: "sauber" };
  const m = /^stream: (.+) FOUND$/.exec(antwort);
  if (m) return { ergebnis: "befund", signatur: m[1] };
  throw new Error(`clamd: ${antwort.slice(0, 200) || "leere Antwort"}`);
}

/** Produktionsadapter: clamd INSTREAM per TCP (Container clamav im Compose-Paket). */
export function clamdScanner(o: ClamdOptionen): VirenScanner & { ping(): Promise<boolean> } {
  return {
    pruefe: (daten) => mitWiederholung(o, async () => deuteAntwort(await sprich(o, (s) => {
      s.write("zINSTREAM\0");
      for (let i = 0; i < daten.length; i += BLOCK) {
        const teil = daten.subarray(i, i + BLOCK);
        const laenge = Buffer.alloc(4); laenge.writeUInt32BE(teil.length);
        s.write(laenge); s.write(teil);
      }
      s.write(Buffer.alloc(4));
    }))),
    async ping() {
      try { return (await sprich({ ...o, timeoutMs: 5000 }, (s) => s.write("zPING\0"))) === "PONG"; } catch { return false; }
    },
  };
}
