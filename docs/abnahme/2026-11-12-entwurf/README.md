# Visueller Zielentwurf (E40) – Sichtpruefung 12.11.2026

Prototyp nach [Spec](../../superpowers/specs/2026-11-12-visueller-zielentwurf-design.md) auf Branch `m2b1-sichtbarer-schnitt`. Ansehen: `npm run entwicklung` in `app/`, Login mit dem Passwort aus der Konsole, Gebaeude oeffnen, Knopf "Entwurf".

**Keine visuelle Endabnahme bis PO-Korrekturrunde.**

## Screenshots (1440 x 900, lokale Demo mit Beispieldaten)

- [Uebersicht](uebersicht.png): helle, plastische Gebaeudeuebersicht mit Fensterbaendern, Schatten, AO und Geschossbeschriftung.
- [Fokus EG](fokus-eg.png): Schieferblau-Grau, Einheiten mit abgestuften Boeden, Zentrale, Verteiler, Leitungen und FBH-Muster in Rot.
- [Fokus OG1](fokus-og1.png): OG1 geschnitten, EG als abgeblendeter Sockel.
- [Verteiler gewaehlt](verteiler.png): Bauteilkarte mit "Versorgt: Restaurant (EG), Buero C (OG1)", Leitungen des Verteilers hervorgehoben.
- [Reduziert](reduziert.png): Uebersicht ohne AO und Schatten.

Vergleich mit [Referenz 2](../../design/referenzen/02-gebaeude.png) und [Referenz 3](../../design/referenzen/03-technik.png) [A]: Uebersicht hell und plastisch, aber weniger detailreich als die Referenz (ein Kubus, kein Umfeld). Fokus abgeblendet, nicht dunkel (PO-Entscheid). Leitungen klar rot.

## Feinabstimmung (3 Runden)

- [F] Tonwertabbildung von ACES auf `NeutralToneMapping`: ACES verschob das Rot der Leitungen nach Lachs/Orange und machte den hellen Hintergrund grau.
- [F] Schatten `percentage` statt `soft` (PCFSoftShadowMap gibt es in three 0.187 nicht mehr, Warnung entfaellt).
- [A] Sonne flacher und seitlicher, Umgebungslicht tiefer: Ostfassade sichtbar im Schatten, Schlagschatten auf der Grundplatte. GTAO-Radius 1.5 m.
- [A] Rohrradien 0.12 / 0.06 m (vorher 0.08 / 0.04), Leuchten 0.6, Auswahl +0.3, abgeblasste Leitungen Deckkraft 0.18, FBH-Muster Deckkraft 0.85.
- [A] Einheitenboeden blaugrau abgestuft, Raumbeschriftung dunkler und vom kameranahen Rand weg (war von der Trennwand verdeckt). Geschossbeschriftung groesser und rechts neben dem Gebaeude statt auf der Fassade.
- [A] Fokus-Hintergrund `#6f8096`, Umgebung im Fokus `#8995a3`.

## Pruefstand

- [F] Frontend: `npm test` 43/43 (6 Dateien), Typpruefung und Produktionsbuild gruen.
- [F] Backend: `npm test` 417/417 (45 Dateien), `npm run pruefe:typen` gruen. Docker-Suites nicht wiederholt.
- [F] CSP: Playwright mit `securitypolicyviolation`-Listener, keine Verletzung. Konsole: erwartetes 401 vor dem Login, Deprecation-Hinweis THREE.Clock, GPU-Stall-Hinweise des Software-Renderers.
- [A] Leistung: rund 4 fps waehrend 5 s Orbit-Drehung, gemessen mit `requestAnimationFrame`-Zaehler in Chromium mit SwiftShader (Software-Rendering ohne GPU). Nicht repraesentativ; Messung auf einem Buero-Laptop mit GPU steht aus (Ziel 60 fps).

## Offene Punkte fuer die PO-Korrekturrunde

- [?] Weisser Auswahl-Umriss: im Prototyp entfallen, Auswahl = staerker leuchtendes Rot. Beibehalten oder nachruesten?
- [A] Hauptleitung: jeder Verteiler haengt an der Zentrale (nicht gespeichert); Zentrale = erstes Erzeuger-Symbol (Waermepumpe, Gas-/Oelkessel, Fernwaerme-Uebergabe) nach Schluessel, sonst erstes Zentrale-Symbol.
- [A] Dachaufbau als schematischer Kasten ueber der Technik-Einheit.
- [A] Alle Masse und Farbwerte (Fenster, Rohrradien, Boeden, Stimmungen, Licht).
- [A] Alle Screenshots im Software-Rendering; auf echter GPU koennen Schatten/AO feiner wirken.
- [F] Im Beispiel haengen alle EG-Leitungen am Verteiler; das Abblassen nicht betroffener Leitungen ist darum in `verteiler.png` kaum sichtbar.
- [F] Die Bauteilkarte kann bei dieser Kamera die Zentrale verdecken.
- [?] Raumbeschriftung ist klein und kontrastarm.
- [A] Dachaufbau als einfacher Kasten statt "Kasten mit Gitter".
- [A] Gleiche Bauteile sind nicht instanziert (Abweichung zu Spec §7).
- [?] Auswahl eines Heizkoerpers/FBH blasst alle Leitungen ab (Leitungen enden an der Einheit).
- [?] Hauptleitung liegt teilweise im Boden (Rohrradius 0.12 m vs. 0.05 m Hoehe).
- [A] 60-fps-Ziel auf echtem Laptop ungeprueft.
