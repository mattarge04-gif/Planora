# 0026 – Geschlossene 3D-Welt: Regelwerk, Interview-Agent und Weltgenerator

Status: akzeptiert (PO-Entscheid E33) · 2026-11-09 · Bezug: E2, E3 (minimaler Kundenaufwand), E8, E32 (GWR), AD-4, AD-6, AD-7

## Kontext
Viele Kunden haben keine brauchbaren Grundrisse, aber sie wissen, welche Gebaeude, Geschosse, Einheiten und technischen Anlagen sie haben. Die 3D-Darstellung soll **sinngemaess** sein (schematisch, nicht massstabsgetreu wie BIM), aber immer gleich aussehen und immer gleich funktionieren. Referenzbilder: isometrische Gebaeude mit Glas-Geschossen, Beschriftungen je Geschoss, Seitenpanel (siehe Spike S3b).

## Entscheid

### 1. Geschlossene Welt (Regelwerk)
Das **Welt-Regelwerk** legt fest, was es in der 3D-Welt geben darf und wie es aussieht. Es ist global, versioniert und liegt neben dem Katalog im Repo (`katalog/welt-regelwerk.vN.json`, AD-12: IDs stabil, nie umbenannt). Inhalt:

| Bereich | Regeln (Auszug) [A, Werte im Scaffold festlegen] |
|---|---|
| Gebaeudeform | Grundformen `quader`, `l_form`, `u_form`, `turm_auf_sockel` aus 1–4 Rechtecken; Breite/Tiefe 5–200 m; Default aus Geschossflaeche |
| Geschosse | Codes `UG3..UG1`, `EG`, `OG1..OG40`, `DG`, `DACH`; Hoehe 2,4–6,0 m, Default 3,2 m; Reihenfolge fix |
| Einheit-Arten | geschlossene Liste, z.B. `wohnung`, `buero`, `verkauf`, `gastro`, `lager`, `technik`, `kern` (Treppenhaus/Lift), `sanitaer`, `allgemein`, `parking`; je Art Default-Flaeche, Farbe, Symbol, Texte DE/FR/IT |
| Bauteile | nur Katalog-IDs (ADR 0011); je Einheit-Art erlaubte Katalog-Gruppen und plausible Mengen (z.B. Monoblock nur in `technik`/`DACH`, Heizkoerper 0–30 je `wohnung`) |
| Layout | Kern mittig; Einheiten als Rechtecke in Streifen entlang der Fassade, Flaechen anteilig zur angegebenen Flaeche, sonst gleich; Bauteile im Raster der Einheit (bestehendes Auto-Layout, 03 Kap. 7.2) |
| Darstellung | feste Materialien, Farben, Glas, Beschriftungen, Kamera, Explosionsabstand, Pin-Symbole; kein freies Modellieren durch Kunden |

### 2. Interview (Erfassung durch den Kunden)
- Neues Modul **`interview`**. Der Kunde beschreibt im Gespraech Liegenschaft → Gebaeude → Geschosse → Einheiten je Geschoss → technische Bauteile je Einheit (Art, Menge, Hersteller/Typ wenn bekannt, Einbaujahr wenn bekannt).
- **Mit KI** (Mandant hat KI aktiv, AD-16): Interview-Agent (Claude ueber Bedrock, ADR 0003) fuehrt durch die Fragen, fragt bei Luecken nach und schreibt das Ergebnis ausschliesslich ueber ein **geschlossenes Tool-Schema** `weltbeschreibung` (Enums aus Regelwerk und Katalog-IDs plus `null` = unbekannt, AD-6). Freitext-Typen sind nicht moeglich.
- **Ohne KI:** derselbe Ablauf als Formular-Assistent mit demselben Schema (manueller Weg, Qualitaetsziel 4). Excel-Vorlage "Gebaeude/Geschosse/Einheiten/Bauteile" als dritter Weg.
- Vorbelegung: GWR (ADR 0025) liefert Anzahl Geschosse und Baujahr; vorhandene Grundrisse (ADR 0014) liefern echte Raum-Rechtecke.
- **Herkunft:** Jeder Wert wird `angabe` bzw. Vorschlag mit `quelle_art=interview`, `interview_id` und dem Antwort-Zitat des Kunden (statt Seite + Zitat). Vor der Uebernahme sieht der Kunde eine Zusammenfassung **und die Vorschau der 3D-Welt** und bestaetigt (AD-5). Danach schreiben `struktur` und `bestand` wie gewohnt.

### 3. Weltgenerator (deterministisch)
- **Reine Funktion** `weltErzeugen(beschreibung, regelwerkVersion)` in `szene/domain`: erzeugt Gebaeudeform, Geschoss-Platten, schematische Einheit-Rechtecke und Bauteil-Positionen. Gleiche Eingabe + gleiche Regelwerk-Version → gleiche Welt (wie AD-7).
- Die KI erzeugt **nie** Geometrie, nur die Beschreibung. Geometrie entsteht nur im Generator.
- **Rangfolge der Geometrie:** bestaetigte Raeume aus Grundriss oder manuellem Zeichnen > schematische Einheit-Rechtecke aus dem Generator. Schematische Einheiten sind in der UI als "schematisch" gekennzeichnet.
- Einheiten werden als `raum` mit `raum.art` (Einheit-Art) und `raum.geometrie_quelle` (`schematisch` | `grundriss` | `manuell`) gespeichert; Bauteile als `element` mit Raum-Zuordnung.

### 4. Darstellung (zusammen mit ADR 0008)
- Gebaeude- und Bauteilmodell bleiben: Uebersicht mit Glas-Geschossen und Pins; beim Auswaehlen eines Geschosses bzw. einer Einheit erscheinen die **Bauteil-Modelle** (Ton-Look, GLB-Bibliothek) im Auto-Layout.

## Alternativen
- KI erzeugt Geometrie direkt: nicht reproduzierbar, nicht pruefbar → verworfen.
- Freier 3D-Editor fuer Kunden: hoher Aufwand, uneinheitliches Bild → verworfen.
- Nur Grundriss-Erkennung: scheitert ohne gute Plaene (E18).

## Konsequenzen
- + Kunde erfasst ein Gebaeude ohne Plaene in ca. 15–30 min [A]; Demo-faehig.
- + Einheitliches Bild in allen Mandanten; Regelwerk erweiterbar ohne Code (neue Einheit-Art = neue Regelwerk-Version).
- − Positionen und Einheit-Rechtecke sind nur sinngemaess; muss in UI und Export klar stehen.
- Folgearbeit: Regelwerk v1 mit PO festlegen; Golden Set "Interviews" (synthetische Gespraeche DE/FR/IT mit Soll-Weltbeschreibung); Tabellen `interview`, `interview_nachricht`, Spalten `raum.art`, `raum.geometrie_quelle`.
