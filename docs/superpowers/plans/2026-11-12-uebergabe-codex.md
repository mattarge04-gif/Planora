# Uebergabe an Codex – Redesign Digital Twin (12.11.2026)

Alle Claude-Agenten sind gestoppt. Codex uebernimmt vollstaendig. Sprache de-CH, kein Eszett; UI-Texte mit echten Umlauten. Kennzeichnung [F]/[A]/[?].

## 1. Wo wir stehen [F]

- Branch **`m2b2-redesign`** (ab `80db2a1`, nicht gepusht). `m2b1-sichtbarer-schnitt` bleibt als Referenz unveraendert (bis `80db2a1`, ebenfalls nicht gepusht seit `e5f9129`).
- Commits auf `m2b2-redesign`:
  - `e73a250` Spec Redesign: `docs/superpowers/specs/2026-11-12-redesign-digital-twin-design.md` (PO-bestaetigt)
  - `64b2555` Plan Schritt 1 Szene-Look: `docs/superpowers/plans/2026-11-12-redesign-schritt1-szene-look.md`
  - `22e8641` Pakete exakt: drei 10.7.9, @react-three/postprocessing 3.2.2, postprocessing 6.39.6, n8ao 2.0.1, @fontsource-variable/inter 5.3.0, lucide-react 1.72.0 (reviewt)
  - `c2ba3fa` reine Funktionen `app/web/src/szene3/rahmen.ts`, `kulisse.ts`, `kamera.ts` + 11 Tests (reviewt)
  - `58b2cac` **Creative Design System** (siehe Abschnitt 3)
- **Git-Stash** `stash@{0}` "Redesign T3 angefangen (gestoppt fuer Design-System), Basis c2ba3fa": angefangene Diorama-Szene (`szene3/Szene3.tsx`, `Gebaeude3.tsx`, `Kulisse3.tsx`, `palette.ts`, `seiten/Twin.tsx`, App-Zustand `twin`). Screenshot: `docs/design/entscheide/2026-11-12-redesign/ausgangslage-stash.png`. Nicht ungeprueft anwenden – dient als Ansatz A / Materialquelle.
- Tests zuletzt [F]: Web 55/55 (`cd app/web && npm test`), Backend 417/417 (`cd app && npm test`), Typpruefung und Build gruen. Docker-Suiten nicht gelaufen.
- Server des PO laeuft lokal auf Port 3000 (Wegwerfdaten) – **nicht anfassen**. Fuer Screenshots eigene Instanz Port 3100 (Werkzeug unten).

## 2. PO-Entscheide dieser Sitzung [F]

1. Hauptreferenz `docs/design/referenzen/01-dashboard.png`; Referenzen sind Qualitaetsrichtung, **keine Kopiervorlage** – eigenstaendige, hochwertige Ideen erwuenscht.
2. Weiss mit Grautoenen, nur ganz leichte Blauakzente; **KOO-Gewerkefarben stechen heraus, Heizung rot**.
3. Geschossfokus bleibt **hell**, Rest blasser. Keine dunklen Flaechen.
4. Umfang: Geschosse separieren + Dokumente-Platzhalter ja; 2D-Ansicht spaeter.
5. Vorgehen: Huelle parametrisch aus Daten, Anlagen als GLB aus Blender, Licht im Browser einmalig weich berechnet (drei AccumulativeShadows/Lightformer, N8AO).
6. **Kleine Designaenderungen selbst entscheiden, Richtungswechsel nur mit PO-Freigabe.**
7. **Redesign in uebersichtlichen Teilaufgaben** (Abschnitt 4), nach jeder Teilaufgabe Stand + Screenshots an den PO.
8. Visuelle Pruefung nur mit **echter GPU** (nicht SwiftShader), mehrere Ansichten, inkl. Funktion und Leistung.
9. Alle verbindlichen Geschmacksregeln: `docs/design/prinzipien.md` (19 Regeln; Aenderung nur mit PO-Bestaetigung).

## 3. Design-System (bitte so verwenden)

- **Ablauf:** `.claude/skills/planora-design/SKILL.md` – Einstufung klein / mittel / Richtungswechsel, Vollablauf, Dateihoheit, Lessons-Learned-Regel. Codex liest diese Datei als verbindliche Arbeitsanweisung.
- **Rollen:** `.claude/agents/art-director.md`, `3d-designer.md`, `ui-ux-designer.md`, `visual-critic.md`. Fuer Codex: die Rollen nacheinander einnehmen bzw. eigene Unteragenten mit diesen Rollentexten starten; Dateihoheit und "nie parallel an denselben Dateien" einhalten. Der Visual Critic muss unabhaengig sein (frischer Kontext, kein Vertrauen in Umsetzer-Berichte).
- **Skills/Leitfaeden** (Dateien lesen, falls keine Skill-Funktion): offizieller Frontend-Design-Skill `C:\Users\matta\.claude\plugins\marketplaces\claude-plugins-official\plugins\frontend-design\skills\frontend-design\SKILL.md`; weitere unter `C:\Users\matta\.claude\skills\` (`impeccable`, `soft-skill`, `taste-skill`, `emil-design-eng`, `apple-design`, `reference-look-calibration`, `blender-*`).
- **Bibliothek:** `docs/design/README.md` (Index), `prinzipien.md`, `designsystem.md` (gemeinsame Sprache UI + 3D), `referenzen/README.md`, `fehler.md` (F1–F7, nicht wiederholen), `lessons-learned.md`, `entscheide/`, `kritiken/`, `beispiele/`.
- **Werkzeug:** `werkzeug/design/README.md` – `bash werkzeug/design/instanz.sh start` (Port 3100), `node werkzeug/design/screenshot.mjs --szenario werkzeug/design/szenarien/<x>.json --aus <ordner>`, `bash werkzeug/design/instanz.sh stop`. Getestet [F]: RTX 3070 Ti / D3D11, 60 fps am bisherigen Entwurf. Szenario `twin.json` setzt den Knopf "Digital Twin" voraus (existiert erst nach Teilaufgabe 3).

## 4. Teilaufgaben (vom PO so bestaetigt)

| # | Teilaufgabe | Ergebnis an PO | Status |
|---|---|---|---|
| 1 | **Richtung waehlen:** Art Director entwirft 2–3 Gesamtansaetze (Szene + Dashboard) als Bilder | PO waehlt Ansatz | Entwuerfe durch Codex erstellt; **PO-Wahl offen** – siehe Entscheiddatei |
| 2 | Designsystem als Code: Tokens `app/web/src/design/tokens.ts` fuer UI und 3D | kurze Token-Uebersicht | offen |
| 3 | Gebaeude-Szene: Huelle, Licht, Schatten, Kulisse, Kamera | Screenshots -> **Abnahme 1** | offen (Plan Schritt 1, Tasks 3–4; Stash als Material) |
| 4 | Anlagen als GLB (Blender), Leitungen mit Boegen | Screenshots Technikansicht | offen |
| 5 | Dashboard-Rahmen: Kopfzeile, Pill-Navigation, Kartenlayout | Screenshots | offen |
| 6 | Karten mit Daten: Gebaeude, Hinweise, Geschosse, Anlagen-Tabelle, Anlagenkarte | Screenshots -> **Abnahme 2** | offen |
| 7 | Interaktion: Hover, Fokus hell, Separieren, Tabelle <-> 3D, Kamerafahrten | Bildfolge | offen |
| 8 | Feinschliff, Leistung, Lizenz-Dossier, Doku | Abschlussbericht | offen |

Jede Teilaufgabe mit Visual-Critic-Pruefung. Nach jeder Teilaufgabe kurz an den PO berichten.

### Teilaufgabe 1 – konkret

Brief liegt bereit: `docs/design/entscheide/2026-11-12-redesign-brief.md`. Liefergegenstand: `docs/design/entscheide/2026-11-12-redesign-digital-twin.md` (Vorlage `entscheide/README.md`) und je Ansatz ein Bild `docs/design/entscheide/2026-11-12-redesign/ansatz-<x>.png` (HTML-Mockup 1440 x 900 mit Szenen-Illustration, z. B. Blender-Schnellrender ueber MCP oder Three.js-Einzeldatei; nur lokale Dateien). Angefangen: nur `docs/design/entscheide/2026-11-12-redesign/gemeinsam/icons.js`. PO-Erwartung sehr hoch ("deutlich hoehere Anforderungen an das Aussehen"): lieber zwei herausragende Ansaetze als drei mittelmaessige. Danach dem PO die Bilder zur Wahl vorlegen, Entscheid in der Entscheid-Datei festhalten.

## 5. Regeln und Stolpersteine

- Architektur, DB, APIs, Login, IDs und funktionierende Features nicht beschaedigen; alte Seiten `Ansicht` und `Entwurf` bleiben bis zur PO-Abnahme erreichbar.
- CSP `default-src 'self'; style-src 'self'` (`app/src/web.ts`): nichts von aussen laden; kein drei-`Environment`-Preset, kein Draco-CDN, kein drei-`Text` ohne lokale Schrift; drei `Stats` nicht verwenden (zweite three-Kopie).
- Tone-Mapping: ACES macht KOO-Rot lachsfarben (F3); Neutral bewaehrt.
- Embedded Postgres auf Windows: nach abgebrochenen Instanzen koennen verwaiste `postgres.exe --forkchild` den Port halten; `instanz.sh stop` raeumt sie auf. Port 54500/3000 gehoert dem PO.
- Commits: Deutsch, Muster `Redesign: ...`; nicht pushen ohne PO-Auftrag; `.superpowers/` nie committen.
- Offene Kleinpunkte aus Reviews (nicht blockierend): kulisse.ts Weg-L mit 1.5 m Luecke; Testschwaechen in kulisse/rahmen/kamera; degenerierte Bereiche ungeschuetzt; Composer-/Bundle-Groesse 1.2 MB.

## 6. Weitere offene Punkte (unveraendert aus CLAUDE.md)

CH-VM bestellen, SMTP, Lizenzfreigabe, Regelwerk-v1-Werte, M2a-Nachtraege – siehe `CLAUDE.md` Abschnitt 0b.
