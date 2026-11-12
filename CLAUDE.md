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

**Gestaltung [F]:** Jede visuelle Arbeit (3D-Szene, Dashboard, Farben, Typografie, Bewegung, Anlagenmodelle) laeuft ueber den Skill `planora-design` (`.claude/skills/planora-design/SKILL.md`) mit den Agenten `art-director`, `3d-designer`, `ui-ux-designer`, `visual-critic` (`.claude/agents/`). Designbibliothek und verbindliche Geschmacksregeln: `docs/design/README.md`, `docs/design/prinzipien.md` (nur mit PO-Bestaetigung aendern). GPU-Screenshots: `werkzeug/design/`. UI-Texte mit echten Umlauten.

## 0b. Stand – zuletzt aktualisiert 13.11.2026

### Stufe 1 integriert [F]

- Tracks A (Generator v2/Raumkomposition), C (Gruppenleitungen) und B (Web-Assistent) auf `m2c-interview` gemergt, plus I1 (Twin-Menue "Gebäude bearbeiten"). Backend 565/565, Web 251/251, Typpruefungen und Build gruen.
- Einstieg und offene Punkte: `docs/superpowers/plans/2026-11-13-stufe1-integration.md`. Naechster Schritt: Vorschau-Zoom im Assistenten beheben, dann I2 (GPU-Bilder aller Muster, visual-critic, PO-Sichtung). Kein Push/Merge nach `main` ohne PO-Auftrag.

### Aktueller Abschluss Stufe 1 nach Claude-Stopp [F]

- Aktueller Checkout `m2c-interview`, letzter Implementierungscommit `c5a335e`. M2b ist bereits mit `ba3f339` nach `main` integriert; ältere Branch-/Fortsetzungsangaben darunter sind historisch.
- Phase V (V1–V5) umgesetzt: Typen/Schema, Migration 014, Katalog/Regelwerk v2, Gruppen/Ort speichern und prüfen, Entwurf-CRUD, schreibfreie Vorschau, Generator-v2-Stub, sechs Muster plus U-Variante und sieben Welt-Fixtures.
- Codex-Abschluss: 477 Backendtests und 174 Webtests bestanden, beide Typprüfungen und Webbuild grün. Demostart per HTTP mit Login und allen acht Gebäude-Welten geprüft; eigene temporäre Instanz auf freien Ports. Bestehende Dienste nicht verändert.
- Einstieg: `docs/superpowers/plans/2026-11-12-stufe1-abschluss.md`. Nächste Implementierung: Tracks A (Raumkomposition), B (Web-Assistent), C (Gruppenleitungen), danach Integration und GPU-/PO-Abnahme. Der v2-Generator verwendet noch ein Übergangslayout; keine fertige Assistentenoberfläche behaupten.
- Keine neue GPU-, Docker- oder Lieferabnahme. Kein Push/Merge/Deployment in diesem Abschluss.

### Fortsetzung nach erneutem Claude-Nutzungslimit [F]

- Aktueller Checkout weiter `m2b2-redesign`, Teilaufgaben 4–7 inzwischen abgeschlossen; Abnahmen 1 und 2 freigegeben. Die älteren Rückgabeangaben unten sind historisch.
- Teilaufgabe 8 durch Codex fortgesetzt: übernommene Zoom-/Beschnitt-/Nahkulissen-Korrekturen und Lazy-Loading, Tabellenfokus als ein Tab-Stopp sowie T-Rückmeldung integriert.
- Vom PO im letzten Claude-Verlauf freigegebener Abbau umgesetzt: `Ansicht`, `Entwurf`, alte Szene und ausschliesslich alte Karten entfernt. Gebäude öffnen direkt im Digital Twin. `szene2/huelle.ts`, `szene2/leitungen.ts` und `panel/daten.ts` samt Tests bleiben gemeinsame Grundlagen.
- Lizenztexte von 66 Produktionspaketen unter `app/web/public/lizenzen.txt`; fünf Pakete liefern keinen eigenen Text im installierten Paket. Vollständige Image-SBOM und menschliche Lieferfreigabe bleiben offen.
- Aktueller Prüfstand und verbleibende Punkte: `docs/superpowers/plans/2026-11-12-teilaufgabe-8.md`. Kein Merge/Push ohne PO-Auftrag; PO-Server 3000/54500 nicht stoppen oder neu starten.
- Abschlussprüfung: 172 Webtests, Typprüfung und Build grün; 48 echte GPU-Bilder, 60 fps je Fenster/Durchgang, unabhängige Bildkritik bereit für PO-Sichtung. Tabellen-/Tastaturfunktionen zusätzlich im Browser geprüft. Separate Testinstanz 3100/54600 wieder gestoppt.

### Redesign durch Codex – aktueller Stand [F]

**Rueckgabe an Claude (12.11.2026):** `docs/superpowers/plans/2026-11-12-rueckgabe-an-claude.md` zuerst vollstaendig lesen. **PO-Abnahme 1 ist freigegeben** ("passt machen wir in 30 min weiter wegen dem nutzung guthaben"). Nach der gewuenschten Pause naechster Schritt: Teilaufgabe 4, GLB-Anlagen und Leitungen. Codex hat die Arbeit beendet; Claude uebernimmt.

Branch **`m2b2-redesign`**, aktueller Checkout; nicht wechseln oder pushen. Die Uebergabe `docs/superpowers/plans/2026-11-12-uebergabe-codex.md` ersetzt die aelteren M2b-Fortsetzungsangaben unten.

- Teilaufgabe 1 abgeschlossen: PO waehlt **A – Architekturatelier**, mit geschossbezogenem Schnitt (oben alles weg, darunter sichtbar, gewaehlte Ebene oben offen und zwei kameraseitige Fassaden weg). Entscheid: `docs/design/entscheide/2026-11-12-redesign-digital-twin.md`; Regel 7 und Spec nachgefuehrt.
- Teilaufgabe 2 abgeschlossen: gemeinsame `app/web/src/design/tokens.ts`; UI-/3D-Tokens und GPU-Uebersicht unter `docs/abnahme/2026-11-12-redesign-tokens/`.
- Teilaufgabe 3 abgeschlossen, **PO-Abnahme 1 freigegeben**: neue Seite **Digital Twin**, parametrische Huelle/Kulisse, weiches Licht, Geschossschnitt, Kamerasteuerung, reduzierte Darstellung. Bilder: `docs/abnahme/2026-11-12-redesign-szene/README.md`. Unabhaengige Kritik bereit mit P2-Restauflagen (Schattenkoernung, Tonwertunterschied normal/reduziert).
- Web 63/63, Backend 417/417, beide Typpruefungen und Webbuild gruen. GPU RTX 3070 Ti / D3D11, 60 fps bei Drehung in 1440/1920/1280. Keine CSP-Verletzung; bekannte Bibliotheks-/Shaderwarnungen dokumentiert. Docker nicht wiederholt.
- Weiter mit **Teilaufgabe 4 (GLB-Anlagen, Leitungen)** nach der angekuendigten Pause; PO-OK zu Abnahme 1 liegt vor. Dashboard folgt in 5/6, Interaktionen in 7, Feinschliff in 8.
- PO-Server 3000/54500 nicht stoppen/neustarten. Eigene Instanz 3100/54600 nach Pruefung gestoppt. Stash unveraendert als Material erhalten.

### Visueller Zielentwurf E40 [F]

Prototyp auf `m2b1-sichtbarer-schnitt` umgesetzt (`app/web/src/szene2`, `karten`, `seiten/Entwurf.tsx`); [Screenshots und offene Punkte](docs/abnahme/2026-11-12-entwurf/README.md). PO-Korrekturrunde offen, keine visuelle Endabnahme vorher. Ansehen: `npm run entwicklung` in `app/`, Gebaeude -> "Entwurf". Masse/Farben [A], nur im Software-Rendering geprueft.

### Fortsetzung nach Claude-Usage-Abbruch [F]

Tagesabschluss: M2b-1 technisch fertig, keine visuelle Endabnahme. PO-Entscheid E40: [plastische Gebaeudeuebersicht, Technikansicht und Informationskarten nach drei Bildreferenzen](docs/design/2026-11-12-visuelle-zielrichtung.md). Der visuelle Zielentwurf ist erledigt (umgesetzt 12.11., siehe Block "Visueller Zielentwurf E40"). Zusatzaufwand [A] +6–10 PT, Planungswert +8 PT. [Screenshots und Pruefstand](docs/abnahme/2026-11-12-m2b1/README.md) sind im Repo gesichert.

Aktueller Branch `m2b1-sichtbarer-schnitt`, Tasks 1–5 bereits committet (HEAD bei Uebernahme `376885d`). Tasks 6–7 durch Codex fortgesetzt: Docker-Frontend, Web-Lockfile im Dossier, lokaler Entwicklungsstart. Siehe aktuellen Eintrag im [Fortsetzungsstand](docs/superpowers/plans/2026-11-11-fortsetzung.md). Der erste sichtbare Schnitt existiert jetzt; aeltere Aussagen unten zu fehlendem Frontend sind damit ueberholt. Weitere M2b-Schritte bleiben offen. Lokale Demo: `npm run entwicklung` in `app/`.

### Entschieden [F]

| Thema | Stand |
|---|---|
| Modell | B2B, eine Instanz pro Kunde, ein Docker-Compose-Paket (E34/E35). Erster Kunde Siemens (E37). |
| Hosting | Planora stellt Server und Domain je Kunde, Kunde ohne eigene IT (E39). |
| Backup-Retention | 14 taeglich / 8 woechentlich / 12 monatlich, PO-freigegeben (E39). |
| Alarm | SMTP an Konto-Adressen des Kunden plus eine Planora-Adresse je Kunde; optional Webhook mit HMAC (E39). Standard-Empfaenger = Admin-Konten, umschaltbar auf alle [A]. |
| Lizenz | Planora proprietaer, Nutzungsrecht je Instanz, kein Quellcode; Fixture @fastify/deepmerge mit MIT- und ISC-Text beilegen (E39). Menschliche Lizenzfreigabe bewusst offen. |
| 3D-Erfassung | Planora bereitet Huelle/Geschosse vor, Kunde erfasst Einheiten und Technik (E38, ADR 0032). Datenkern umgesetzt (M2a), UI fehlt. |
| M2-Zerlegung | M2a Welt-Kern ohne UI (fertig) -> M2b 3D-Ansicht -> M2c Erfassung/Heizungsassistent. Normalisierte Tabellen sind die Wahrheit, die Beschreibung ist Ein-/Ausgabeformat. Stabile IDs per optionaler `id` (ohne id = neu/Kopie, fehlend = loeschen, blockiert bei manueller Position). |
| Heizung/Katalog | Standard am Gebaeude, Ausnahmen je Einheit; ein Symbol je Typgruppe (Katalog-ID+Hersteller+Typ), unabhaengig von der Menge; Zentrale (Waermepumpe, Kessel, Fernwaerme, Speicher, Pumpe) im Katalog; Flaeche je Einheit optional; "bestaetigt" bei unbekannter Menge erlaubt. M2c-Ablauf: Struktur, Zentrale, Standard, Ausnahmen, Verteiler. Demo nur Heizung. |
| M2a-Technik | Routen `/api/struktur/...` und `/api/szene/gebaeude/:id/welt` (jede /api-Route gehoert einem Modul); Katalog/Regelwerk als TS-Module (Docker-Build kopiert nur .ts); `bauteil.gebaeude_id`; neues Recht `huelle.verwalten` (nur Betreiber, ohne Fachdaten); ajv global strikt; Migration `013_gebaeude.sql`. Spec `docs/superpowers/specs/2026-11-11-m2a-welt-kern-design.md`, Plan `docs/superpowers/plans/2026-11-11-m2a-welt-kern.md`. |
| M2a | Abgeschlossen, Merge-Commit `bd5d7a6` (PR #1) auf `main`, gepusht; Branch `m2a-welt-kern` lokal und remote geloescht. |
| M1 | Technisch abgeschlossen und lokal abgenommen (WSL-Ersatz-VM), auf `main` gemergt und auf `origin/main` gepusht (b13bbba). |

### Teststand auf main nach M2a-Merge [F]

- `npm test` 387 ok / 37 Docker uebersprungen; Typpruefung gruen.
- `test:docker` 32 ok in 503 s (nach Korrektur des Update-Tests: leitet letzte Migration ab, Probe `999_updateprobe.sql`). `test:docker:b` zuletzt 9/9 (M1-Stand) mit `PLANORA_TEST_PROJEKT=pr-backup`.
- WSL-Gesamtabnahme `betrieb/abnahme/abnahme.ps1` Exit 0 (417.6 s) nur auf Spur-B-Stand, **seither nicht wiederholt** (weder nach Spur A noch nach M2a).

### Das Kernproblem, richtig gefasst [F]

M1 (Betriebsfundament), M2a (Datenkern) und M2b-1 (erster sichtbarer Schnitt) sind gebaut. Das Frontend unter `app/web/` liefert Login, Gebaeudeliste, 3D-Uebersicht und Seitenpanel. Geschossauswahl existiert als Fokus-Prototyp in der Seite "Entwurf"; Explosion, Tabellenweg und Erfassung fehlen weiterhin.

### Abbruchkriterium [A]

Vorschlag, vom PO nicht bestaetigt: Der erste M2/M6-Schnitt (Datenmodell bis Geschossansicht mit Einheiten) soll innert einer Arbeitswoche lauffaehig auf `main` sein; sonst Umfang des Schnitts mit dem PO verkleinern statt weiterbauen. Stand 11.11.: Datenteil fertig, sichtbarer Teil (M2b) fehlt.

### Weiter offen [?]

- Echte CH-VM bestellen und Abnahme (`abnahme.ps1`-Aequivalent) darauf ausfuehren. Kandidat Infomaniak VPS Lite, Preis vor Bestellung bestaetigen [A].
- SMTP-Zugang beschaffen und echten Versandtest machen.
- Menschliche Lizenzfreigabe (bewusst offen).
- [?] Rechtekette Entwickler -> Firma (juristisch).
- [?] Vertrag/AVV mit Siemens, Lieferantenpruefung.
- [?] Braucht das Backup-Image das anonyme `VOLUME /var/lib/postgresql`?
- Aufraeumen: Orca-Worktrees `m1-abnahme-a`/`-b` und Docker-Volumes `planora-b_*` (vom 10.11.) existieren noch.
- [?] WSL-Gesamtabnahme auf dem gemergten main-Stand wiederholen?
- [A] Regelwerk-v1-Werte (Default-Flaechen, Mengenbereiche, Erlaubt-Matrix) sind Annahme; PO-Freigabe vor M2b.
- [?] Spec M2a Abschnitt 11 "Nachtrag nach Umsetzung": 400-Fehlerformat vor M2b vereinheitlichen, Regelwerk-v2-Guard im Generator, `aendereHuelle` ohne Stand-Pruefung u.a.

### Naechste Coding-Aufgabe

PO-Korrekturrunde am Entwurf ([docs/abnahme/2026-11-12-entwurf/README.md](docs/abnahme/2026-11-12-entwurf/README.md)); danach alte Szene durch szene2 ersetzen und Explosion, Tabellenweg, Leistungsstufen anbinden. Regelwerk-v1 bleibt Annahme bis PO-Rueckmeldung. Einheitliches 400-Format ist in M2b-1 umgesetzt; weitere M2a-Nachtraege bleiben offen.

## Antworten

Rohantworten des PO stehen unveraendert in `docs/architektur/00-kontext.md` (Abschnitte "PO-Antworten", E-Entscheide).
