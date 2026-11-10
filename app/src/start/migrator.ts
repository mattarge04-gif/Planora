import { migriere } from "../db/migrator.js";
import { dbKonfig, env, logge, release, starte } from "./konfig.js";

// Einstieg des einmaligen Containers `migrator` (Spec §3, §5). Die Login-Rolle planora_migrator hat selbst keine
// Rechte am Schema; die Verbindung wechselt per Startparameter in die Eigentuemerrolle planora_owner (NOLOGIN), unter
// der alle Objekte entstehen. Advisory-Lock, Journal und Pruefsummen liegen in migriere(); Exit 0 nur, wenn alle
// Migrationen angewendet oder bereits bekannt sind.
starte(async () => {
  const verzeichnis = env("PLANORA_MIGRATIONEN", "");
  const rolle = env("PLANORA_EIGENTUEMER_ROLLE", "planora_owner");
  if (!/^[a-z_][a-z0-9_]*$/.test(rolle)) throw new Error("PLANORA_EIGENTUEMER_ROLLE ungueltig");
  const r = await migriere({ ...dbKonfig("planora_migrator", { abfrageMs: 0 }), options: `-c role=${rolle}` }, verzeichnis || undefined);
  logge("migriert", { release: release(), angewendet: r.angewendet });
});
