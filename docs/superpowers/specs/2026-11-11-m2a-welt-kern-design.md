# M2a – Welt-Kern: Beschreibung, Datenmodell, Generator, API (Spec)

Stand: 2026-11-11 · Branch `main` (Umsetzung auf eigenem Branch) · Status: **Entwurf, Design im Gespraech abschnittsweise freigegeben; Freigabe der Spec ausstehend**
Kennzeichnung: [F] Fakt mit Quelle · [A] Annahme/Vorschlag · [?] offene Frage.
Grundlage: E38, ADR 0032 (verbindlich), ADR 0026 (Regelwerk/Generator, historisch praezisiert), ADR 0011 (Katalog), ADR 0028 (Rollen), CLAUDE.md 0b.

## 1. Ziel und Abgrenzung

M2 wird in drei Teilprojekte zerlegt (PO-Go 2026-11-11, Reihenfolge M2a → M2b → M2c):

| Teil | Inhalt |
|---|---|
| **M2a (diese Spec)** | Beschreibungsschema, Katalog v1, Welt-Regelwerk v1, Datenmodell, Abgleich mit stabilen IDs, deterministischer Generator, minimale HTTP-API, Beispieldaten |
| M2b | React/R3F: Uebersicht, Geschossauswahl, Explosionsansicht, Seitenpanel, reduzierter Modus, Tabellenweg |
| M2c | Erfassung durch den Kunden: Einheiten erfassen/kopieren/korrigieren, Heizungsassistent mit Folgefragen |

**Im Umfang M2a:** alles, was M2b und M2c als Daten- und Rechengrundlage brauchen, voll testbar ohne Browser.
**Nicht im Umfang:** UI, Excel-Import, Folgefragen-Logik des Heizungsassistenten (M2c), Dokumentverknuepfung (M4/M5), Lebensdauer/Ampel (M7), Liegenschaft-Verwaltung per API, KI-Interview.

Erfolgskriterium: Die Beispielliegenschaft des ersten Schnitts (§9) laesst sich per API anlegen, als Beschreibung lesen, unveraendert wieder schreiben (gleiche IDs, gleicher Welt-Hash) und als Welt abrufen.

## 2. Grundentscheide (im Gespraech freigegeben)

1. **Normalisierte Tabellen sind die Wahrheit.** Das Beschreibungsschema ist das gemeinsame Ein-/Ausgabeformat fuer Formular, spaeter Excel und KI; es wird vor dem Schreiben validiert (ADR 0032 Punkt 7).
2. **Geometrie wird nicht gespeichert**, sondern bei jedem Abruf vom Generator berechnet. Gespeichert werden nur bestaetigte manuelle Layouts/Positionen.
3. **Stabile IDs ueber die Beschreibung (Variante A):** Objekte tragen optional eine `id`. Mit ID → aktualisieren, ohne ID → neu (Server vergibt UUID), in DB vorhanden aber in Beschreibung fehlend → loeschen. Kopieren = ohne ID senden.
4. **Dreiwertigkeit:** `ja` / `nein` / `unbekannt`; Mengen `null` = unbekannt. Unbekannt ist nie Null und erzeugt kein bestaetigtes Bauteil. Ein Bauteil darf trotz unbekannter Menge (`menge = null`) `bestaetigt` sein (PO 2026-11-11): bestaetigt wird die Existenz, nicht die Anzahl.
5. **Vorschlaege:** Bauteile haben `status` `vorgeschlagen` | `bestaetigt`.

## 3. Katalog v1 und Welt-Regelwerk v1

Beide als versionierte **TypeScript-Module** im Repo (`app/src/welt/katalog.v1.ts`, `app/src/welt/regelwerk.v1.ts`). Grund: Der Docker-Build kopiert ausser Migrationen nur kompiliertes TypeScript; JSON-Dateien fehlten im Image.

**Abweichung von ADR 0011 [A]:** ADR 0011 sieht das Laden des Katalogs per Migration in `katalog_*`-Tabellen vor. Fuer vier Eintraege ohne Lebensdauerdaten ist das ohne Nutzen. Die DB speichert `katalog_id` als Text; die fachliche Validierung prueft gegen die Datei. Tabellen werden mit M7 (Lebensdauer) nachgezogen. Die Abweichung wird bei Umsetzung als Nachtrag in ADR 0011 vermerkt.

Katalog v1 (IDs nach ADR 0011, nie umbenennen). Demo-Umfang nur Heizung (PO 2026-11-11):

| katalog_id | Bereich | Erlaubte Menge je Zeile [A] |
|---|---|---|
| `heizung.waermepumpe` | Zentrale | 0–10 |
| `heizung.gaskessel` | Zentrale | 0–10 |
| `heizung.oelkessel` | Zentrale | 0–10 |
| `heizung.fernwaerme_uebergabe` | Zentrale | 0–10 |
| `heizung.speicher` | Zentrale | 0–10 |
| `heizung.umwaelzpumpe` | Zentrale | 0–50 |
| `heizung.verteiler` | Verteilung | 0–20 |
| `heizung.heizkoerper` | Einheit | 0–500 |
| `heizung.fbh_kreis` | Einheit | 0–200 |
| `heizung.tabs_feld` | Einheit | 0–200 |

Menge ausserhalb des Bereichs → `menge_ungueltig` (Ablehnung, PO 2026-11-11). Die Menge wird gespeichert (spaeter M7), beeinflusst die Darstellung aber nicht (§7).

Regelwerk v1, Werte **[A]** bis PO-Freigabe (Herkunft ADR 0026, sonst Vorschlag 2026-11-11):

| Bereich | Werte |
|---|---|
| Grundformen | `quader` (1 Rechteck), `l_form` (2), `u_form` (3); Schenkelanteil 0.4 der Tiefe |
| Masse | Breite/Tiefe 5–200 m, Default 30 × 15 m; erfasst durch Planora, nicht durch den Kunden |
| Geschoss-Codes | `UG3..UG1`, `EG`, `OG1..OG40`, `DG`, `DACH`; Hoehe 2.4–6.0 m, Default 3.2 m |
| Einheit-Arten, Default-Flaeche | `buero` 120 m², `wohnung` 90, `gastro` 150, `technik` 30, `kern` 25, `allgemein` 40 |

Flaeche je Einheit ist **optional**; sie bestimmt nur die relative Streifenbreite im Schema (PO 2026-11-11: kein Pflichtfeld, im Formular unter "weitere Angaben").

Erlaubt-Matrix (Bauteil je Einheit-Art; "Geschoss" = Standort direkt am Geschoss):

| | buero | wohnung | gastro | technik | kern | allgemein | Geschoss |
|---|---|---|---|---|---|---|---|
| Zentrale (6 IDs) | – | – | – | ✓ | – | – | ✓ |
| Verteiler | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| Heizkoerper | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| FBH-Kreis, TABS-Feld | ✓ | ✓ | ✓ | – | – | ✓ | – |

Die Regelwerk-Datei traegt `version: 1`; `gebaeude.regelwerk_version` haelt fest, mit welcher Version ein Gebaeude erzeugt wurde. Verhalten bei Regelwerk-Updates ist ausserhalb M2a [?].

## 4. Datenmodell (Migration `013_gebaeude.sql`)

| Tabelle | Spalten (Auszug) |
|---|---|
| `gebaeude` | `id`, `liegenschaft_id`, `name`, `grundform`, `breite_m`, `tiefe_m`, `regelwerk_version`, `stand` (int, Optimistic Locking) |
| `geschoss` | `id`, `liegenschaft_id`, `gebaeude_id`, `code`, `reihenfolge`, `hoehe_m`; unique (`gebaeude_id`, `code`) |
| `einheit` | `id`, `liegenschaft_id`, `geschoss_id`, `bezeichnung`, `art`, `flaeche_m2` null, `reihenfolge`, `layout_manuell` jsonb null (`{x, z, breite, tiefe}`) |
| `gebaeude_heizung_standard` | `gebaeude_id`, `liegenschaft_id`, `art` (`hk`/`fbh`/`tabs`), `vorhanden` (`ja`/`nein`/`unbekannt`); PK (`gebaeude_id`, `art`) |
| `einheit_heizung` | `einheit_id`, `liegenschaft_id`, `art`, `vorhanden`; PK (`einheit_id`, `art`) – **nur Ausnahmen** vom Standard |
| `bauteil` | `id`, `liegenschaft_id`, `gebaeude_id`, `katalog_id`, `einheit_id` null, `geschoss_id` null, `menge` int null, `status`, `hersteller`/`typ` text null, `baujahr` int null, `reihenfolge`, `position_manuell` jsonb null |
| `versorgung` | `bauteil_id`, `einheit_id`, `liegenschaft_id`; PK (`bauteil_id`, `einheit_id`) |

Regeln in der DB:

- **Liegenschaftsgrenze:** Jede Tabelle fuehrt `liegenschaft_id`; Fremdschluessel sind zusammengesetzt (`id`, `liegenschaft_id`), sodass kein Verweis in eine fremde Liegenschaft zeigen kann.
- **Checks:** genau einer von `einheit_id`/`geschoss_id` gesetzt; `menge >= 0`; Enums per `check`; `baujahr` 1800–2100.
- **Loeschen:** `on delete cascade` von Gebaeude abwaerts; das Blockieren bei manuellen Positionen geschieht im Abgleich (§6), nicht in der DB.
- **Grants:** `select, insert, update, delete` fuer `planora_app`, analog `006_rechte.sql`.
- **Standard + Ausnahmen (PO 2026-11-11):** Wirksamer Wert je Einheit und Art = Ausnahme in `einheit_heizung`, sonst `gebaeude_heizung_standard`, sonst `unbekannt`. Beispiel: Standard HK = ja; Einheit "Restaurant" Ausnahme HK = nein, FBH = ja. Neue Einheiten erben den Standard; Standardaenderung wirkt auf alle Einheiten ohne Ausnahme.
- **Typ / Menge / Exemplar:** Eine Zeile mit `menge = 8` = acht gleichartige Bauteile; ein individuell gepflegtes Exemplar ist eine eigene Zeile mit `menge = 1`.

## 5. Beschreibungsschema

TypeScript-Typen in `app/src/welt/typen.ts` plus JSON-Schema (`app/src/welt/schema.ts`) fuer ajv (bereits Abhaengigkeit von Fastify [F, `node_modules/ajv`]; keine neue Abhaengigkeit).

```ts
type Dreiwertig = "ja" | "nein" | "unbekannt";
interface Beschreibung {
  gebaeudeId: string; stand: number;
  geschosse: { id: string; code: string }[];          // nur lesend, Huelle aendert der Betreiber
  heizungStandard: { hk: Dreiwertig; fbh: Dreiwertig; tabs: Dreiwertig };
  einheiten: {
    id?: string; geschossId: string; bezeichnung: string; art: string;
    flaecheM2: number | null; layoutManuell?: Rechteck | null;
    heizungAusnahme?: Partial<{ hk: Dreiwertig; fbh: Dreiwertig; tabs: Dreiwertig }>; // nur Abweichungen
    heizungWirksam?: { hk: Dreiwertig; fbh: Dreiwertig; tabs: Dreiwertig };         // nur in Antworten, beim PUT ignoriert
  }[];
  bauteile: {
    id?: string; katalogId: string; standort: { einheitIndex?: number; einheitId?: string; geschossId?: string };
    menge: number | null; status: "vorgeschlagen" | "bestaetigt";
    hersteller?: string | null; typ?: string | null; baujahr?: number | null;
    positionManuell?: { x: number; z: number } | null;
    versorgt: ({ einheitId: string } | { einheitIndex: number })[];
  }[];
}
interface Huelle { name: string; grundform: "quader" | "l_form" | "u_form"; breiteM: number; tiefeM: number;
  geschosse: { id?: string; code: string; hoeheM?: number }[]; }
```

`einheitIndex` erlaubt Verweise auf Einheiten, die im selben Request neu angelegt werden (noch ohne ID). Die Reihenfolge der Arrays bestimmt `reihenfolge`.

## 6. Abgleich (`app/src/welt/pruefung.ts` fachliche Pruefung, `app/src/welt/speicher.ts` Schreiben)

`PUT /api/struktur/gebaeude/:id/beschreibung` in einer Transaktion:

1. **Struktur** per ajv. Fehler → 400.
2. **Stand:** `stand` ungleich DB → 409 `stand_veraltet`.
3. **Fachlich** (Ergebnis: Liste `{pfad, code, meldung}`, → 422):
   - `katalog_unbekannt`, `art_unbekannt`, `katalog_nicht_erlaubt` (Regelwerk je Einheit-Art)
   - `menge_ungueltig` (negativ, nicht ganzzahlig)
   - `id_unbekannt` (ID nicht in diesem Gebaeude, deckt fremde Liegenschaft ab)
   - `verweis_ungueltig` (Geschoss/Einheit nicht in diesem Gebaeude, `einheitIndex` ausserhalb)
   - `standort_fehlt` / `standort_doppelt`
   - `bestaetigt_bei_unbekannt`: ein `bestaetigt`-Bauteil in einer Einheit, deren **wirksame** passende Heizungsart (Ausnahme, sonst Standard) `nein` oder `unbekannt` ist. Zuordnung: `heizung.heizkoerper` → `hk`, `heizung.fbh_kreis` → `fbh`, `heizung.tabs_feld` → `tabs`; `heizung.verteiler` ist keiner Art zugeordnet und von dieser Regel ausgenommen
   - `loeschen_blockiert`: zu loeschende Einheit/Bauteil hat `layout_manuell`/`position_manuell`
   - `id_doppelt`: dieselbe ID kommt in der Beschreibung mehrfach vor
   - Huelle: `mass_ungueltig`, `geschoss_fehlt`, `geschoss_code_ungueltig`, `geschoss_doppelt`, `hoehe_ungueltig`, `geschoss_belegt`
4. **Schreiben:** update / insert / delete je Tabelle; Versorgung und Einheit-Heizung je Objekt komplett ersetzen.
5. `stand + 1`; Audit-Ereignis `gebaeude.beschreibung` mit Zaehlern (angelegt/aktualisiert/geloescht) ueber `auditEreignis` (`src/audit/audit.ts`), keine Inhalte.
6. Antwort: neue Beschreibung mit vergebenen IDs.

**FBH-Vorschlag:** Hat eine Einheit `fbh = ja` und versorgt sie kein Verteiler, liefert `GET /beschreibung` einen Hinweis `verteiler_vorschlag` (kein gespeichertes Bauteil). Das Anlegen als `vorgeschlagen` bzw. das Bestaetigen ist Sache von M2c.

## 7. Generator (`app/src/welt/generator.ts`)

`weltErzeugen(beschreibung, huelle, regelwerk) → Welt`, reine Funktion ohne DB, Zeit oder Zufall.

1. **Grundriss:** Teilrechtecke je Grundform aus Breite/Tiefe und Schenkelanteil.
2. **Geschosse:** nach `reihenfolge` gestapelt; EG-Oberkante Boden auf y = 0, UG darunter.
3. **Einheiten:** Einheiten mit `layoutManuell` behalten ihr Rechteck. Die uebrigen werden als Streifen entlang der Laengsachse ueber die Teilrechtecke verteilt, Breite proportional zur Flaeche (unbekannt → Default der Art). Ueberlappungen werden als `hinweise[]` ausgegeben, nicht abgelehnt. Hinweise `ueberlappung` entstehen bei automatisch-gegen-manuell und manuell-gegen-manuell; `position_widerspruch` entsteht, wenn sich manuelle Positionen innerhalb einer Symbolgruppe unterscheiden.
4. **Bauteile, symbolisch (PO 2026-11-11):** Je Standort und Gruppe (`katalogId`, `hersteller`, `typ`) **genau ein Symbol**, unabhaengig von der Menge (1 oder 100 Heizkoerper = ein Symbol). Verschiedene Typen in derselben Einheit (z.B. Zehnder und Prolux) ergeben je ein eigenes Symbol. Ein Symbol fasst alle Bauteil-Zeilen der Gruppe zusammen (`bauteilIds`, Summe der Mengen; `mengeUnbekannt`, wenn eine Zeile `null` hat). Symbole im Raster der Standort-Einheit; Standort Geschoss → Raster im groessten Teilrechteck des Grundrisses (bei Quader: ganzes Rechteck; bei Gleichstand das erste, d.h. der Riegel). `positionManuell` einer Zeile hat Vorrang fuer ihr Symbol; widersprechen sich manuelle Positionen innerhalb einer Gruppe, gilt die Zeile mit kleinster `reihenfolge` und ein Hinweis wird ausgegeben. Ein Symbol gilt als `vorgeschlagen`, sobald eine Zeile der Gruppe vorgeschlagen ist.
5. **Versorgung:** als Verweisliste (Bauteil → Einheiten), keine Leitungsgeometrie.

Determinismus: Sortierung nur nach `reihenfolge` und Array-Position, nie nach UUID. Ausgabe enthaelt `regelwerkVersion` und `hash` (SHA-256 ueber kanonisches JSON, Schluessel sortiert, Zahlen auf mm gerundet). Koordinaten in Metern, y nach oben (Three.js).

```ts
interface Welt {
  regelwerkVersion: number; hash: string;
  grundriss: Rechteck[];
  geschosse: { id: string; code: string; yUnten: number; hoehe: number }[];
  einheiten: { id: string; geschossId: string; bezeichnung: string; art: string; rechteck: Rechteck; quelle: "schematisch" | "manuell" }[];
  symbole: { schluessel: string; katalogId: string; hersteller: string | null; typ: string | null;
             bauteilIds: string[]; mengeSumme: number; mengeUnbekannt: boolean; // mengeSumme = Summe der bekannten Mengen
             status: "vorgeschlagen" | "bestaetigt"; position: { x: number; y: number; z: number };
             versorgt: string[] }[];   // schluessel = JSON [Standort-ID, katalogId, hersteller, typ], stabil fuer die Auswahl in M2b; Referenz: app/src/welt/typen.ts
  hinweise: { code: string; bezug: string }[];
}
```

## 8. HTTP-API (`app/src/welt/routen.ts`)

| Methode | Pfad | Recht | Zweck |
|---|---|---|---|
| POST | `/api/struktur/liegenschaften/:lid/gebaeude` | `huelle.verwalten` (`betreiber`) | Huelle anlegen |
| GET | `/api/struktur/gebaeude/:id/huelle` | `huelle.verwalten` | Huelle lesen |
| PUT | `/api/struktur/gebaeude/:id/huelle` | `huelle.verwalten` | Huelle aendern; Geschoss loeschen nur ohne Einheiten/Bauteile, sonst 422 |
| GET | `/api/struktur/gebaeude/:id/beschreibung` | `fach.lesen` + Liegenschaft | Beschreibung mit IDs und Hinweisen |
| PUT | `/api/struktur/gebaeude/:id/beschreibung` | `fach.aendern` + Liegenschaft | Abgleich (§6) |
| GET | `/api/szene/gebaeude/:id/welt` | `fach.lesen` + Liegenschaft | Generator-Ergebnis |

- Neues Recht `huelle.verwalten: ["betreiber"]` in `MATRIX` (`src/rechte/rechte.ts`). Der Betreiber hat bewusst **kein** Lese-/Schreibrecht auf Einheiten und Technik.
- Ohne Recht auf die Liegenschaft → 404 (keine Existenz-Auskunft).
- Routen haengen am bestehenden Auth-/Sitzungsmechanismus (`src/auth/fastify.ts`) und am Modulschalter-Muster (`src/module/`). Routen gehoeren den bestehenden Kern-Modulen `struktur` (Huelle, Beschreibung) und `szene` (Welt); jede `/api`-Route muss einem Modul gehoeren (`src/module/manifest.ts`).

## 9. Beispieldaten

Skript `npm run welt:beispiel` legt die Liegenschaft des ersten Schnitts (ADR 0032) an:

- Gebaeude `quader` 30 × 15 m, Geschosse `EG`, `OG1`; Heizungsstandard HK = ja, FBH = nein, TABS = nein.
- EG: Buero A, Restaurant (`gastro`, Ausnahme HK = nein, FBH = ja), Technik.
- OG1: Buero C (Ausnahme FBH = ja), Buero D (Ausnahme FBH = ja).
- Zentrale in Technik EG: Waermepumpe, Speicher.
- Buero A: 12 Heizkoerper Zehnder und 3 Heizkoerper Prolux → zwei Symbole.
- Ein Verteiler, Standort Technik im EG, versorgt Restaurant (EG) und Buero C (OG1). Buero D bleibt ohne Verteiler → Hinweis `verteiler_vorschlag`.

Dieselben Daten dienen als Test-Fixture.

## 10. Tests

Alle in `npm test` (Vitest, embedded-postgres via `test/globalSetup.ts` [F]); kein Docker.

| Abnahme ADR 0032 | Test |
|---|---|
| Reproduzierbare Geometrie, stabile IDs | GET beschreibung → PUT unveraendert → gleiche IDs, gleicher Welt-Hash |
| Gemischte Heizungsarten, gemeinsamer Verteiler, Standort ≠ Versorgung | Beispieldaten: Verteiler in Technik EG versorgt Einheiten auf EG und OG1 |
| Unbekannt erzeugt keine bestaetigten Anlagen | `bestaetigt_bei_unbekannt` → 422 |
| Mengenfehler, fremde Verweise abgelehnt | `menge_ungueltig`, `id_unbekannt` mit ID aus zweiter Liegenschaft; zusaetzlich direkter SQL-Insert scheitert am zusammengesetzten FK |
| Kopieren erzeugt eigene Exemplare | Einheit ohne ID duplizieren → neue IDs, Original unveraendert |
| Neugenerierung verliert keine manuellen Positionen | `position_manuell` bleibt nach PUT; Loeschen → `loeschen_blockiert` |
| (Dokumente) | ausgeklammert bis M4/M5 |

Zusaetzlich: Standard + Ausnahme (neue Einheit erbt Standard; Standardaenderung wirkt nicht auf Einheiten mit Ausnahme), Generator-Einheitstests (drei Grundformen, ein Symbol bei Menge 1 und 100, zwei Symbole bei zwei Herstellern, `mengeUnbekannt`, Ueberlappungshinweis), Rechte (Leser darf nicht schreiben, Betreiber sieht keine Beschreibung, fremde Liegenschaft → 404), 409 bei veraltetem Stand.

## 11. Offene Punkte

- [?] Regelwerk-Werte v1 (Default-Flaechen, Schenkelanteil, Mengenbereiche, Erlaubt-Matrix): PO-Freigabe vor M2b.
- Fuer M2c festgehalten (PO 2026-11-11): Assistent fragt zuerst Gebaeude/Geschosse/Einheiten, dann die Zentrale, dann den Heizungsstandard, dann Ausnahmen je Einheit, dann Verteiler/Versorgung. Demo nur Heizung.
- [A] Aufwand Standard + Ausnahmen ca. +0.5 PT; M2a gesamt damit ca. 2.5–3.5 PT.
- [?] Verhalten bestehender Gebaeude bei Regelwerk v2.
- [A] Liegenschaften werden in M2a per Beispielskript bzw. SQL angelegt; eine Verwaltungs-API folgt spaeter.
- [A] Aufwand: Gespraechsschaetzung, nicht gemessen.

### Nachtrag nach Umsetzung (2026-11-11): bewusst offen gelassene Punkte

Aus den Task- und Schlussreviews (Opus, Codex), nicht mergeblockierend:

- 400-Antworten haben das Fastify-Format `{statusCode, error, message}`, fachliche Fehler `{fehler}` – vor M2b vereinheitlichen.
- Regelwerk v2: Der Generator greift ohne Schutz auf `einheitArten[art]` zu; faellt eine Art weg, bricht `/welt` fuer bestehende Daten (siehe offener Punkt oben).
- `aendereHuelle` ohne Stand-Pruefung (letzter Schreiber gewinnt unter Betreibern).
- `bauteil`/`versorgung` sind in der DB nur an die Liegenschaft gebunden, nicht an das Gebaeude; Schutz liegt im Abgleich (Bestand, getestet).
- Schema-Pruefung (400) laeuft vor der Sitzungspruefung (401); Zugriffspruefung und Schreiben auf zwei DB-Verbindungen.
- Doppelte Versorgungseintraege werden still zusammengefasst; nach `id_unbekannt` folgen teils `verweis_ungueltig`-Folgefehler.
- Testluecken: Grant-Test nutzt ODER-Semantik von `has_table_privilege`; "beide Standorte gesetzt" und Liegenschaftsgrenze nur fuer `einheit` getestet; Regelwerk-Test deckt nicht die ganze Erlaubt-Matrix.
