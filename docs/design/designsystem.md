# Designsystem Planora – gemeinsame Sprache fuer UI und 3D

Ziel: UI und 3D-Welt sehen aus wie aus einem Guss. Dieselben Farben, dieselbe Licht- und Schattenlogik, dieselben Radien-Verhaeltnisse, dieselbe Bewegung.
Werte sind Arbeitswerte [A] bis zur PO-Abnahme des Redesigns; die Richtung folgt [prinzipien.md](prinzipien.md). Sobald das Redesign umgesetzt ist, ist die Code-Quelle `app/web/src/design/tokens.ts` (TypeScript, von UI **und** 3D importiert) und CSS-Variablen werden daraus abgeleitet. Bis dahin gilt diese Datei.

## 1. Farbe

| Token | Wert [A] | UI | 3D |
|---|---|---|---|
| `grund` | `#f5f6f8` | Seitenhintergrund | Szenenhintergrund / Nebel |
| `flaeche` | `#ffffff` | Panels (mit 85 % Deckkraft) | Waende, Wandstirnen |
| `flaeche-2` | `#f2f3f5` | Kacheln, Tabellenkopf | Geschossplatten, Decken |
| `grau-1` | `#e6e9ed` | Rahmen, Trennlinien | Rahmen, Wege, Plattenrand |
| `grau-2` | `#c9ced6` | deaktiviert, Platzhalter | Kanten in AO-Zonen, Gelaender |
| `grau-3` | `#8a929e` | Sekundaertext | Anlagengehaeuse-Akzente |
| `text` | `#1f2630` (Graphit) | Primaertext | – |
| `eis` | `#dbe6f0` | Auswahl/Hover-Flaeche (sparsam) | Glas-Toenung |
| `eis-akzent` | `#5f88b0` | Fokusring, aktive Markierung | Auswahlumriss |
| `koo-heizung` | `#e5322d` (Leitungen), Geraeteband gleich | Legende, Badges Gewerk | Leitungen, Farbband an Anlagen |
| `status-ok` / `-warnung` / `-stoerung` | `#2f9e6b` / `#e08a1e` / `#d64541` | nur echte Zustaende | nur echte Zustaende (Marker) |

Regeln: Rot ist der Heizung (KOO) bzw. dem Stoerungsstatus vorbehalten – beide nie gleichzeitig an derselben Stelle als Unterscheidungsmerkmal verwenden (Stoerung zusaetzlich mit Icon). Weitere Gewerke (Lueftung, Sanitaer, Elektro, Kaelte) bekommen ihre KOO-Farben, sobald der PO sie liefert [?].

## 2. Material (3D) und Flaechen (UI)

- 3D: `MeshStandardMaterial`/`MeshPhysicalMaterial`, matt (roughness 0.8–0.95) fuer Bauteile, Glas roughness ~0.1 und teiltransparent, Anlagen leicht seidenmatt (0.5–0.6) mit metallischen Details (metalness <= 0.4). Keine Linienzeichnung, keine schwarzen Kanten.
- UI: Panels `flaeche` 85 % + Hintergrund-Weichzeichner 14–20 px, 1 px Rahmen `rgba(255,255,255,0.7)` aussen plus `grau-1` innen wo noetig.
- Gemeinsame Logik: In beiden Welten traegt **Licht/Schatten** die Tiefe, nicht Linien.

## 3. Licht und Schatten

- 3D: Umgebungslicht aus Lightformern (keine Datei), Sonne von links oben (Azimut ca. 225°, Hoehe ca. 50°), weiche Bodenschatten einmalig berechnet, N8AO fuer Ecken. Tone-Mapping so waehlen, dass KOO-Rot rot bleibt (nicht ACES – siehe [fehler.md](fehler.md)).
- UI: Schatten folgen derselben Lichtrichtung (leicht nach rechts unten versetzt), zweistufig: `0 1px 2px rgba(31,38,48,.06), 0 8px 24px rgba(31,38,48,.08)`. Schwebende Karten am Objekt etwas staerker.

## 4. Form und Raster

- Radien: Panels 12 px, Kacheln/Tabellenzeilen 8 px, Pills 999 px. 3D: Plattenkanten 4–6 cm, Gehaeuse 2–4 cm Radius – sichtbar weich, nie kugelig.
- Raster UI: 4-px-Basis, Abstaende 4/8/12/16/24/32. Kartenspalte links 320–340 px, rechts 280–300 px, Abstand zum Rand 16–20 px.
- 3D-Massstab: Masse in m, Daten aus `szene2/huelle.ts`.

## 5. Typografie

- Inter Variable (lokal, `@fontsource-variable/inter`). Groessen 12 / 13 / 15 / 22 px; Gewichte 400 / 500 / 600; Kennzahlen 600 mit tabellarischen Ziffern (`font-variant-numeric: tabular-nums`).
- Keine Versal-Eyebrows ueber jeder Ueberschrift (generisches Muster), keine Monospace-Datenlabels.
- 3D-Beschriftungen nur wenn noetig, als HTML-Overlay in derselben Schrift statt Canvas-Text.

## 6. Bewegung

- Dauer: 160 ms (Hover, kleine Zustaende), 280 ms (Panels, Auswahl), 600–900 ms (Kamerafahrten, Separieren).
- Kurve: `cubic-bezier(0.2, 0.8, 0.2, 1)` (UI) bzw. gleiche Daempfung in 3D (z. B. `maath/easing` damp mit vergleichbarer Zeitkonstante).
- Bewegung antwortet auf Handlungen; keine Dauerschleifen. `prefers-reduced-motion`: Kamerafahrten springen, Panels blenden nur.

## 7. Ikonografie

- lucide-react, Strichstaerke 1.75, Groesse 16/18 px, Farbe `grau-3` bzw. `text`. Anlagentypen bekommen je ein festes Icon (Zuordnung im Code bei den Tokens).
