# Teilaufgabe 4 – Anlagen (GLB) und Leitungen

12.11.2026 · Einstufung **mittel** (neue Anlagenmodelle im festgelegten Stil, `planora-design` Abschnitt 1). Richtung A und Abnahme 1 sind freigegeben; keine neue Richtungsfrage.

Grundlagen: Spec `docs/superpowers/specs/2026-11-12-redesign-digital-twin-design.md` Abschnitt 2 «Anlagen» und «Leitungen», `docs/design/prinzipien.md`, `docs/design/designsystem.md`, `docs/design/fehler.md`, Tokens `app/web/src/design/tokens.ts`. Referenz `docs/design/referenzen/03-technik.png` ist Qualitätsrichtung, keine Kopiervorlage.

## Arbeitsteilung (keine Überschneidung)

| Wer | Schreibt nur |
|---|---|
| **3d-designer** (Claude-Subagent): Modelle | `docs/design/modelle/**` (Blender-Python-Skripte, README), `app/web/public/modelle/**` (GLB) |
| **Codex** (Orca-Worker): Integration | `app/web/src/szene3/**` (neue Dateien Anlagen/Leitungen + Tests, Anbindung in `Szene3.tsx`), bei Bedarf `app/web/src/seiten/Twin.tsx` nur für Props, `werkzeug/design/szenarien/twin-technik.json` |
| **Hauptagent (Claude)** | dieses Dokument, Prüfung, GPU-Bilder, Kritikauftrag, `fehler.md`/`lessons-learned.md`, Commit |

Niemand committet ausser dem Hauptagenten. Keine Änderung an Backend, API, Datenmodell, IDs, `szene2/**` (nur lesen/importieren), `tokens.ts` (Änderungswunsch an den Hauptagenten melden).

## Modellvertrag (verbindlich für beide Seiten)

- **Dateien:** `app/web/public/modelle/<katalogId>.glb`, z. B. `heizung.waermepumpe.glb`. Im Browser: `/modelle/<katalogId>.glb` (CSP `self`, keine externen Ladevorgänge, kein Draco, kein Meshopt, keine Texturen).
- **Typen und Zielmasse [A]** (B × H × T in m, Grundfläche auf y = 0):
  | Katalog-ID | Form | Masse |
  |---|---|---|
  | `heizung.waermepumpe` | Innen-/Kompaktgerät, Lüftergitter vorn, Anschlüsse oben | 1.0 × 1.2 × 0.6 |
  | `heizung.gaskessel` | Wandnaher Standkessel, abgerundet | 0.6 × 1.6 × 0.6 |
  | `heizung.oelkessel` | Standkessel mit Brennerhaube vorn | 0.7 × 1.4 × 0.8 |
  | `heizung.fernwaerme_uebergabe` | Wandstation mit Gehäuse, Ventil-/Rohrgruppe darunter | 1.0 × 1.4 × 0.35 (Unterkante auf 0, Gehäuse oben) |
  | `heizung.speicher` | Zylinder mit Isolationsmantel, Kappe, Stutzen | Ø 0.9 × 1.8 |
  | `heizung.umwaelzpumpe` | Pumpe mit Motorkopf auf Rohrstück, kleiner Sockel | 0.35 × 0.45 × 0.3 |
  | `heizung.verteiler` | Verteilerbalken mit Abgängen, Ventilen, Konsole | 1.2 × 1.0 × 0.3 |
  | `heizung.heizkoerper` | Flachheizkörper mit Profilierung auf kurzen Füssen | 1.0 × 0.65 × 0.12 |
  | `heizung.fbh_kreis` | FBH-Verteilerschrank (Kasten mit Verteilerbalken sichtbar) | 0.6 × 0.8 × 0.15 |
  `heizung.tabs_feld` nutzt `heizung.fbh_kreis.glb` (Code-Zuordnung). Unbekannter Typ: neutraler abgerundeter Kasten 0.6³ im Code, keine Datei.
- **Ausrichtung:** glTF +Y oben, Vorderseite +Z, Ursprung Mitte Grundfläche, Meter, Massstab 1, Transformationen angewendet.
- **Materialien** (genau diese Namen, alle PBR, keine Texturen):
  - `gehaeuse` – weiss/silbergrau, roughness 0.5–0.6, metalness ≤ 0.1
  - `detail` – mittelgrau Metall (Stutzen, Füsse, Ventile), roughness 0.4–0.5, metalness ≤ 0.4
  - `dunkel` – sparsam für Lüftergitter/Display, nie dominant (Prinzip 11)
  - `koo` – Farbband/Anschlussstutzen des Gewerks. **Der Code ersetzt dessen Farbe zur Laufzeit** durch `TOKENS` KOO-Heizung (`#e5322d`, kalibriert unter Neutral-Tone-Mapping). Jede Datei hat mindestens ein sichtbares `koo`-Teil.
- **Anschlusspunkt:** leeres Objekt (Empty) `anschluss` an der Stelle, an der die Leitung andocken soll (Weltkoordinate relativ zum Ursprung). Fehlt es, nimmt der Code Mitte oben.
- **Umfang:** sichtbar weiche Kanten (Bevel 2–4 cm, nie kugelig), sinnvolles Detail (Lüfter, Anschlüsse, Typenschild als Relief), unter ca. 8 000 Dreiecke und 200 kB je Datei. Keine Fremd-Assets, keine generierten Modelle. Reproduzierbar per `blender --background --python`.

## Integrationsvertrag (Codex)

- Anlagen je `WeltSymbol` an `position` auf dem Geschossboden, echte `schluessel`/`bauteilIds` als `userData` am Objekt (für Auswahl in Teilaufgabe 7 und Tabelle in 6). Gleiche Typen geteilt/instanziert; Modelle einmal laden (`useGLTF` lokal, `preload`), fehlende Datei → Ersatzkasten ohne Absturz.
- Sichtbarkeit folgt dem Geschossschnitt (`schnitt.ts`): Anlagen höherer Geschosse ausblenden; Übersicht zeigt Anlagen nur, wo sie durch Hülle sichtbar wären (Hülle bleibt geschlossen – Anlagen in der Übersicht nicht durch Wände leuchten lassen).
- Leitungen: Verlauf aus `szene2/leitungen.ts` (rechtwinklig, schematisch) übernehmen, als Rohr mit runden Bögen (Biegeradius ≈ 2–3 × Rohrradius), Haupt dicker als Verteilung, KOO-Rot matt, Achse über dem Boden (Radius + Abstand). Hinweis «schematischer Verlauf» bleibt (Legende kommt in 5/6; bis dahin kleiner Text im Twin, falls ohne Dashboard nötig).
- FBH/TABS: zusätzlich dezentes Flächenmuster am Boden der versorgten Einheit (Prinzip: lesbar, nicht laut).
- Reduziert-Modus und Schatten-Neuaufbau beibehalten; Anlagen werfen Schatten nur im Normalmodus.
- Tests für reine Funktionen (Rohrpfad mit Bögen, Zuordnung Katalog → Modell, Sichtbarkeit je Schnitt). `npm.cmd` auf PowerShell.

## Prüfung (Hauptagent)

GPU-Bilder über `werkzeug/design/` (Port 3100/54600, PO-Port 3000/54500 nie anfassen): Übersicht, Technikansicht EG (Zentrale), OG1, Nahaufnahme Zentrale, reduziert; 1440/1920/1280; fps beim Drehen; Konsole/CSP. Dann `visual-critic`, max. 3 Runden, danach Bilder an PO.
