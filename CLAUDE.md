# Planora – Projektkontext fuer Claude

## 0. Wie diese Datei zu nutzen ist

Kurzer Einstieg fuer jede neue Sitzung. Sie ersetzt die bestehenden Einstiegsdokumente nicht, sondern verweist darauf. Was gilt, steht in Abschnitt 0b; wie es dazu kam, steht in `docs/arbeitsjournal.md` (neueste Sitzung zuoberst).

Kennzeichnung: **[F]** Fakt (bestaetigt), **[A]** Annahme (vor dem Bauen pruefen), **[?]** offene Frage. Sprache de-CH, kein Eszett. Keine Zugangsdaten, Schluessel oder Personendaten in diese Datei – nur Fundorte.

Einstiegsdokumente (in dieser Reihenfolge lesen):

1. `README.md` – Ueberblick, lokale Pruefung
2. `docs/superpowers/plans/2026-11-11-fortsetzung.md` – aktueller Fortschritt, Teststand, naechste Aufgaben
3. `docs/architektur/00-kontext.md` – alle PO-Entscheide (E1–E39), neueste oben
4. `betrieb/README.md` – Betrieb, Docker-Pruefungen, Abnahme

Abschnitt 0b gewinnt bei Widerspruch zu aelteren Abschnitten; massgeblich fuer Entscheide bleibt `00-kontext.md`.

## 0b. Stand – zuletzt aktualisiert 11.11.2026

### Entschieden [F]

| Thema | Stand |
|---|---|
| Modell | B2B, eine Instanz pro Kunde, ein Docker-Compose-Paket (E34/E35). Erster Kunde Siemens (E37). |
| Hosting | Planora stellt Server und Domain je Kunde, Kunde ohne eigene IT (E39). |
| Backup-Retention | 14 taeglich / 8 woechentlich / 12 monatlich, PO-freigegeben (E39). |
| Alarm | SMTP an Konto-Adressen des Kunden plus eine Planora-Adresse je Kunde; optional Webhook mit HMAC (E39). Standard-Empfaenger = Admin-Konten, umschaltbar auf alle [A]. |
| Lizenz | Planora proprietaer, Nutzungsrecht je Instanz, kein Quellcode; Fixture @fastify/deepmerge mit MIT- und ISC-Text beilegen (E39). Menschliche Lizenzfreigabe bewusst offen. |
| 3D-Erfassung | Planora bereitet Huelle/Geschosse vor, Kunde erfasst Einheiten und Technik (E38, ADR 0032). Noch nicht implementiert. |
| M1 | Technisch abgeschlossen und lokal abgenommen (WSL-Ersatz-VM), auf `main` gemergt und auf `origin/main` gepusht (b13bbba). |

### Teststand auf main nach M1-Merge [F]

- `npm test` 314 ok / 37 Docker uebersprungen; Typpruefung gruen.
- `test:docker` 32 ok in 440 s; `test:docker:b` 9/9 mit `PLANORA_TEST_PROJEKT=pr-backup`.
- WSL-Gesamtabnahme `betrieb/abnahme/abnahme.ps1` Exit 0 in 417.6 s – nur auf Spur-B-Stand, **nach Merge von Spur A nicht erneut gelaufen**.

### Das Kernproblem, richtig gefasst [F]

M1 (Betriebsfundament) ist gebaut; der Produktnutzen fehlt noch. Naechster Wert entsteht erst mit dem ersten durchgehenden 3D-Schnitt M2/M6 nach E38/ADR 0032.

### Abbruchkriterium [A]

Vorschlag, vom PO nicht bestaetigt: Der erste M2/M6-Schnitt (Datenmodell bis Geschossansicht mit Einheiten) soll innert einer Arbeitswoche lauffaehig auf `main` sein; sonst Umfang des Schnitts mit dem PO verkleinern statt weiterbauen.

### Weiter offen [?]

- Echte CH-VM bestellen und Abnahme (`abnahme.ps1`-Aequivalent) darauf ausfuehren. Kandidat Infomaniak VPS Lite, Preis vor Bestellung bestaetigen [A].
- SMTP-Zugang beschaffen und echten Versandtest machen.
- Menschliche Lizenzfreigabe (bewusst offen).
- [?] Rechtekette Entwickler -> Firma (juristisch).
- [?] Vertrag/AVV mit Siemens, Lieferantenpruefung.
- [?] Braucht das Backup-Image das anonyme `VOLUME /var/lib/postgresql`?
- Aufraeumen: Orca-Worktrees `m1-abnahme-a`/`-b` und Docker-Volumes `planora-b_*` (vom 10.11.) existieren noch.
- [?] WSL-Gesamtabnahme auf dem gemergten main-Stand wiederholen?

### Naechste Coding-Aufgabe

M2/M6 erster 3D-Schnitt nach E38/ADR 0032; Reihenfolge siehe Fortsetzungsplan, Abschnitt "Naechste Coding-Aufgaben".

## Antworten

Rohantworten des PO stehen unveraendert in `docs/architektur/00-kontext.md` (Abschnitte "PO-Antworten", E-Entscheide).
