import { migriere } from "../db/migrator.js";
import { dbKonfig, env, logge, release, starte } from "./konfig.js";

// Einstieg des einmaligen Containers `migrator`: einzige Rolle mit DDL (Spec §3). Advisory-Lock, Journal und
// Pruefsummen liegen in migriere(); Exit 0 nur, wenn alle Migrationen angewendet oder bereits bekannt sind.
starte(async () => {
  const verzeichnis = env("PLANORA_MIGRATIONEN", "");
  const r = await migriere(dbKonfig("planora_migrator"), verzeichnis || undefined);
  logge("migriert", { release: release(), angewendet: r.angewendet });
});
