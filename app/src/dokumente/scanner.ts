/** Ergebnis der Virenpruefung; "Fehler gilt nie als sauber": Ausfall wirft. */
export type ScanErgebnis = { ergebnis: "sauber" } | { ergebnis: "befund"; signatur: string };
/** Port Virenpruefung (Spec Anlagenakte Abschnitt 3). Produktion: clamd (clamd.ts), Entwicklung/Tests: fakeScanner. */
export interface VirenScanner { pruefe(daten: Buffer): Promise<ScanErgebnis> }

// EICAR-Testzeichenkette aus zwei Teilen: die Quelldatei selbst darf keinen Virenscanner ausloesen.
export const EICAR = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join("");

/** Meldet sauber, lehnt jede Datei mit der EICAR-Zeichenkette ab; `ausfall` simuliert einen nicht erreichbaren Scanner. */
export function fakeScanner(o: { ausfall?: () => boolean; verzoegerungMs?: number } = {}): VirenScanner & { aufrufe: number } {
  const s = {
    aufrufe: 0,
    async pruefe(daten: Buffer): Promise<ScanErgebnis> {
      s.aufrufe++;
      if (o.verzoegerungMs) await new Promise((r) => setTimeout(r, o.verzoegerungMs));
      if (o.ausfall?.()) throw new Error("Fake-Scanner: Ausfall");
      return daten.includes(EICAR) ? { ergebnis: "befund", signatur: "Eicar-Test-Signature" } : { ergebnis: "sauber" };
    },
  };
  return s;
}

/** clamd-Adresse aus der Umgebung; ohne PLANORA_CLAMD_HOST null (Entwicklung: Fake; Produktion bricht in start/api.ts ab). */
export function scannerKonfig(env: NodeJS.ProcessEnv): { host: string; port: number } | null {
  const host = env.PLANORA_CLAMD_HOST?.trim();
  if (!host) return null;
  const port = Number(env.PLANORA_CLAMD_PORT?.trim() || "3310");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PLANORA_CLAMD_PORT ungueltig");
  return { host, port };
}
