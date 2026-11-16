# Heizungserfassung vereinfachen – Design

Stand 16.11.2026, Branch `m2c-interview`. Brainstorming mit PO, Punkt 12 aus `docs/superpowers/plans/2026-11-13-stufe1-integration.md`.
Kennzeichnung: [F] Fakt/PO-Entscheid, [A] Annahme, [?] offen.

## 1. Anlass

- [F] PO 14.11.: Erfassung "zu aufwendig", "je Geschoss zu muehsam". PO 16.11.: Hauptproblem sind zu viele Klicks je Geschoss, obwohl die Geschosse fast gleich sind.
- [F] FM-Manager-Review 16.11. (Agent, echter Browserdurchlauf, Bilder und README `docs/abnahme/2026-11-16-fm-review/`): Buerohaus UG1+EG+OG1–OG5, 4 Bueros je OG, Gastro EG, Technik UG, WP+Speicher, HK Standard, FBH in OG4/OG5/Gastro, 3 Gruppen, 9 FBH-Verteiler. **Rund 165 Klicks/Eingaben**, davon Einheiten 30, Abgaben 41, Gruppen 39 (30 einzelne Haekchen), Unterverteiler 36.
- [F] Ursachen im Code: keine Mehrfachbearbeitung je Geschoss; Gruppen-Verbraucher nur als Einzel-Checkbox (`Schritt5Gruppen.tsx:57-80`); FBH-Verteiler je Einheit einzeln einschalten, speisen, WMZ (`Schritt6Unterverteiler.tsx:25-49`); Hersteller/Typ nur je Abgabe.

## 2. PO-Entscheide 16.11. [F]

| # | Entscheid |
|---|---|
| H1 | **Regelgeschoss**: Vorlage erfassen, mehreren Geschossen zuweisen, danach nur Abweichungen bearbeiten. |
| H2 | Zuordnung Vorlage → Geschoss wird **dauerhaft gespeichert** (Ansatz 1b), nicht nur im Entwurf (der wird nach Uebernehmen geloescht, `Assistent.tsx:234`). |
| H3 | Gruppen in Kundengebaeuden meist **nach Heizart** oder **nach Gebaeudeteil/Strang** → Vorschlag je Heizart, Teilen nach Geschossen. |
| H4 | Begriff: es gibt **keine Unterverteiler**, sondern **FBH-Verteiler**, die per Leitung mit ihrer Gruppe in der Zentrale verbunden sind. FBH-Verteiler entstehen **automatisch** je Einheit mit FBH. |
| H5 | **Hersteller/Typ** einmal am **Gebaeudestandard** je Heizart, mit Ausnahmen; Nachtragen im Twin bleibt moeglich. |
| H6 | Was der Kunde im Assistenten selbst erfasst oder anfasst, wird beim Uebernehmen **bestaetigt**; unberuehrte Automatik-Vorschlaege bleiben **vorgeschlagen**. |
| H7 | Aus dem Review uebernommen: freie Anzahl je Nutzung, Nummerierung je Geschoss, Sondergruppe je Einheit, Pruefung in Klartext, Kleinkorrekturen (Abschnitt 4.6). |

## 3. Neuer Ablauf (7 statt 8 Schritte)

| # | Schritt | Inhalt |
|---|---|---|
| 1 | Gebaeude | unveraendert |
| 2 | Geschosse & Einheiten | Vorlagen anlegen (z. B. "Regel-OG: 4 Bueros + Kern"), per Chip Geschossen zuweisen. Einzelgeschosse (EG, UG) wie heute. Zugewiesenes Geschoss zeigt "wie Regel-OG" + "Abweichung". Je Nutzung freie Anzahl per +/−. |
| 3 | Heizung | Gebaeudestandard HK/FBH/TABS (Ja/Nein/Weiss nicht), je Heizart einklappbar Hersteller/Typ. Ausnahmen an der Vorlage (gilt fuer alle ihre Geschosse) oder an einer Einheit. |
| 4 | Zentrale | unveraendert; Raum mit der einzigen Technik-Einheit vorbelegt, Raumliste mit Geschossangabe. |
| 5 | Gruppen & FBH-Verteiler | Gruppen vorgeschlagen (je wirksamer Heizart eine, alle Verbraucher zugeordnet). "Gruppe teilen" ordnet ganze Geschosse zu; "Eigene Gruppe" fuer eine Einheit (z. B. Gastro). Einzelabgaben nur eingeklappt. Darunter: "n FBH-Verteiler, automatisch an Gruppe FBH" mit aufklappbaren Ausnahmen und Schalter "WMZ an allen". |
| 6 | Weitere Teile | unveraendert |
| 7 | Pruefen | Klartext statt Zaehler (z. B. "Für 30 Einheiten fehlt die Anzahl Heizkörper"). |

Ziel [A]: Review-Gebaeude mit **hoechstens 40 Klicks** statt 165.

## 4. Daten und Bausteine

### 4.1 Speicherung Regelgeschoss

- Migration `015_geschoss_vorlage.sql`: Tabelle `geschoss_vorlage(gebaeude_id uuid primary key, liegenschaft_id uuid not null, daten jsonb not null` mit Groessenpruefung wie `entwurf`, Fremdschluessel `(gebaeude_id, liegenschaft_id)` auf `gebaeude` mit `on delete cascade`, Rechte fuer `planora_app`).
- Inhalt `daten` (versioniert, `version: 1`): Liste Vorlagen `{ schluessel, name, plaetze: [{ schluessel, art, bezeichnungsmuster }], geschosse: [geschossId] }` und Zuordnung `einheitId → { vorlage, platz, abweichend: [feld] }`.
- Die Uebernahme-Route nimmt optional `vorlagen` neben der Beschreibung an. Neue Einheiten werden wie heute per `einheitIndex` referenziert; das Backend setzt nach dem Schreiben die echten IDs ein. Schreiben **in derselben Transaktion** wie die Beschreibung. Ohne `vorlagen` wird ein bestehender Eintrag geloescht.
- Lesen: neue Route oder Erweiterung der Beschreibungs-Antwort [A, im Plan festlegen]; Zugriffsregeln wie Beschreibung.
- Beschreibungsformat, Generator, Welt-Schnittstelle, Router und Twin bleiben unveraendert.

### 4.2 Assistent-Zustand (`app/web/src/assistent/zustand.ts`)

- Einheiten bleiben ausgerollt im Zustand (bestehende Schritte arbeiten weiter darauf).
- Neu je Einheit optional `vorlage { schluessel, platz }` und `abweichend: Set<Feld>`.
- Vorlage aendern → alle Einheiten der Vorlage uebernehmen die Aenderung ausser in ihren abweichenden Feldern. Eine Einheit direkt aendern → Feld wird `abweichend`. "Auf Vorlage zuruecksetzen" je Einheit.
- Entwurf (`entwurf.daten`) traegt dieselben Angaben, damit Zwischenspeichern sie nicht verliert.

### 4.3 Reine Funktionen (einzeln testbar)

- `gruppenVorschlagen(zustand)`: je wirksamer Heizart eine Gruppe mit allen passenden Verbrauchern (HK-Abgaben, FBH-Verteiler, TABS). Optionen Teilen nach Geschossmengen und Sondergruppe je Einheit. Gruppen mit Merker `angefasst` werden nicht neu berechnet; nicht angefasste werden bei Aenderungen in Schritt 2/3 neu abgeleitet.
- `fbhVerteilerAbleiten(zustand)`: je Einheit mit wirksamer FBH ein FBH-Verteiler, gespeist von der FBH-Gruppe, der die Einheit zugeordnet ist; WMZ global plus Ausnahmen je Verteiler.
- `nummerieren(geschoss, einheiten)`: Bezeichnung "<Nutzung> <Geschoss>.<lfd>", z. B. "Büro 3.01". EG = "0.01", UG = "U1.01" [A, PO-bestaetigt im Entwurf, Format im Plan pruefen]. Nur fuer neu erzeugte Einheiten; manuell umbenannte bleiben.

### 4.4 Status beim Uebernehmen

- Bauteile, die der Kunde erfasst oder angefasst hat → `bestätigt` (Wert wie im bestehenden Schema).
- Automatisch erzeugte, unberuehrte (vorgeschlagene Gruppen-Bestueckung, FBH-Verteiler ohne Aenderung, Abgaben mit unbekannter Menge?) → `vorgeschlagen`. [?] Ob automatisch erzeugte Abgaben aus dem bewusst gesetzten Standard als "erfasst" gelten: Vorschlag ja, weil der Kunde den Standard aktiv setzt; im Plan bestaetigen.

### 4.5 Begriffe in der Oberflaeche

- "FBH-Verteiler" statt "Unterverteiler"/"Heizungsverteiler" (Assistent und Twin-Anzeigename).
- "Wärmezähler" mit Umlaut in der Anlagenliste.

### 4.6 Kleinkorrekturen aus dem Review

- Raum der Zentrale vorbelegen, wenn genau eine Technik-Einheit existiert; Liste mit Geschossangabe.
- Gruppen-Verbraucherliste nach Geschoss gruppiert und einklappbar statt 32 Zeilen.

## 5. Fehlerfaelle

- Geschoss aus Vorlage loesen: Einheiten bleiben, werden eigenstaendig.
- Vorlage loeschen: Rueckfrage; alle zugewiesenen Geschosse werden Einzelgeschosse, Einheiten bleiben.
- Vorlage mit Abweichungen aendern: abweichende Felder bleiben, Hinweis "n Einheiten weichen ab".
- `geschoss_vorlage` veraltet/ungueltig (Einheit fehlt, Geschoss existiert nicht mehr, unbekannte Version): Assistent ignoriert die betroffenen Teile, zeigt "abgelöst"-Hinweis, laedt sonst wie heute. Uebernehmen scheitert nie daran.
- Bestehende Gebaeude ohne Vorlage: wie heute, jedes Geschoss einzeln.

## 6. Tests

- Web-Unit: `gruppenVorschlagen`, `fbhVerteilerAbleiten`, `nummerieren`, Vorlagen-Weitergabe mit Abweichungen, Laden mit veralteter Vorlage.
- Backend: Migration 015, Uebernehmen mit/ohne Vorlage (ID-Aufloesung, Transaktion, Rollback bei Fehler), Status `bestätigt`/`vorgeschlagen`, Zugriffsrechte.
- Browser-Ablauftest mit dem Review-Gebaeude; Klickzaehlung, Ziel ≤ 40.
- Danach erneuter FM-Manager-Review (gleicher Auftrag) zum Vergleich.
- Gestaltung: Skill `planora-design`, Stufe mittel (Schritte 2, 3, 5 neu gestaltet), visual-critic mit GPU-Bildern, PO-Sichtung.

## 7. Aufwand [A]

Etwa 4–5 Arbeitstage Agentenarbeit (Backend ~1, Zustand/Funktionen ~1.5, Oberflaeche ~1.5, Tests/Review ~1).

## 8. Ausserhalb dieses Umbaus (Liste)

Aus dem FM-Review, nicht Teil dieser Spec:

1. **Kritisch – Eingabeverlust beim Anlegen:** Admin fuellt Schritt 1 aus, erst danach "Neue Gebäude legt Planora an"; nach "Schliessen" Eingaben ohne Warnung weg. Rollenregel (E38) bleibt, Verlust ist ein Fehler.
2. **Kritisch – Twin:** Steigzonen nicht als durchgehender Weg erkennbar; Gruppenfarben mit Legende fehlen; Einheiten ohne Beschriftung.
3. Assistent-Vorschau zeigt nur den Kubus, keine Technik.
4. Liegenschaft anlegen nirgends moeglich.
5. Gruppenkarte im Twin: 21× "Heizkörper" ohne Raum, Karte unten abgeschnitten; Zoom fuer FBH-Verteiler/Kreise knapp; Form ohne Hinweis auf Gebaeudegroesse.
