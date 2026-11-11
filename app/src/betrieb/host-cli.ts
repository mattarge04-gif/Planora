// Einstieg des Host-Werkzeugs (planora start|reconcile|dienst|sichern|aufbewahren|restore|zertifikat|alarm).
// Die Logik liegt in host-befehle.ts, damit die Verdrahtung ohne Prozessstart testbar ist.
import { hostBefehl } from "./host-befehle.js";
import { kurz } from "./alarm/alarm.js";

hostBefehl(process.argv.slice(2)).catch((e) => { console.error(`Betriebsbefehl fehlgeschlagen: ${kurz(e)}`); process.exitCode = 1; });
