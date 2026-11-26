# Fixwelle Anlagenakte (Gebäudeliste, D1–D8) – Kritik Runde 1

- Datum 26.11.2026, Branch `m2c-interview`, HEAD `0faa226` (enthält `7dcec01`, `80dfd39`).
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)` – echte GPU, Chromium headless mit `--use-angle=d3d11 --ignore-gpu-blocklist` (gleicher Start wie `werkzeug/design/screenshot.mjs`; eigener Ablauf nötig, weil das Szenario-Werkzeug weder Neu laden noch Zurück noch direkte Adressen kennt).
- Instanz: Port 3100 war bei Fortsetzung beendet; neu gestartet mit `instanz.sh start --muster`, `lebensdauer-daten.mjs`, `anlagenakte-daten.mjs`, danach für die Unterlagen-Ansichten `app/web/werkzeug/akte-testdaten.mjs` (7 Dateien inkl. abgelehnter PDF). Bilder `00–11` ohne, `20–26` mit Dokumenten.
- Fenster 1440x900, 1280x720, 1920x1080 (Karte/Dokumente 1440 und 1280). Protokolle `bericht-1440.json`, `bericht-1280.json`, `bericht-1920.json`, `bericht-dok-1440.json`, `bericht-dok-1280.json`.

## Gesamturteil: **verbessern**

Die Fixwelle hat die meisten Demo-Befunde sauber erledigt (Adressen, Neu laden, Umlaute, kB, ein Symbol für «abgelehnt», «Lebensdauer bearbeiten», Nr. in der Twin-Tabelle, Quelle der Lebensdauer). Die neue Gebäudeliste ist ordentlich und gehört sichtbar zur Twin-Familie, wirkt aber als **erster Bildschirm nach dem Login für eine Siemens-Demo zu leer und zu generisch**. Dazu kommen ein Rest von D4, D5 nur halb umgesetzt und die 1280-Tabelle.

## Befunde (wirksamste zuerst)

| # | Stufe | Befund | Beleg | Vorschlag (Zuständigkeit) |
|---|---|---|---|---|
| 1 | **P1** | **Gebäudeliste und Login als Demo-Einstieg zu dünn.** Liste ist eine schmale Karte (712 px) oben in der Mitte, darunter nichts; belegt bei 1920x1080 rund 21 %, bei 1440x900 rund 35 % der Fläche. Je Zeile nur Name + Geschosszahl, graues Standardsymbol, Stift. Keine Information, warum man dieses Gebäude öffnet (Zustand, fällige Erneuerungen, Unterlagen). Login davor: unformatierte Karte ohne Marke, Knopf im Browser-Standardstil – das ist das allererste Bild der Demo. | `01-liste-1920x1080.png` (ganze untere Hälfte leer), `01-liste-1440x900.png`, `00-login-1440x900.png` (Knopf «Anmelden», kein Logo) | ui-ux-designer: (a) Zeile um echte Kennzahlen erweitern, die es schon gibt: Anlagen, bestätigt x/y, Ampel-Mini-Pegel (Ersetzen/Bald ersetzen), Kosten 5 J., Anzahl Unterlagen – nur echte Daten (Regel 17). (b) Bei wenigen Gebäuden Kacheln mit kleiner Isometrie-Vorschau/Silhouette statt Listenzeile prüfen (eigenständig, kein Dashboard-Kitsch). (c) Login im selben Kopf-/Markenstil wie Liste (Marke, Inter, `ep-knopf-haupt`). |
| 2 | **P1** | **D4 nicht vollständig behoben:** Nach Sprung «Unterlagen» bleibt bei 1440 oben ein halb abgeschnittener Knopf «Lebensdauer bearbeiten» unter der Ausblendung stehen. Tritt auf, wenn der Unterlagen-Abschnitt kurz ist (keine Unterlagen) und die Karte nicht weit genug scrollen kann; mit 2 Unterlagen sauber. | `10-karte-sprung-1440x900.png` (rechts oben, y ≈ 245), Vergrösserung `ausschnitt-10-karte-sprung-1440x900.png`; Gegenprobe `25-karte-sprung-mit-unterlagen-1440x900.png` | ui-ux-designer: Sprung nicht per Scroll auf Anschlag, sondern Unterlagen-Abschnitt an den Kartenanfang ausrichten mit unterem Polster (`scroll-padding`/Leerraum am Kartenende), oder Ausblendung nur zeigen, wenn darüber ganze Blöcke liegen. |
| 3 | **P2** | **D5 nur im Twin umgesetzt:** Erneuerungsplan zeigt 4 identische Zeilen «Umwälzpumpe · UG1 · Technikzentrale», je 2 identische «Durchgangsventil» und «3-Weg-Ventil»; keine Nr., kein Hersteller/Typ. Ein FM fragt sofort «welche?». | `23-erneuerung-tabelle-1440x900.png` (Zeilen 1–4, 8–11), `04-erneuerung-1440x900.png` | ui-ux-designer: gleiche Nummerierung wie `dashboard/daten.ts` («…, Nr. 1») auch im Erneuerungsplan und in der CSV. |
| 4 | **P2** | **1280x720: Anlagentabelle zeigt 2½ Zeilen** (dritte ausgeblendet), Spalte Hersteller/Typ fehlt; Karte schneidet Unterlagen unten ab, nach Sprung ist nur die Überschrift «Unterlagen» und eine halbe Zeile sichtbar. | `08-tabelle-1280x720.png`, `25-karte-sprung-mit-unterlagen-1280x720.png` (unten rechts) | ui-ux-designer: bei Kartenauswahl Tabelle auf Kopfzeile + 1 Zeile einklappen oder Karte über die Tabelle verlängern; Sprungziel mit mind. 2 Unterlagenzeilen sichtbar machen. |
| 5 | **P2** | **Demo-Daten verraten Testcharakter:** Datenblatt «Umwälzpumpe 25-60» an Pumpen «Magna3 32-80»; Wärmepumpe/Speicher/Verteiler ohne Hersteller («–»); Liegenschaft «Muster Stufe 1», Gebäude «Muster 6 L-Form viele Gruppen», Gruppen/Räume «Buero A/B» ohne Umlaut; Bauteil heisst «Sonstiges»; Karte zeigt «Bauteil-ID 1df85537». | `25-karte-sprung-mit-unterlagen-1440x900.png`, `09-karte-1440x900.png` (Bauteil-ID), `03-twin-nach-reload-1440x900.png`, `23-erneuerung-tabelle-1440x900.png` | Hauptagent: eigenes Demo-Gebäude mit realistischem Namen/Adresse, Herstellern an allen Zentralgeräten, passendem Datenblatt; Bauteil-ID nur für Admin/Support oder weglassen. |
| 6 | P3 | Unbekannte Gebäude-ID: `/gebaeude/0000…` zeigt stillschweigend die Liste, Adresse bleibt falsch stehen. | `07-unbekannte-id-1440x900.png`, `bericht-1440.json` (`unbekannt`) | Adresse auf `/` ersetzen und kurze Meldung «Gebäude nicht gefunden». |
| 7 | P3 | «Rechnung Service unbekannt.pdf» erhält Startkategorie «Offerte» (Heuristik D8 zu breit). | `21-detail-abgelehnt-1440x900.png` | «Rechnung» nicht als Offerte deuten oder «Sonstiges». |
| 8 | P3 | Kürzung «Datenblatt Umwälzpumpe 25-60....» (Auslassung direkt vor «.pdf» ergibt vier Punkte); in «Preise prüfen» Namen bei 1440 auf ~20 Zeichen gekürzt (bekannt aus r2 Preis-Dokument). | `21-detail-abgelehnt-1440x900.png` (letzte Zeile), `22-preise-pruefen-1440x900.png` | Mittelkürzung mit erhaltener Endung (`Datenblatt Umwälz…25-60.pdf`), Titel-Tooltip. |
| 9 | P3 | Der durchscheinende Szeneninhalt hinter der Karte «Gebäude» in der Technik-Ansicht (Speicherumriss neben dem Symbol) wirkt bei 1440 leicht unruhig. | `09-karte-1440x900.png` (links oben, x ≈ 300, y ≈ 100–150) | Geschmack; Deckkraft der Linken Karte in Technik leicht erhöhen. |

## D1–D8 im Einzelnen (eigene Prüfung)

| D | Stand | Beleg |
|---|---|---|
| D1 Liste roh / Umlaute / Ort in URL | Umlaute ok («Beispielgebäude», «Zubehör», «über»). Adressen ok: `/gebaeude/<id>`, `/erneuerung`, `/dokumente`; Neu laden bleibt auf der Seite (Twin und Dokumente); Zurück läuft Dokumente → Erneuerung → Twin → Liste, in allen drei Fenstern gleich. Gestaltung: siehe P1 #1. | `03-twin-nach-reload-*`, `05b-dokumente-reload-*`, `06-zurueck1/2/3-*`, `bericht-*.json` |
| D2 Text ohne Schlüssel | ok: «Automatisches Auslesen ist nicht eingerichtet …», kein irreführender Admin-Hinweis. Im Erneuerungsplan bleibt der Link «Preise aus Dokumenten lesen» sichtbar (führt zu Dokumenten) – vertretbar. | `22-preise-pruefen-1440x900.png`, `04-erneuerung-1440x900.png` |
| D3 Grössen und Symbol | ok: überall kB, abgelehnt überall Schild-Symbol, abgelehnte PDF ohne Seitenzahl. | `21-detail-abgelehnt-*`, `22-preise-pruefen-1440x900.png` |
| D4 Karte | «Lebensdauer bearbeiten» und «Bearbeiten» (Datenblatt) jetzt unterscheidbar; Rest-Durchscheinen siehe P1 #2. | `09-karte-1440x900.png`, `10-karte-sprung-1440x900.png` |
| D5 Nr. | Twin-Tabelle ok («UG1 · Technikzentrale, Nr. 1/2»); Erneuerungsplan nicht, siehe P2 #3. | `09-karte-1440x900.png`, `23-erneuerung-tabelle-1440x900.png` |
| D6 Quelle | ok: «Lebensdauer-Richtwert in Anlehnung an VDI 2067 Blatt 1 (2012)», im Lebensdauerblock «Planora-Richtwert». | `25-karte-sprung-mit-unterlagen-1440x900.png` |
| D7 1280 | Platzhalter nicht erneut geprüft; Tabelle 2½ Zeilen bleibt, siehe P2 #4. | `08-tabelle-1280x720.png` |
| D8 Kategorie / EICAR | o1 jetzt «Offerte»; abgelehnte PDF ohne Seitenzahl; Heuristik zu breit, siehe P3 #7. | `21-detail-abgelehnt-1440x900.png` |

## Noten

| Kriterium | Note | Beleg |
|---|---|---|
| Gestaltungsqualität | 3 | Liste sauber, aber ohne Haltung (`01-liste-1920x1080.png`); Twin/Dokumente auf gutem Niveau (`21-detail-abgelehnt-1440x900.png`) |
| Originalität | 2 | Liste = generisches Listenmuster (Symbol, Name, Untertitel, Chevron, Stift) |
| Räumliche Wirkung | 4 | Twin unverändert gut (`26-nach-esc-1440x900.png`); Liste ohne Bezug zur 3D-Welt |
| Komposition | 2 | Liste 21 % Flächennutzung bei 1920 (Messung unten) |
| Geometrie / Licht / Material | 4 | unverändert, nicht Gegenstand der Fixwelle |
| Typografie | 4 | Inter, klare Hierarchie, Umlaute korrekt; Login mit Browser-Knopfschrift (`00-login-1440x900.png`) |
| Abstände | 4 | 4-px-Raster eingehalten, Zeilen 59 px gleichmässig |
| Referenz-Qualitätsrichtung | 3 | Einstieg erreicht das Niveau von `01-dashboard.png` nicht |
| Bedienbarkeit | 4 | Fokusring sichtbar (`01c-liste-fokus-1440x900.png`), Hover mit Chevron, Esc zweistufig zurück zur Übersicht |
| Funktion | 4 | Adressen, Neu laden, Zurück korrekt; Rest D4/D5 |
| Leistung | 5 | 60 fps in allen drei Fenstern |

## Messungen (objektiv)

- fps bei Kameradrehung (3 s): 1440x900 **60**, 1280x720 **60**, 1920x1080 **60**.
- Zeit Klick in Liste → Twin-Bild: 7.1 s inkl. fester Wartezeit 7 s, d. h. Szene innerhalb des Wartefensters ruhig (grob, nicht feiner gemessen).
- Flächennutzung Gebäudeliste (Inhaltskarten / Fläche unter Kopfzeile): 1920x1080 ≈ 21 %, 1440x900 ≈ 35 %.
- Konsole: keine CSP-Verletzung, keine pageerror. Ein `401 (Unauthorized)` beim ersten Aufruf vor dem Login (Sitzungsabfrage, erwartet); sonst nur bekannte three.js-Warnungen (X4000/X3595 Shader, `THREE.Clock` veraltet).
- Adressfolge (alle Fenster gleich): `/` → `/gebaeude/<id>` → Neu laden bleibt → `/erneuerung` → `/dokumente` → Neu laden bleibt → Zurück `/erneuerung` → `/gebaeude/<id>` → `/`.

## Geschmacksurteile (subjektiv, keine Regel)

- Die Liste ist korrekt, aber «Software-Verwaltung», nicht «Digital-Twin-Plattform». Für eine Demo, die mit diesem Bildschirm beginnt, wäre eine kleine Gebäude-Silhouette oder ein Mini-Zustandspegel je Gebäude der stärkste Hebel.
- Graues Standard-Gebäudesymbol in jeder Zeile wiederholt sich ohne Informationswert.

## Kandidaten für Lessons Learned

- Demo-Fixes einer Liste/Bezeichnung (hier Nr. bei gleichen Anlagen) an allen Orten nachziehen, an denen dieselben Daten erscheinen (Twin-Tabelle, Erneuerungsplan, CSV) – einmaliger Befund, noch nicht bestätigt.
- Sprungziele in scrollenden Karten mit kurzem und langem Inhalt prüfen (Anschlag-Fall) – einmaliger Befund.
