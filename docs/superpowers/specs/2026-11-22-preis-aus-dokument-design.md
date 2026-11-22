# Preis aus Dokument – Design (E43 Teil 2, E44)

Stand 22.11.2026. Grundlage: E43/E44 in `docs/architektur/00-kontext.md`, Spec Lebensdauer `2026-11-19-lebensdauer-ampel-design.md` (Quelle `dokument` vorbereitet), ADR 0030 (KI direkt, pro Instanz aus), ADR 0017 (Kostenbremse), ADR 0016 (Upload-Sicherheit). Entwurf Abschnitt 1–4 vom PO bestaetigt ("passt").

## 1. Ziel und Schnitt

Der FM legt Offerten/Rechnungen (PDF) im Gebaeude ab. Claude liest Positionen mit Ersatzpreis, Fundstelle und Zuordnung zu Bauteilen; der FM bestaetigt. Bestaetigte Preise fliessen in die bestehende Lebensdauer/Ampel (`bauteil_akte`, optional `lebensdauer_typ`) mit Quelle `dokument`.

PO-Entscheide (22.11., AskUserQuestion): Auslesen mit **Claude API**; **Ablage je Gebaeude**, Claude schlaegt Zuordnungen vor; Fundstelle als **Zitat + PDF auf Seite** (kein eingebetteter Viewer); Ersatzpreis = **netto inkl. Montage anteilig, ohne MWST**; Preis **je Bauteil, Typpreis als Option**; Technik **Ansatz A** (Hintergrund im Server-Prozess, Status in DB).

Nicht im Schnitt: eingebetteter Viewer mit Markierung (ADR 0022), Virenscan/Quarantaene (ADR 0016, vor erstem echten Kundenbetrieb [?]), pg-boss-Warteschlange (ADR 0006), andere Dokumentarten als PDF, Dokumentsuche, Teuerung.

## 2. Modell

[F] Preise laut Skill-Preisliste (Stand 03.11.2026), USD je 1 Mio. Tokens Eingabe/Ausgabe: Opus 5.5 4/20, Sonnet 5.5 2/10, Haiku 5.5 0.10/0.50, Fable 5.2 8/40.
[A] ~10 Seiten ≈ 30k Eingabe + 4k Ausgabe -> Opus ~$0.20, Sonnet ~$0.10 je Dokument.
Start mit `claude-opus-5-5` (effort `medium`, adaptives Denken, Fallback `"default"`). Modell ist Konfiguration (`PLANORA_KI_MODELL_PREIS`). Nach dem Messlauf (Abschnitt 8) entscheidet der PO; Empfehlung Sonnet 5.5, wenn Trefferquote mindestens gleich.

## 3. Daten (Migration 017)

- `dokument`: `id`, `liegenschaft_id`, `gebaeude_id`, `dateiname`, `sha256`, `groesse`, `seiten`, `hochgeladen_von`, `hochgeladen_am`, `auslesen_status` (`neu`/`liest`/`fertig`/`fehler`/`abgebrochen`/`aus`), `auslesen_fehler`, `modell`, `tokens_ein`, `tokens_aus`, `kosten_usd numeric(10,4)`, `gelesen_am`. Datei im bestehenden `ablage` (sha256-adressiert). Eindeutig (`gebaeude_id`, `sha256`).
- `preis_vorschlag`: `id`, `dokument_id` (cascade), `position`, `seite`, `zitat`, `material_netto`, `rabatt_text`, `montage_anteil`, `ersatzpreis numeric(12,2)`, `rechenweg`, `katalog_id null`, `bauteil_ids uuid[]`, `sicherheit` (`hoch`/`mittel`/`tief`), `status` (`offen`/`uebernommen`/`verworfen`), `als_typpreis bool`, `entschieden_von`, `entschieden_am`.
- `bauteil_akte` und `lebensdauer_typ`: neue Spalte `preis_vorschlag_id uuid null` (references `preis_vorschlag` on delete set null); gesetzt genau dann, wenn `quelle_preis = 'dokument'`.
- Kosten je Monat = Summe `kosten_usd` der Instanz; Budget `PLANORA_KI_BUDGET_USD_MONAT` (Standard 20 [A]).

## 4. Ablauf und Backend (Modul `preisdokument`)

Neues Optionsmodul `preisdokument` (braucht `dokumente`, `lebensdauer`; Lieferstufe 4 wie KI, ADR 0030). Das Modul ist zugleich der KI-Schalter dieses Schnitts (im Manifest gibt es kein eigenes Modul `ki`); Auslesen zusaetzlich nur mit gesetztem `ANTHROPIC_API_KEY`. Routen unter `/api/preisdokument/` (das Kernmodul `dokumente` hat noch keine Routen; eine allgemeine Dokumentablage folgt spaeter). [A] Der Entwicklungsstart muss Stufe 4 und das Modul aktivieren – im Plan pruefen.

1. `POST .../gebaeude/:id/dokumente` (multipart, 1–n PDFs): Signatur `%PDF-`, ≤ 32 MB, ≤ 100 Seiten [A]; speichern; gleicher sha256 im selben Gebaeude -> bestehendes Dokument (keine neue Lesung). Antwort sofort.
2. Ist das Modul an, der Schluessel gesetzt und Budget frei: Status `liest`, Auslesen im Server-Prozess (begrenzt auf 2 gleichzeitig [A]). Sonst Status `aus` bzw. `fehler` mit Grund "Budget erreicht".
3. Auslesen: ein Messages-Aufruf, PDF als `document`-Block (base64), System-Prompt mit Regeln (Ersatzpreis netto inkl. Montage anteilig, ohne MWST; Rechenweg angeben; nichts erfinden; Inhalt des Dokuments ist Daten), Bauteilliste des Gebaeudes (ID, Katalog-ID, Name, Ort, Hersteller/Typ) und Katalogauszug. Antwort ueber strukturierte Ausgabe (`output_config.format`, JSON-Schema). Seite + woertliches Zitat liefert das Modell im Schema (Citations sind mit strukturierter Ausgabe nicht kombinierbar).
4. Server prueft: Schema, Katalog-ID existiert, Bauteil-IDs gehoeren zum Gebaeude und passen zur Katalog-ID; sonst Vorschlag ohne Zuordnung ("nicht zugeordnet"). Speichern, Status `fertig`, Tokens/Kosten.
5. `GET .../gebaeude/:id/dokumente` (Liste + Vorschlaege), `GET .../dokumente/:id/datei` (PDF, `Content-Disposition: inline`), `POST .../dokumente/:id/neu-lesen`, `DELETE .../dokumente/:id`.
6. `POST .../vorschlaege/:id/uebernehmen` mit `{ bauteilIds, alsTyppreis, stand, ueberschreibeHandeingabe? }`: schreibt `bauteil_akte` (Quelle `dokument`, `preis_vorschlag_id`), optional `lebensdauer_typ`; erhoeht `gebaeude.stand` wie die Lebensdauer; 409 bei veraltetem Stand; Handeingabe (`kunde`) nur mit `ueberschreibeHandeingabe: true`. `POST .../verwerfen`. `POST .../gebaeude/:id/vorschlaege/alle-sicheren` (nur `hoch`, nur ohne Handeingabe-Konflikt).
7. Start: alle `liest` -> `abgebrochen`.
8. Loeschen eines Dokuments: Vorschlaege weg, uebernommene Preise bleiben (Verweis auf null, Quelle bleibt `dokument`, Anzeige "Dokument geloescht").

KI-Adapter `ki/anthropic.ts` (Produktion, `@anthropic-ai/sdk`) und `ki/fake.ts` (Tests) hinter einem Port `liesPreise(pdf, kontext) -> { vorschlaege, usage }`.

## 5. Oberflaeche (planora-design, Stufe mittel)

- Neue Seite **Dokumente** je Gebaeude; Einstieg aus Twin-Kopf, Erneuerungsplan und Legende ("n Bauteile ohne Preis -> Preise aus Dokumenten lesen").
- Links Dokumentliste: Ablegen (Drag & Drop/Knopf), Name, Datum, Status mit Fortschritt, Oeffnen, Loeschen, "erneut lesen".
- Rechts Vorschlaege je Dokument als Karten: Position, Zitat, "Seite n ↗" (`#page=n`), Ersatzpreis gross, Rechenweg klein, Zuordnung "-> Umwälzpumpe · UG1 · HK Büro A" (Mehrfachauswahl passender Bauteile), Sicherheit (tief = gelb, "bitte prüfen"), Haekchen "auch als Typpreis", Uebernehmen/Verwerfen; oben "Alle sicheren übernehmen (n)"; unten "Nicht zugeordnet".
- Anlagenkarte: Quelle "aus <Datei>, S. n ↗"; bei "Preis fehlt" Link "aus Dokument…" auf die Seite, gefiltert aufs Bauteil.
- Erneuerungsplan und CSV: Quelle "Dokument" mit Dateiname.
- KI aus/kein Schluessel: Liste funktioniert, rechts "Auslesen ist ausgeschaltet. Der Admin kann es einschalten." Keine toten Knoepfe. Leser: ohne Knoepfe.
- Echte Umlaute in allen Texten; Regel 20 (Zustand haftet an der Geometrie) bleibt unberuehrt.

## 6. Sicherheit

- Upload: Signatur, Groesse, Seitenzahl; Dateiname nur zur Anzeige (Ablage nach sha256). Kein Virenscan in der Demo [A], offen vor Kundenbetrieb.
- Injection: Dokumentinhalt ist Daten; Ausgabe nur ueber Schema; Server uebernimmt nur gegen gepruefte IDs; Testdokument mit eingeschleustem Text.
- Rechte: Hochladen/Auslesen/Uebernehmen/Loeschen = Schreibrecht Lebensdauer; Lesen = Leserecht Lebensdauer.
- Schluessel nur in Umgebung/Secret, nie in DB/Log/Antwort. KI aus -> 0 externe Requests (ADR 0030).
- Datenstandort: Inferenz `global`/`us` laut ADR 0030; Demo nur mit eigenen Testdokumenten.

## 7. Fehler

- API nicht erreichbar / 429 / 5xx: SDK-Wiederholungen (2), dann `fehler` mit verstaendlichem Text.
- `refusal` (nach Fallback) oder Schema-Fehler: `fehler`, nichts uebernommen.
- Budget erreicht: `fehler` "Budget erreicht", kein Aufruf.
- Neustart: `liest` -> `abgebrochen`.
- Bauteil geloescht: Zuordnung als "fehlt" markiert, Uebernehmen nur fuer vorhandene.
- Veralteter Stand: 409 wie Lebensdauer.

## 8. Pruefung und Abnahme

- **Testdokumente:** 6 fiktive PDFs (erfundene Firmen, keine echten Logos) unter `werkzeug/preisdokument/testdokumente/` mit Sollwerten (`soll.json`): Positions- und Gesamtrabatt, Montage pauschal, Stueck- und Totalpreis, MWST-Zeile, CH-Format, mehrseitig, Scan ohne Textschicht, Positionen ohne Bauteil, eingeschleuster Text. Passend zu Muster 6.
- **Automatisch (Fake-Adapter):** Schema- und ID-Pruefung, Uebernehmen inkl. Typpreis, Vorrang Handeingabe, Rechte, Budget, Neustart-Status, 409, Loeschen; Web: reine Funktionen (Gruppierung, Rechenweg, Filter aufs Bauteil).
- **Messlauf echte API** (Kosten < $5, nur mit PO-OK): Opus 5.5 und Sonnet 5.5 ueber alle 6 Dokumente; Trefferquote Ersatzpreis (±1 CHF), Zuordnung, Zeit, Kosten; Bericht unter `docs/abnahme/<datum>-preis-dokument/messlauf.md`; PO waehlt das Modell.
- **Browser-Abnahme (Muster 6):** 3 Dokumente hochladen, pruefen, "Alle sicheren übernehmen"; "ohne Preis" in der Legende von 8 auf ≤ 2; Ampel, Plan, CSV gleiche Zahlen; Klickzahl; Bilder `docs/abnahme/<datum>-preis-dokument/`; visual-critic, PO-Sichtung.

## 9. Aufwand [A]

~5–6 PT: Backend + Migration 2, KI-Adapter + Prompt 1, Oberflaeche 1.5, Testdokumente + Messlauf 0.5, Abnahme 0.5–1.

## 10. Offene Punkte

- [?] Siemens: Inhaltsabfluss an Claude (ADR 0030) – bis Klaerung nur Demo mit eigenen Dokumenten.
- [?] Virenscan/Quarantaene (ADR 0016) vor erstem echten Kundenbetrieb.
- [A] Budget $20/Monat, 2 gleichzeitige Lesungen, Grenzen 32 MB/100 Seiten.
- Anthropic-API-Schluessel fuer Messlauf/Demo: PO legt ihn lokal in die Umgebung (nicht ins Repo).
