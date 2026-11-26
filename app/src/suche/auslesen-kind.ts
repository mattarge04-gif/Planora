import { Worker } from "node:worker_threads";
import { AuslesenFehler, liesAbschnitte } from "./auslesen.js";

// Kindprozess von liesTextBegrenzt. Unter Linux (Server) misst der Elternprozess die RSS ueber /proc. Anderswo (Entwicklung unter
// Windows/macOS) ein eigener Waechter-Thread: laeuft weiter, wenn der Hauptthread in pdf.js blockiert, und beendet den Prozess
// ueber der RSS-Grenze (argv[2] MB).
if (process.platform !== "linux") new Worker(`const { workerData } = require("node:worker_threads");
setInterval(() => { if (process.memoryUsage.rss() > workerData) process.kill(process.pid, "SIGKILL"); }, 250);`,
{ eval: true, workerData: Number(process.argv[2]) * 1024 * 1024 }).unref();

process.once("message", ({ d, mime }: { d: Uint8Array; mime: string }) => {
  liesAbschnitte(Buffer.from(d.buffer, d.byteOffset, d.byteLength), mime).then(
    (ergebnis) => process.send!({ ergebnis }),
    (e) => process.send!({ fehler: e instanceof Error ? e.message.slice(0, 200) : "unbekannt", eigen: e instanceof AuslesenFehler }));
}); // beendet wird das Kind vom Elternprozess nach der Antwort
