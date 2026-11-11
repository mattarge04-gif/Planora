# M1-Lizenznachtrag Spur B, 2026-11-11

**12 der 14 urspruenglich offenen Zuordnungen geschlossen; 2 begruendete `[?]`-Restpunkte.** Der Folgeauftrag, technisch Belegbares zu ergaenzen und den Rest fuer die menschliche Freigabe auszuweisen, ist damit erledigt. Menschliche Lizenz-/Lieferfreigabe und echte VM-Abnahme bleiben wie beauftragt offen und sind kein Fehler dieses Auftrags.

Eigener Branch `mattarge04-gif/m1-abnahme-b`, Folge von `9502af7`; kein Push/Merge, keine Docker-Ressourcen oder WSL-Distributionen angelegt/veraendert. Anwendungscode und die vier Image-SBOM-Saetze bleiben unveraendert.

## Belegte Zuordnungen

| Komponente | Beleg |
|---|---|
| Drei AWS-Pakete: `credential-provider-http@3.972.86`, `credential-provider-login@3.972.91`, `nested-clients@3.998.3` | Name, Version und Apache-2.0 jeweils am Release-Commit `dee2abd898e7d1c69dd5ca5d74ecdce92e47d19d` geprueft; gemeinsamer LICENSE-Text mit ausdruecklichem Amazon-Copyright. `nested-clients` liegt dort unter `packages-internal`, anders als im veralteten Registry-Verzeichnisverweis. |
| `@node-rs/argon2-linux-x64-gnu@2.2.2` | Binaer-README, exakte optionalDependency im Elternpaket `@node-rs/argon2@2.2.2`, uebereinstimmende MIT-Deklaration und Eltern-LICENSE mit Copyright. |
| `@rolldown/binding-linux-x64-gnu@1.2.18` | Binaer-README, exakte optionalDependency in `rolldown@1.2.18`, uebereinstimmende MIT-Deklaration und Eltern-LICENSE mit Copyright. |
| `pg-types@2.2.0`, `pgpass@1.0.5` | Vollstaendiger MIT-Lizenztext einschliesslich komponenteneigenem Copyright direkt in der jeweiligen Paket-README; die bisherige Suche nur nach separaten LICENSE-Dateien war hier zu eng. |
| `spdx-exceptions@2.5.0` | Exakte README mit Copyright/Attribution von Linux Foundation und Contributors sowie Paketautor-Hinweis; CC-BY-3.0-Volltext beigefuegt. |
| `spdx-license-ids@3.0.23` | Exakte README mit ausdruecklicher CC0-Zuordnung, Paket-/Autorenmetadaten und CC0-1.0-Volltext. |
| `drizzle-orm@0.45.4` | npm-Archiv-SHA512 mit dem Subjekt der Registry-Provenance abgeglichen; LICENSE am darin angegebenen Quellcommit `eab8bedbb65d5429c54e612ddbd88aa23091d398`. [A] Die Sigstore-Signatur wurde nicht verifiziert; keine solche Verifikation behauptet. |
| `abstract-logging@2.0.1` | Exakte README verweist auf die Autorenlizenz `jsumners.mit-license.org`; versionierter Hosting-Quellcode belegt den Copyright-Namen James Sumners und die vollstaendige MIT-Vorlage. Kein Copyright-Jahr erfunden oder eingesetzt. |
| `@npmcli/agent@4.0.2` | Debian-Snapshot `npm 11.19.0+ds1-1` enthaelt exakt diese Paketversion; `debian/copyright` dokumentiert fuer `node_modules/*` Copyright npm, Inc. und den vollstaendigen ISC-Text. Die davon abweichende Autorenangabe GitHub Inc. aus dem exakten npm-Paket bleibt ebenfalls beigefuegt und in der menschlichen Checkliste sichtbar. |

Alle heruntergeladenen npm-Archive werden gegen die SHA512-Integritaetsangabe der exakten Registry-Version geprueft. Debian-Archive sind anhand ihrer Snapshot-Hashes kontrolliert; die extrahierten Belege tragen zudem Archiv-SHA256, Mitgliedspfad und eigene SHA256. Dateien bleiben unveraendert im komprimierten Belegarchiv. Weder Paketcode noch Installationsskripte der untersuchten Upstream-Pakete werden ausgefuehrt.

Quellen-URLs, Begruendungen, Archivmitglieder und Pruefsummen stehen komponentengenau in [zuordnungen-nachtrag.json](../../../betrieb/abnahme/dossier-2026-11-11/zuordnungen-nachtrag.json) und `upstream-nachweis.json`. Der vorhandene [Dossierordner](../../../betrieb/abnahme/dossier-2026-11-11) enthaelt die Texte in `upstream-lizenzen.tar.gz`.

## Zwei verbleibende Restpunkte

- `[?] benchmarks@1.0.0`: Die SBOM fasst zwei unterschiedliche mitgelieferte Fixture-Pakete zusammen. Alle vier Fundstellen in App/Backup wurden einzeln dokumentiert. Die Fixture aus `secure-json-parse@4.1.1` ist ueber dessen BSD-3-Clause-Text belegt. Bei `@fastify/deepmerge@3.2.4` deklariert jedoch `benchmark/package.json` ISC, waehrend die Eltern-LICENSE MIT nennt; der Fixture-Autor ist leer und eine eigene Copyright-Datei fehlt. Beide Texte und beide Deklarationen sind gesichert; welche Lizenz fuer die Fixture gelten soll, kann ohne Lizenz-Owner-/Upstream-Klaerung nicht eindeutig belegt werden.
- `[?] planora-app@1.0.0`: Privates eigenes Projekt ohne Lizenz-/Liefertext im Repository. Der Produkt-Owner muss Eigentum und vertragliches Liefermodell dokumentieren. Keine externe Open-Source-Lizenz fuer den eigenen Code erfunden.

Die vorlaeufige Zahl 13/1 wurde durch die frische Wiederholung und deren strengere Fixture-Pruefung auf **12/2** korrigiert. Diese Pruefung verhindert, dass widerspruechliche Paketmetadaten stillschweigend durch eine Elternlizenz ersetzt werden. Beide Restpunkte sind in [OFFENE-TEXTE.md](../../../betrieb/abnahme/dossier-2026-11-11/OFFENE-TEXTE.md) begruendet und in [FREIGABE.md](../../../betrieb/abnahme/dossier-2026-11-11/FREIGABE.md) als menschliche Klaerungspunkte markiert.

## Wiederholung und Validierung

```powershell
python betrieb/abnahme/lizenz-luecken.py betrieb/abnahme/dossier-2026-11-11
python betrieb/abnahme/pruefe-dossier.py betrieb/abnahme/dossier-2026-11-11
```

Der Windows-Abnahmeeinstieg fuehrt die Ergaenzung nach der Upstream-Sammlung ebenfalls aus. Die Regeln sind an die gelieferten Paketversionen gebunden; fehlende oder abweichende Belege werden als `[?]` mit Grund erhalten.

- Frischer Replay aus den urspruenglichen 14 offenen Eintraegen von `9502af7`: **9.43 s**, 12 geschlossen/2 offen; alle 14 Faelle durchlaufen, alle vier Fixture-Fundstellen erfasst.
- Zweiter Aufruf: drei Ergebnisdateien (`upstream-lizenzen.tar.gz`, `upstream-nachweis.json`, `zuordnungen-nachtrag.json`) bytegleich. Deterministische Archivierung und keine neuen Quellsuchen fuer bereits gepruefte Eintraege.
- Dossier-Selbstpruefung: 4 Images, 12 SBOM-Dateien, 1099 Paketvorkommen, 529 Upstream-Pakete, 50 SPDX-Standardtexte; **839 Lizenzbeleg-Referenzen** anhand ihres archivierten Inhalts geprueft.
- Negativpruefung: Manipulierte Lizenzbeleg-Pruefsumme fuehrt zu Fehler `Falscher Lizenzbeleg`.
- `npm ci`: 156 Pakete installiert, Exit 0; `npm test`: **250 bestanden, 24 uebersprungen, 38.77 s**; `npm run pruefe:typen`: Exit 0. Bekannte pg-Deprecation-Warnung ohne Testfehler.
- Python-/PowerShell-Syntax und `git diff --check` bestanden. Dossier-Gesamtpruefsummen werden nach der Ergaenzung neu erzeugt und gegen die eingecheckten Bytes kontrolliert.

Keine erneute Linux-/VM-Probe erforderlich: Dieser Nachtrag veraendert ausschliesslich Lizenzsammlung, Zuordnungen und Dokumentation. Die vorherigen Betriebsnachweise bleiben im ersten Bericht erhalten.
