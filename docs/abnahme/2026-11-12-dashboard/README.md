# Abnahme 2 – Dashboard, Tabellenweg, Objektkarte

12.11.2026 · Teilaufgaben 5 und 6 · Richtung A.

**[F] PO-Abnahme 2 am 12.11.2026 freigegeben:** «passt wie gehts weiter» (nach Sichtung des Stands `f834639` auf dem eigenen Server).

## Ergebnis [F]

- Kopfzeile (Marke, Pills Übersicht/Technik, Gebäudewahl, Hinweisglocke, Profilmenü mit reduzierter Darstellung, alten Seiten, Abmelden).
- Karten Gebäude (Kennzahlen), Hinweise («Zum Ort»), Geschosse (Auge, Separieren), Anlagen-Tabelle mit Legende, Objektkarte am Objekt mit Verbindungslinie und Dokumente-Platzhalter.
- Auswahl Tabelle ↔ 3D beidseitig, Hover-Tooltip, Kamerafahrt zur Auswahl, Esc-Kette, Ortsziel mit Ring.
- Datenschicht `app/web/src/dashboard/` (Codex), Szene-Props (Codex), UI (ui-ux-designer).

## Bilder

- [Runde 1](r1/) → [Kritik R1](../../design/kritiken/2026-11-12-dashboard-r1.md) «verbessern»
- [Runde 2](r2/) → [Kritik R2](../../design/kritiken/2026-11-12-dashboard-r2.md) «bereit mit Restauflagen»
- [Runde 3](r3/) Restauflagen, [Runde 4](r4/) Szenenschnitt an Tabellenoberkante (endgültig)

## Prüfung [F]

Web 155/155, Typprüfung und Build grün. GPU RTX 3070 Ti / D3D11, 60 fps in 1280/1440/1920. Keine CSP-Verletzung; bekannte 401 vor Login, `THREE.Clock`, Shaderwarnungen X4000/X3595.

## Annahmen [A] (vom PO mit der Abnahme nicht einzeln bestätigt)

- Tabellenklick öffnet auch das Geschoss der Anlage; Tabelle sortiert Zentrale zuerst; Karte zeigt Bauteil-ID.
- «Technik» öffnet das Geschoss der Zentrale (tiefster Erzeuger).
- Bestätigungsquote zählt Bauteilzeilen; Hinweise ohne Status bleiben ohne Status (keine Filter-Chips).

## Offene Restauflagen → Teilaufgaben 7/8

Siehe Kritik R2 und [Abnahme Anlagen](../2026-11-12-anlagen/README.md): körnige Schatten, Hintergrund normal/reduziert, Verteiler als Knoten, Bodenkontakt unter Geräten, Token-Wünsche (Link-, Sekundärtextfarben), 360°-/Tastatur-/Reduced-Motion-Prüfung, Bundlegrösse, Lizenz-Dossier, alte Seiten entfernen.
