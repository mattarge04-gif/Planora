import { parentPort, workerData } from "node:worker_threads";
import { AuslesenFehler, liesText } from "./auslesen.js";

// Eingang von liesTextBegrenzt: Buffer kommt als Uint8Array an (structured clone).
const { d, mime } = workerData as { d: Uint8Array; mime: string };
liesText(Buffer.from(d.buffer, d.byteOffset, d.byteLength), mime).then(
  (ergebnis) => parentPort!.postMessage({ ergebnis }),
  (e) => parentPort!.postMessage({ fehler: e instanceof Error ? e.message.slice(0, 200) : "unbekannt", eigen: e instanceof AuslesenFehler }));
