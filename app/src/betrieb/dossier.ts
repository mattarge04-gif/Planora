import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { leseArgumente } from "./install/argumente.js";
import { pruefeRelease } from "./release.js";

const { werte: w } = leseArgumente(process.argv.slice(2), ["bundle", "schluessel", "lockfile", "ausgabe"]);
if (!w.bundle || !w.schluessel || !w.lockfile || !w.ausgabe) throw new Error("Aufruf: dossier --bundle <pfad> --schluessel <pub> --lockfile <package-lock.json> --ausgabe <neuer Ordner>");
const r = pruefeRelease(readFileSync(join(w.bundle, "release.json"), "utf8"), readFileSync(w.schluessel, "utf8"));
const lock = JSON.parse(readFileSync(w.lockfile, "utf8"));
const ausgabe = resolve(w.ausgabe); mkdirSync(ausgabe); // Vorhandenes Dossier nie ueberschreiben.
writeFileSync(join(ausgabe, "komponenten.json"), JSON.stringify({ release: r, npm: lock.packages, status: "UNGEPRUEFT" }, null, 2));
writeFileSync(join(ausgabe, "FREIGABE.md"), `# Lizenz-Dossier ${r.version}\n\nStatus: offen, keine Lieferfreigabe. Owner: Matt.\n\n- [ ] Image-SBOMs samt transitiven Betriebssystempaketen erzeugen und pruefen\n- [ ] Lizenztexte und Notices fuer alle Komponenten beilegen\n- [ ] Node/PostgreSQL/Caddy, restic (BSD-2-Clause), age (BSD-3-Clause), AWS SDK (Apache-2.0) pruefen\n- [ ] ClamAV (GPLv2) auch als optional geliefertes Image bewerten\n- [ ] Update-/Backup-Image-Digests gegen signiertes Release abgleichen\n- [ ] Lizenz-Owner und juristische Lieferfreigabe dokumentieren\n\nkomponenten.json enthaelt Lockfile-Metadaten und das verifizierte Release, noch keinen vollstaendigen Image-SBOM.\n`);
