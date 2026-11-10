# Planora – gemeinsamer Fortsetzungsstand, 2026-11-11

Einstieg fuer die naechste Sitzung. Historische Worker-Notizen und alte Stoppmeldungen ersetzen diesen Stand nicht. Nach Konsolidierung ist der einzige Arbeitsbereich `C:/web agency/planora/Planora` auf `main`.

## Gesicherter Fortschritt

| Bereich | Ergebnis | Commits/Nachweis |
|---|---|---|
| M1a App-Kern | Login, Sitzungen, Rollen/Scope, Modulschalter, Audit, Dateiablage | bereits vorher main `4af0a27` |
| M1b A (Fable, spaeter Codex) | Compose/Caddy, Startprozesse, Wartung, Installation, signierte Releases, Update mit Wiederaufnahme | Original `382dbda`, Merge `9171869` |
| M1b B (Codex) | Snapshot-Backup, restic/age, Inventar, Journal, Restore und Host-Freigabe | Original `c2dfb29`, Merge `746fe96` |
| Integration (Codex mit Ponytail) | externe Konfiguration/Secrets, echtes Backup vor Update, Journal, Reconcile/Timer, Worker-Sperre, Restore in frische DB | `c226252` |
| Admin und Dossier | geschuetzte minimale Admin-API und Lizenz-Dossier-Geruest | `e47eefe` |
| Gemeinsame Pruefung | Installation, Backup, Abbruch, Update/Resume, Restore, Host-Freigabe | `ffb4615`, `betrieb/README.md` |
| Sicherheitsnachpruefung | Token-Widerruf, Restore-TLS, Pflichtimages/Compose-Bindung, Backup-Zielalias-Erkennung | `11d3b90` |
| Produktentscheidung E38 | vorbereitete Huelle, Kunde erfasst Einheiten/Technik | [ADR 0032](../../architektur/adr/0032-gebaeude-vorbereiten-kunde-erfasst-technik.md), noch nicht implementiert |

Alle sechs zusaetzlichen lokalen Planora-Worktrees vor Bereinigung geprueft: keine getrackten/ungetrackten Aenderungen, jeder HEAD im Integrationsstand enthalten. Historie bleibt im gemeinsamen Git-Verlauf. Andere Projekte sind nicht betroffen. Nur bereits zusammengefuehrte lokale Arbeitszweige entfernen, keine Remote-Branches loeschen.

## Tatsaechlicher Teststand

- Integration `ffb4615`: 234 normale Tests bestanden, 23 Docker-Tests im normalen Lauf uebersprungen; TypeScript inklusive Docker-Testdateien bestanden.
- Getrennte Docker-Laeufe: Paket 13/13, Backup/Restore 5/5, Kombination 5/5, gezielter Restore 1/1. Linux-Container auf Docker Desktop/Windows.
- Sicherheitsnachpruefung `11d3b90`: 77/77 gezielte Tests in acht Dateien; zusaetzliche TLS-Datei 6/6 (teilweise ueberlappend); TypeScript/POSIX-Syntax bestanden; kombinierter Docker-Lauf 6/6 in rund 200 Sekunden.
- Keine Addition ueberlappender Laeufe; kein erneuter Volltest nach jeder einzelnen Korrektur behauptet.
- [Integrationsbericht](2026-11-10-m1b-integrationsbericht.md), [Sicherheitsnachpruefung](2026-11-10-m1b-pp-nachpruefung.md).

## M1-Abnahme weiterhin offen

1. Frische Linux-VM: Offline-Installation, echte Host-Bind-Mounts/UID-Rechte, systemd/Timer, zweite isolierte Instanz, Backup und Restore.
2. Kunden-CA neben `tls internal` nachweisen. TLS-Herabstufung negativ getestet, positiver externer TLS-Endpunkt noch nicht.
3. Retention-Politik freigeben und pruefen (Vorschlag 14 taeglich/8 woechentlich/12 monatlich); Inventar/Journal bis dahin konservativ behalten.
4. Produktiven externen Alarmkanal anbinden und pruefen.
5. Vollstaendige Image-SBOMs, Lizenztexte und menschliche Lizenz-/Lieferfreigabe. Vorhandenes Dossier ist ein Geruest.
6. Echter CH-S3-Test nur dann benoetigter Liefernachweis, wenn dieses Ziel vereinbart wird. Der M1b-Plan fuehrt ihn ausdruecklich ausserhalb des Umfangs; aktuelle Host-Installation nutzt lokales Dateisystemziel. S3-Produktivreife nicht behaupten.
7. VM-Totalverlust: Ersatzcluster separat gemaess Restore-Vertrag provisionieren; automatischer Update-Rueckweg erstellt eine frische DB im bestehenden Cluster, keine Ersatz-VM.

Restarbeit grob 2–4 PT [A] bei verfuegbarer Umgebung/Zugaengen/Entscheiden, externe Wartezeit kommt dazu. Merge/Push sichert Entwicklung und ist keine Produktivfreigabe.

## Naechste Coding-Aufgaben

Keine weiteren Worker automatisch starten. M1-Abnahme planen; danach M2/M6 fuer einen durchgehenden Schnitt spezifizieren und implementieren:

1. Gemeinsames Beschreibungsschema, Katalog-IDs, Welt-Regelwerk v1 und Versions-/ID-Verhalten.
2. Datenmodell Liegenschaft/Gebaeude/Geschoss/Einheit/Element, Rechte, getrennte Standort-/Versorgungsbeziehungen.
3. Deterministischer Generator fuer Huelle, Geschosse, Einheiten-Rechtecke und Bauteilpositionen.
4. React/Three.js/R3F: Uebersicht, Geschossauswahl, Explosionsansicht, Einheiten und Seitenpanel; reduzierte Darstellung und funktionaler 2D-/Tabellenweg.
5. Planora bereitet Huelle vor; Kunde erfasst/kopiert/korrigiert Einheiten. Heizungsfragen HK/FBH/TABS, Verteiler/Kreise/Mengen, Unbekannt und Vorschlagsbestaetigung.
6. Schnitt mit zwei Geschossen und gemeinsamem Verteiler; PO-Rueckmeldung vor Katalogausbau. M3-Bibliothek schrittweise ergaenzen.
7. M4 Viewer, M5 sicherer Upload, M6 Excel vervollstaendigen; M7 Lebensdauer/Ampel. Suche und KI erst spaeter.

## Aufwand und Termine: Szenarien, keine Zusagen

- Bisherige M2/M3/M4/M5/M6/I1/M7-Schaetzungen: 16+3+6+5+4+3+8 = 45 PT, ohne M1-Restabnahme.
- E38: Heizung +3–5 PT, mehrere Gewerke insgesamt +6–10 PT; bereits geplante 3D/Erfassung nicht doppelt zaehlen.
- M1 wurde von 7 auf ca. 15 PT revidiert. Wochenraster der HTML-Roadmap ist historischer Referenzplan, kein aktueller Kalendertermin.
- Gespraechsschaetzung 10.11.: ca. 6–7 PT Implementierungsumfang, keine gemessene menschliche Arbeit oder dauerhaft bestaetigte Agentengeschwindigkeit.
- Ende November war ein ehrgeiziges Ziel fuer eine Stufe-2-Abnahmeinstanz, keine feste Uebergabezusage. Anfang bis Mitte Dezember war eine Szenarioschaetzung. Nach M1-Abnahme und erstem 3D-Schnitt mit E38-Aufwand neu planen.
- Produktive Siemens-Uebergabe benoetigt IT-Freigabe, echte Unterlagen und Abnahme. Ein groesseres Agenten-Abo erhoeht Kapazitaet, ersetzt diese Voraussetzungen nicht.
