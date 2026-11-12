# Arbeitsjournal Planora

Chronologisch, neueste Sitzung zuoberst. Was gilt, steht in `CLAUDE.md` Abschnitt 0b.
Kennzeichnung: [F] Fakt, [A] Annahme, [?] offene Frage.

## 2026-11-12 – M2b-1 nach Claude-Usage-Abbruch fortgesetzt

- [F] Tagesabschluss vom PO beauftragt: Dokumentation, Commit und Push auf dem Arbeitsbranch; kein Merge/Deployment. Visuelle Endabnahme ausdruecklich offen.
- [F] E40: PO bestaetigt Bild 2 fuer Gebaeude, Bild 3 fuer Technikansicht, Bild 1 fuer Informationskarten. [Referenzen und Zusatzaufwand](design/2026-11-12-visuelle-zielrichtung.md), [dauerhaft gesicherte Screenshots](abnahme/2026-11-12-m2b1/README.md).
- [A] Zusatzaufwand +6–10 PT, Planungswert +8 PT, ohne bereits geplante Funktionen doppelt zu zaehlen. Naechste Sitzung: visueller Zielentwurf am Beispielgebaeude.

- [F] Uebernahme auf `m2b1-sichtbarer-schnitt` bei `376885d`: Tasks 1–5 committet, Task 6 mit fuenf geaenderten Dateien begonnen.
- [F] Docker-Frontend, Web-Lockfile im Lizenz-Dossier inklusive Abnahme-Aufruf und lokaler Demostart fertiggestellt. Der Update-Test kopiert jetzt auch `web/` in seinen Build-Kontext, ohne `node_modules` und `dist`.
- [F] Demostart verwendet frische temporaere Daten, bereinigt laufende Dienste bei Startfehlern und lehnt Produktion/ungueltige Ports ab. Keine bestehenden Entwicklungsdaten werden geloescht.
- [F] Backend 402 Tests, Frontend 19 Tests, Typpruefungen und Build bestanden. Browser: Login, Liste, 3D, Verteiler-Picking mit Restaurant (EG) und Buero C (OG1), keine CSP-Verletzungen. Docker-Stand im aktuellen Fortsetzungsplan.
- [F] Keine WSL-/CH-VM-Gesamtabnahme, keine vollstaendige SBOM-Neuerzeugung, kein Merge/Deployment. README, Spec und Einstieg nachgefuehrt; Branch wird zum Tagesabschluss gepusht.

## 2026-11-11 – M2a Welt-Kern

### 1. Was gemacht wurde

1. M2 vom PO in drei Teile zerlegt: M2a (Kern ohne UI), M2b (3D-Ansicht), M2c (Erfassung/Heizungsassistent). Spec `docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md`, Plan `docs/superpowers/plans/2026-11-11-m2a-welt-kern.md`.
2. Umsetzung per Subagenten (7 Tasks) mit Task-Reviews; Schlussreviews durch Opus und Codex (via Orca), alle Befunde behoben.
3. PR #1 gemergt (`bd5d7a6`), `main` gepusht, Branch `m2a-welt-kern` lokal und remote geloescht.
4. Tests auf main: `npm test` 387 ok / 37 Docker uebersprungen, Typpruefung gruen, `test:docker` 32 ok in 503 s.

### 2. Was inhaltlich gelernt wurde

- [F] PO-Entscheide: normalisierte Tabellen sind die Wahrheit, Beschreibung ist Ein-/Ausgabeformat; stabile IDs per optionaler `id` (ohne id = neu/Kopie, fehlend = loeschen, blockiert bei manueller Position); Heizungsstandard am Gebaeude plus Ausnahmen je Einheit; ein Symbol je Typgruppe unabhaengig von der Menge; Zentrale im Katalog; Flaeche je Einheit optional (Breite/Tiefe erfasst Planora); "bestaetigt" bei unbekannter Menge erlaubt; M2c-Ablauf Struktur, Zentrale, Standard, Ausnahmen, Verteiler; Demo nur Heizung.
- [F] Technische Entscheide: Routen `/api/struktur/...` und `/api/szene/gebaeude/:id/welt`; Katalog/Regelwerk als TS-Module; `bauteil.gebaeude_id`; Recht `huelle.verwalten`; ajv global strikt (`removeAdditional:false`, `coerceTypes:false`); Migration `013_gebaeude.sql`.
- [F] Es gibt noch kein Frontend (kein Vite-Projekt, keine Login-Seite, Caddy liefert nur die Wartungsseite). M2b muss das Geruest mitbringen.
- [A] Regelwerk-v1-Werte (Default-Flaechen, Mengenbereiche, Erlaubt-Matrix) sind Annahmen, PO-Freigabe vor M2b.

### 3. Was ueber die Zusammenarbeit gelernt wurde

- Zerlegen in einen UI-freien Kern zuerst gab pruefbare Schritte; der PO hat die Aufteilung selbst entschieden.
- Doppelte Schlussreview (Opus und Codex) fand weitere Befunde nach den Task-Reviews; lohnt sich vor dem Merge.

### 4. Technisches, das beim naechsten Mal Zeit spart

- Sackgasse: Katalog/Regelwerk als JSON passt nicht zum Docker-Build, der nur `.ts` kopiert. Loesung: TS-Module.
- Jede `/api`-Route muss einem Modul gehoeren; daher die Pfade `/api/struktur/...` und `/api/szene/...`.
- Der Update-Test im Docker-Lauf war an eine feste Migrationsnummer gebunden und brach mit der neuen Migration `013`. Er leitet jetzt die letzte Migration ab, die Probe heisst `999_updateprobe.sql`.
- `test:docker` dauert rund 8.5 min, im Hintergrund starten.

### 5. Wo es weitergeht

1. M2b spezifizieren (Brainstorming, Spec, Plan): Frontend-Geruest (React/Vite, ADR 0004), Login, 3D-Ansicht (ADR 0008/0032): Uebersicht, Geschossauswahl, Explosion, Seitenpanel, Leistungsstufen, Tabellenweg.
2. [?] Offene M2a-Nachtraege (Spec Abschnitt 11): 400-Fehlerformat vereinheitlichen, Regelwerk-v2-Guard im Generator, `aendereHuelle` ohne Stand-Pruefung u.a., vor M2b.
3. [A] Regelwerk-v1 vom PO freigeben lassen.
4. [?] WSL-Gesamtabnahme auf main wiederholen; weiter offen wie im Eintrag darunter (CH-VM, SMTP, Lizenz, Aufraeumen).
5. Abbruchkriterium [A] bleibt: Datenteil fertig, sichtbarer Teil fehlt.

## 2026-11-11 – M1-Abnahme mit Opus und Codex

### 1. Was gemacht wurde

1. PO-Auftrag: M1 abschliessen mit zwei Agenten (Orca-Run `run_50ccbfb66dc9`).
   - Spur A (Opus, Worktree `m1-abnahme-a`): Kunden-CA (TLS-Modus `kundenzertifikat`, Rotation/Rueckrollen), Retention 14/8/12, Alarmkanal (SMTP, optional Webhook mit HMAC).
   - Spur B (Codex, Worktree `m1-abnahme-b`): WSL-Ersatz-VM-Abnahme (offline, Bind-Mounts/UID, systemd-Timer, 2 Instanzen, Backup/Restore), VM-Totalverlust-Probe, SBOM/Lizenzdossier.
2. Mitten im Lauf brauchte der PO Codex anderweitig: Spur B ab Commit `34a1be3` an Opus uebergeben; Nachpruefung von Spur A durch einen frischen Opus-Pruefer statt Codex.
3. Reviews:
   - PP11a (Codex): nicht OK, 9 Befunde (4 hoch) -> behoben.
   - PP11a-N (Opus): OK mit Auflagen, 4 mittel + 4 niedrig -> behoben.
   - PP11b (Codex): OK mit Auflagen, 4 Befunde -> behoben; Gesamtlauf `betrieb/abnahme/abnahme.ps1` Exit 0 in 417.6 s.
4. PO-Entscheide als E39 in `docs/architektur/00-kontext.md` festgehalten (Hosting durch Planora, Retention, Alarmempfaenger, Lizenzmodell).
5. Beide Spuren lokal auf `main` gemergt (`dac37b4`, `8b2972a`), Teststand in `docs/superpowers/plans/2026-11-11-fortsetzung.md` (`b13bbba`), auf `origin/main` gepusht.
6. Tests auf main: `npm test` 314 ok / 37 skip, Typpruefung ok, `test:docker` 32 ok in 440 s, `test:docker:b` 9/9.
7. `CLAUDE.md` und dieses Journal neu angelegt.

Berichte: `docs/superpowers/plans/2026-11-11-m1-abnahme-spur-a.md`, `...-spur-b.md`, `2026-11-11-m1-lizenznachtrag-spur-b.md`.

### 2. Was inhaltlich gelernt wurde

- [F] Kunde hat keine eigene IT: Planora hostet Server und Domain. Damit wird Kunden-CA eher der Ausnahmefall; bei Eigenhosting meist eigene Domain mit oeffentlichem Zertifikat [A].
- [A] Kosten Hosting (Anbieterseite, Stand 11.11.2026, vor Bestellung bestaetigen): Infomaniak VPS Lite 4 vCPU / 8 GB / 160 GB CHF 18/Monat bei Jahresvertrag; Mail CHF 2.29/Adresse/Monat.
- [A] Preise Exoscale, Domain und Swiss Backup nur aus Drittquellen, nicht verifiziert.
- [A] Standard-Alarmempfaenger = Admin-Konten des Kunden; vom PO als umschaltbar beschlossen, Standard selbst nicht ausdruecklich bestaetigt.
- [F] Die WSL-Gesamtabnahme deckt nur den Spur-B-Stand; nach Merge von Spur A nicht wiederholt.

### 3. Was ueber die Zusammenarbeit gelernt wurde

- Der PO verteilt Agenten kurzfristig um (Codex abgezogen). Spuren deshalb so schneiden, dass eine Uebergabe an einen anderen Agenten ab einem klaren Commit moeglich ist – hat hier funktioniert.
- Kreuzpruefung durch ein anderes Modell bzw. einen frischen Pruefer findet echte Befunde (PP11a: 4 hohe). Lohnt sich vor jedem Merge.
- Rechtliche Freigaben (Lizenz, Rechtekette) entscheidet der PO bewusst nicht durch Agenten – offen lassen statt vorwegnehmen.

### 4. Technisches, das beim naechsten Mal Zeit spart

- Auf Windows `npm.cmd` statt `npm` aufrufen (PowerShell-ExecutionPolicy blockiert `npm.ps1`).
- Sackgasse: `test:docker:b` brach zuerst ab, weil alte Testvolumes `planora-b_*` vom 10.11. das Compose-Projekt belegten. Der Testdocker-Guard hat korrekt abgebrochen (kein Fehler im Code). Loesung: eigenen Projektnamen setzen, `PLANORA_TEST_PROJEKT=pr-backup`. Alte Volumes noch nicht geloescht.
- Docker-Laeufe dauern: `test:docker` rund 7.5 min, `abnahme.ps1` rund 7 min – im Hintergrund starten.

### 5. Wo es weitergeht

1. Aufraeumen: Worktrees `m1-abnahme-a`/`-b` (via Orca) und Volumes `planora-b_*` entfernen, nach Pruefung auf saubere Staende.
2. M2/M6 erster 3D-Schnitt nach E38/ADR 0032 spezifizieren und bauen (Fortsetzungsplan, "Naechste Coding-Aufgaben").
3. Echte CH-VM bestellen (Preis bestaetigen) und Abnahme darauf ausfuehren.
4. SMTP-Zugang beschaffen, echten Versandtest machen.
5. [?] Klaeren: Rechtekette Entwickler -> Firma, Vertrag/AVV mit Siemens, Lieferantenpruefung, menschliche Lizenzfreigabe.
6. [?] Pruefen, ob das anonyme `VOLUME /var/lib/postgresql` im Backup-Image noetig ist.
7. Hinweis: Fortsetzungsplan sagt bei "M1-Abnahme" noch "lokal, nicht gepusht" – inzwischen gepusht (`b13bbba`), beim naechsten Nachfuehren korrigieren.
