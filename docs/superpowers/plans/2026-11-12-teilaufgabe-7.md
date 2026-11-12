# Teilaufgabe 7 – Interaktionen fertigstellen und Restauflagen Szene

12.11.2026 · Einstufung mittel · Abnahme 1 und 2 freigegeben. Restauflagen aus `docs/abnahme/2026-11-12-anlagen/README.md`, `docs/design/kritiken/2026-11-12-anlagen-r3.md`, `docs/design/kritiken/2026-11-12-dashboard-r2.md`, `docs/design/kritiken/2026-11-12-redesign-szene-r2.md`.

## Codex – `app/web/src/szene3/**` (+ Tests)

1. **360°-Drehung und Achsengrenzen:** Schnitt (kameraseitige Fassaden) bei allen Azimuten korrekt, kein Flackern an den 45°-Grenzen (Hysterese [A]); Polarwinkel-Grenzen so, dass man nie unter die Platte oder senkrecht von oben ohne Tiefe schaut. Tests mit Winkeltabellen.
2. **UG:** Schnitt, Anlagen, Rohre und Separieren mit Testwelt mit UG (nur Tests, keine erfundenen Produktdaten).
3. **Reduzierte Bewegung:** `prefers-reduced-motion` überall: Kamerafahrten, Separieren, Hover-Anheben springen. Test.
4. **Schatten/Licht P2:** körnige Baum- und Bodenschatten beruhigen (mehr Akkumulationsframes oder grössere Filterweite; kein VSM, F8), sichtbarer weicher Bodenkontakt unter Geräten; Hintergrund normal/reduziert gleich hell (Tokens `grund`).
5. **Verteiler als Knoten:** Zuleitung an Verteilerbalken statt verdrehtem Kegelstück, Abgänge des Verteilers mit kurzen Leitungen zu den Raumleitungen, Reduzierung an Gerätestutzen, Wandhülse auf Zentraleseite.

## ui-ux-designer – `seiten/Twin*`, `ui/**`, `karten/Twin*`, `app/web/src/design/tokens.ts` (UI-Teil)

1. **Tastatur und Screenreader:** vollständiger Durchgang (Tab-Reihenfolge Kopfzeile → linke Karten → Szene → rechte Karten → Tabelle), sichtbare Fokusringe, `aria-live` für Auswahl («Heizungsverteiler gewählt»), Szene mit `aria-label` und Tastaturkürzeln (Pfeile drehen? nur wenn Szene3-Prop vorhanden – sonst Wunsch melden), Landmarken.
2. **Reduzierte Bewegung UI:** Panels blenden nur, keine Verschiebungen.
3. **Tokens:** Wünsche aus R2 übernehmen (Linktext `#4a7298`/Hover `#3b5f82`, Sekundärtext auf Kachel `#5e6b78`, auf Eisblau `#4f5c69`, Icon-Grund Heizung) und CSS-Variablen in `Twin.css` darauf umstellen; 3D-Werte nicht ändern.
4. Keine Szene-Dateien ändern.

## Hauptagent

GPU-Szenarien inkl. Drehung in Schritten (0/90/180/270°), reduziert, Tastatur; Kritik; Commit.
