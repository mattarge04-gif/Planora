# Spec: Lebensdauer und Ampel (Demo-Schnitt M7, E43)

Stand 19.11.2026. Grundlage: E43 in `docs/architektur/00-kontext.md`, Journal 17.11. (spaet). Entwurf Teil 1–3 vom PO bestaetigt ("passt"), Export als CSV (PO-Antwort "a", 19.11.). PO-Review 19.11.: keine Standardpreise ("preis ist sehr unabhängig"), Lebensdauer-Standard ja; Kosten sollen aus abgelegten Dokumenten gelesen werden.
Kennzeichnung: [F] Fakt, [A] Annahme, [?] offene Frage.

## 1. Ziel

Der FM sieht pro Gebaeude, welche Heizungsbauteile wann ersetzt werden muessen und was das kostet: Ampel je Bauteil-Datensatz, Twin-Modus "Erneuerung", Seite "Erneuerungsplan" mit 10 Jahresbalken, Liste und CSV-Export. Aufwand [A] 10–12 PT.

Nicht im Schnitt: Dokument-Upload/Viewer, Auslesen von Preisen aus Dokumenten (folgt mit Upload/KI-Auslesen), Teuerung, Wiederholungszyklen, ZHAW-Zustandsmodell, Hinweise per Mail (Modul `hinweise`), Gewerke ausser Heizung.

## 2. Daten (Migration 016 `lebensdauer.sql`)

[F] `bauteil.baujahr` existiert (013) und wird als Abweichung verwendet. `bauteil` wird ueber stabile IDs aktualisiert, nicht neu angelegt.

| Tabelle | Inhalt |
|---|---|
| `gebaeude_erneuerung` | `gebaeude_id` (PK, cascade), `liegenschaft_id`, `heizung_baujahr int null` (1800–2100) = Baujahr-Standard |
| `bauteil_akte` | `bauteil_id` (PK, FK cascade), `liegenschaft_id`, `zustand` (`gut`/`mittel`/`schlecht`/`kritisch`, null = unbekannt), `lebensdauer_jahre int null`, `stueckpreis numeric(12,2) null`, `notiz text <= 2000` |
| `lebensdauer_typ` | `liegenschaft_id`, `katalog_id` (PK zusammen), `l_min`, `l_mittel`, `l_max` (Jahre), `stueckpreis null`, `gelb_jahre` (Ampelschwelle), `quelle_lebensdauer` (`planora`/`kunde`), `quelle_preis` (`kunde`/`dokument`, null ohne Preis) |

- `lebensdauer_typ` wird beim ersten Zugriff je Liegenschaft aus dem Standard (Abschnitt 3) kopiert, Stueckpreis leer; danach gilt die Kopie. [A]
- Preisquelle `dokument` ist vorgesehen, wird in diesem Schnitt aber nicht befuellt; Preise kommen bis dahin nur aus Handeingabe (`kunde`). [A]
- `bauteil_akte` erhaelt ebenfalls `quelle_preis`.
- Rechte auf `planora_app` wie 013. Fremdschluessel mit `liegenschaft_id` wie bestehende Tabellen.

## 3. Standardwerte "Planora-Richtwert" – nur Lebensdauer [A, fachlich nicht freigegeben]

PO 19.11.: **keine Standardpreise**. Die Spalte Preis unten entfaellt.

Als TS-Modul `src/lebensdauer/standard.ts` (Docker-Build kopiert nur .ts). Rechnet mit `l_mittel`; `l_min`/`l_max` nur Anzeige.

| Katalog-ID | L mittel (J.) | Einheit |
|---|---|---|
| `heizung.waermepumpe` | 20 | Stk. |
| `heizung.gaskessel`, `heizung.oelkessel` | 20 | Stk. |
| `heizung.fernwaerme_uebergabe` | 30 | Stk. |
| `heizung.speicher` | 25 | Stk. |
| `heizung.umwaelzpumpe` | 12 | Stk. |
| `heizung.verteiler` | 30 | Stk. |
| `heizung.wmz` | 10 | Stk. |
| `heizung.heizkoerper` | 40 | Stk. |
| `heizung.fbh_kreis` | 50 | Kreis |
| `heizung.tabs_feld` | 50 | Feld |
| `heizung.ventil_3weg`, `heizung.ventil_2weg` | 20 | Stk. (neu ergaenzt [A]) |

`l_min` = 0.75 × mittel, `l_max` = 1.25 × mittel (gerundet) [A]. `gelb_jahre` = 3 [A]. Ein Test stellt sicher, dass jede Katalog-ID einen Standard hat.

## 4. Rechnung (`src/lebensdauer/rechnung.ts`, rein)

Eingabe: Bauteile mit Akte, Typwerte, Baujahr-Standard, **Stichtag** (Jahr). Keine DB, keine Uhr.

1. Baujahr = `bauteil.baujahr` ?? `heizung_baujahr`; Quelle `bauteil`/`gebaeude`. Fehlt beides -> Ampel **grau**, keine Kosten im Plan, Zaehler "ohne Baujahr".
2. Lebensdauer = `akte.lebensdauer_jahre` ?? `typ.l_mittel` ?? Standard; Quelle `bauteil`/`typ`/`planora`. Stueckpreis = `akte.stueckpreis` ?? `typ.stueckpreis`, sonst **kein Preis** (kein Standard).
3. Ersatzjahr = Baujahr + Lebensdauer − Zustandsabzug: gut 0, mittel 2, schlecht 5, unbekannt 0, kritisch = Stichtag [A].
4. Ampel: rot wenn Ersatzjahr <= Stichtag; gelb wenn <= Stichtag + `gelb_jahre`; sonst gruen.
5. Kosten = `menge` × Stueckpreis (menge null -> 1 [A], als Hinweis markiert). Ohne Preis: Kosten `null`, Bauteil zaehlt im Jahr als "ohne Preis" (Anzahl), Summen enthalten nur bekannte Kosten und sind dann als unvollstaendig markiert. Faellig im Ersatzjahr; Ueberfaelliges zaehlt im Stichtagsjahr.
6. Ausgabe: je Bauteil {ampel, baujahr, ersatzjahr, restjahre, kosten|null, quellen}; Jahressummen Stichtag..Stichtag+9 mit {betrag, ohnePreis}; Summe 5 J. mit {betrag, ohnePreis}; Zaehler je Ampelfarbe.

Kein automatischer Folgezyklus nach dem Ersatz (E43).

## 5. Backend-Modul `lebensdauer`

[F] Modul existiert im Manifest (Option, Stufe 2, braucht `bestand`, `katalog`). Fuer die Demo im Entwicklungsstart aktiv [A].

- `GET /api/lebensdauer/gebaeude/:id` – Rechte `fach.lesen`; liefert Baujahr-Standard, Typwerte, Bauteile mit Akte und Rechenergebnis (Stichtag = laufendes Jahr, Server).
- `PUT /api/lebensdauer/gebaeude/:id` – Recht `fach.aendern`; Body: `heizungBaujahr?`, `bauteile[]` {id, baujahr?, zustand?, lebensdauerJahre?, stueckpreis?, notiz?}, `typen[]` {katalogId, lMittel?, stueckpreis?}. Eine Transaktion, ajv strikt, 400 im einheitlichen Format, Audit-Ereignis `lebensdauer.geaendert`. Bauteil-IDs muessen zum Gebaeude gehoeren, sonst 400.
- `GET /api/lebensdauer/gebaeude/:id/export.csv` – `fach.lesen`; Semikolon, UTF-8 mit BOM, Spalten: Geschoss/Einheit, Bauteil, Hersteller, Typ, Menge, Baujahr, Zustand, Lebensdauer, Ersatzjahr, Ampel, Stueckpreis, Kosten, Quelle. Danach Jahressummen-Block. CSV-Zellen mit `= + - @` am Anfang werden mit `'` entschaerft.
- Fremde Liegenschaft -> 403/404 wie `struktur`. Betreiber hat kein `fach.lesen` (bleibt so).

[?] Risiko: Der Assistent schreibt `bauteil.baujahr` beim Uebernehmen mit. Ist sein geladener Stand alt, ueberschreibt er eine im Plan gesetzte Abweichung. Loesung im Plan: Assistent laedt die Beschreibung bei Oeffnen frisch (pruefen), sonst Hinweis in der Abnahme.

## 6. Oberflaeche (Gestaltung ueber `planora-design`, Stufe mittel)

- **Anlagenkarte** (bestehende Detailkarte im Twin): Ampelpunkt, Ersatzjahr, Restjahre, Kosten; Bereich "Lebensdauer" mit Bearbeiten (Baujahr, Zustand, Lebensdauer, Preis, Notiz). Jeder Wert zeigt seine Quelle; Standard-Lebensdauer heisst "Planora-Richtwert". Ohne Preis steht "Preis fehlt" mit Eingabefeld (spaeter: "aus Dokument").
- **Twin-Modus "Erneuerung"** (Taste E, neben bestehenden Szenentasten): Bauteile nach Ampel eingefaerbt, grau ohne Baujahr; Legende mit Anzahl je Farbe und Summe der naechsten 5 Jahre ("ohne Preis: n" wenn unvollstaendig).
- **Seite "Erneuerungsplan"** je Gebaeude: oben Baujahr-Standard (bearbeitbar), 10 Jahresbalken (Klick filtert Liste; Jahre mit fehlenden Preisen sichtbar markiert, Zahl "ohne Preis"), Liste sortiert nach Ersatzjahr, Knopf "CSV exportieren". Typwerte (Lebensdauer/Preis je Katalog-ID) in einem aufklappbaren Bereich.
- Ohne Recht `fach.aendern`: alles lesbar, keine Bearbeiten-Knoepfe.
- UI-Texte mit echten Umlauten.

## 7. Pruefung und Abnahme

**Backend-Tests (vitest):** Rechnung mit festem Stichtag (Rangfolge, grau, gelb-Schwelle, Zustandsabzug, Ueberfaelliges im Stichtagsjahr, Menge × Preis, fehlender Preis -> null und Zaehler, Jahressummen 10 J.); Lebensdauer-Standard deckt Katalog ab, kein Standardpreis; Migration (cascade beim Loeschen eines Bauteils, Typ-Kopie); API (Rechte, fremde Liegenschaft, 400-Format, CSV-Zeilen und Entschaerfung).

**Web-Tests:** Anlagenkarte (Ampel, Speichern, Quellen), Twin-Modus E (Farben, Legende, 5-J.-Summe), Erneuerungsplan (10 Balken, Liste = Balken).

**Browser-Abnahme:** `instanz.sh start --muster`, Baujahr-Standard 2008, 2 Abweichungen, 1 Zustand "schlecht", Preise fuer 2 Typen und 1 Bauteil eingegeben, Rest ohne Preis; Karte, Twin, Plan und CSV zeigen identische Zahlen. Ergebnis `docs/abnahme/2026-11-xx-lebensdauer/README.md`.

**Gestaltung:** GPU-Bilder Twin-Modus E und Erneuerungsplan, visual-critic bis "bereit", dann PO-Sichtung.

**Fertig:** alle Tests, tsc und Webbuild gruen; Zahlen ueber alle vier Ausgaben identisch; Richtwerte gekennzeichnet; fehlende Preise ueberall sichtbar.

## 8. Offen [?]

- Fachliche Freigabe der Lebensdauer-Standardwerte und Zustandsabzuege.
- Preise aus Dokumenten auslesen: PO 19.11. will das **in der Demo**; eigenes Teilprojekt mit eigener Spec (Upload + KI-Auslesen), Quelle `dokument` ist hier im Datenmodell vorbereitet. Handeingabe bleibt zusaetzlich (PO "ja").
- Echte .xlsx spaeter (neue Abhaengigkeit, Lizenzliste).
- Modul `lebensdauer` in Kundeninstanzen schalten (Profil P2) – Lieferthema, nicht Demo.
