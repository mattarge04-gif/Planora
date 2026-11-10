// planora install --instanz <name> --domain <d> --tls acme|internal --schluessel <release.pub> [--acme-kontakt <mail>]
//                 [--https-port n] [--http-port n] [--backup-ziel <ziel>] [--bundle <verzeichnis>]
import { resolve } from "node:path";
import { leseArgumente } from "./argumente.js";
import { dockerAusfuehrer } from "../update/docker.js";
import { dockerInstallUmgebung, installiere } from "./install.js";
import { varWurzel, type TlsModus } from "./plan.js";

async function haupt() {
  const { werte: w } = leseArgumente(process.argv.slice(2), ["instanz", "domain", "tls", "schluessel", "acme-kontakt", "https-port", "http-port", "backup-ziel", "bundle"]);
  for (const k of ["instanz", "domain", "tls", "schluessel"]) if (!w[k]) throw new Error(`Aufruf: planora install --instanz <name> --domain <d> --tls acme|internal --schluessel <release.pub> (--${k} fehlt)`);
  const bundle = resolve(w.bundle ?? process.env.PLANORA_BUNDLE ?? ".");
  const r = await installiere({
    instanz: w.instanz, domain: w.domain, tls: w.tls as TlsModus, acmeKontakt: w["acme-kontakt"], backupZiel: w["backup-ziel"],
    httpsPort: w["https-port"] ? Number(w["https-port"]) : undefined, httpPort: w["http-port"] ? Number(w["http-port"]) : undefined,
    bundle, schluessel: resolve(w.schluessel), melde: (t) => console.error(t),
  }, dockerInstallUmgebung(dockerAusfuehrer(), varWurzel()));
  console.log(`Planora ${r.release} laeuft: ${r.baseURL} (Instanz ${r.instanz}, Projekt ${r.projekt}, Profil P1)`);
  console.log("Setup-Token fuer den Erstadmin (15 Minuten gueltig, nur einmal verwendbar):");
  console.log(r.setupToken);
}

haupt().catch((e) => { console.error(`Fehler: ${(e as Error).message}`); process.exit(1); });
