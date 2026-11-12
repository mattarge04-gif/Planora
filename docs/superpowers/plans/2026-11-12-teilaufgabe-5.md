# Teilaufgabe 5 – Dashboard-Rahmen (mit Datenschicht für 6)

12.11.2026 · Einstufung **mittel** (neue Ansicht im freigegebenen Stil A). PO: «kannst gerne weiter».

Grundlagen: Spec `docs/superpowers/specs/2026-11-12-redesign-digital-twin-design.md` Abschnitt 3 (Dashboard), Entscheid `docs/design/entscheide/2026-11-12-redesign-digital-twin.md` (Layout-Skizze A), `docs/design/prinzipien.md`, `designsystem.md`, `fehler.md`, Tokens `app/web/src/design/tokens.ts`, Hauptreferenz `docs/design/referenzen/01-dashboard.png` (Qualitätsrichtung, keine Kopie), Richtungsbild `docs/design/entscheide/2026-11-12-redesign/ansatz-a.png`.

## Arbeitsteilung

| Wer | Schreibt nur |
|---|---|
| **ui-ux-designer** (Claude) – Rahmen | `app/web/src/seiten/Twin.tsx`, `Twin.css`, `app/web/src/ui/**` (neu), `app/web/src/karten/**` nur neue Dateien, `App.tsx` falls für Navigation nötig, Szenario `werkzeug/design/szenarien/twin-dashboard.json` |
| **Codex** – Datenschicht | `app/web/src/dashboard/**` (neu, reine Funktionen + Tests, kein React, keine Three-Abhängigkeit) |
| Hauptagent | Brief, GPU-Prüfung, Kritik, Commit |

Nicht ändern: `szene3/**` (ausser der Rahmen braucht eine neue Prop für Freiraum/Modus – dann Meldung an Hauptagent), `szene2/**`, `tokens.ts` (Wünsche melden), Backend/API/Daten.

## Rahmen (ui-ux-designer)

- 3D-Szene vollflächig; Karten schweben darüber (Panels Weiss 85 %, Weichzeichner, 1 px heller Rahmen, Radius 12, Schatten nach Tokens).
- **Kopfzeile** transparent: links Logo-Marke + Wortmarke «Planora»; Mitte Pill-Navigation «Übersicht» / «Technik» (aktiv dunkelgrau gefüllt); rechts Gebäudewahl (Dropdown aus bestehender Gebäudeliste/API), Glocke mit Anzahl echter Hinweise, Profil-Kreis mit Menü «Abmelden» (bestehende Logout-Funktion).
- [A] «Übersicht» = geschlossenes Gebäude (kein Fokus); «Technik» = Geschossschnitt am Geschoss der Zentrale (Erzeuger), sonst unterstes Geschoss.
- **Kartenplätze:** links Spalte 320–340 px (Gebäude, Hinweise), rechts 280–300 px (Geschosse), unten Anlagen-Tabelle, Legende unten rechts. In Teilaufgabe 5 Karten als gestaltete Hüllen mit bereits vorhandenen echten Werten, wo einfach (Gebäudename, Geschossliste ersetzt die bisherige Geschossleiste); Inhalte vervollständigt Teilaufgabe 6 mit der Datenschicht von Codex.
- **Kamera-Freiraum:** Szene3 bekommt den freien Bereich zwischen den Karten (`freiraum`-Prop existiert), damit das Gebäude 65–75 % der freien Fläche füllt.
- Inter 12/13/15/22, tabellarische Ziffern, lucide-react 1.75, echte Umlaute, keine Versal-Eyebrows, keine erfundenen Zahlen/Diagramme.
- Responsiv für 1280 × 720 bis 1920 × 1080; bei 1280 × 720 dürfen Karten kompakter werden, aber nichts abgeschnitten.
- «Reduzierte Darstellung» bleibt erreichbar (z. B. im Profil-/Einstellungsmenü oder als dezenter Schalter).
- Alte Seiten «Ansicht»/«Entwurf» bleiben erreichbar.

## Datenschicht (Codex) – `app/web/src/dashboard/`

Reine Funktionen aus `Welt`, `Beschreibung`, `KatalogEintrag[]` (Typen in `app/web/src/typen.ts`, vorhandene Helfer `app/web/src/panel/daten.ts` wiederverwenden):

- `kennzahlen`: Anzahl Geschosse, Einheiten, Anlagen (Symbole und Bauteile getrennt benennen), Anteil bestätigter Anlagen in % (Definition dokumentieren).
- `hinweisListe`: echte Hinweise mit Text, Status offen/erledigt falls vorhanden, Zielort (Geschoss-ID, Position) für «Klick fährt zum Ort».
- `geschossListe`: Code, Anzahl Einheiten, sortiert von oben nach unten.
- `anlagenZeilen`: Typ (Anzeigename mit echten Umlauten aus Katalog-ID, z. B. «Wärmepumpe»), Hersteller/Typ, Standort (Geschoss · Einheit), Menge (`mengeText`), Status, `schluessel` für Tabellenweg.
- `objektKarte`: Daten für die Anlagenkarte (Icon-Schlüssel, Name, Hersteller/Typ, ID, Status, Menge, Standort, versorgte Einheiten, Dokumente leer).
- `zentraleGeschoss`: Geschoss-ID für den Modus «Technik» (Regel oben).
- `anzeigeName(katalogId)` mit Umlauten; unbekannt → Katalogname.
- Tests mit `app/src/welt/beispiel.ts`-gleichen Daten (bzw. vorhandenen Test-Fixtures im Web).
