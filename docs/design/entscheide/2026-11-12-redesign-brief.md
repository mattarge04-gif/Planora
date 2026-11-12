# Brief: Redesign Digital Twin (Szene + Dashboard) – Richtungswechsel

Datum 12.11.2026, vom Hauptagenten fuer den art-director. Einstufung: **Richtungswechsel** (PO-Freigabe vor Umsetzung).

## Ziel

Beim ersten Oeffnen soll Planora wie eine hochwertige Digital-Twin-Plattform fuer Gebaeudetechnik wirken, nicht wie ein technischer 3D-Prototyp. Entwickle 2–3 eigenstaendige Gesamtansaetze fuer **3D-Szene und Dashboard zusammen** (eine Designsprache), mit mindestens einem Ansatz, der ueber die Referenzen hinausgeht.

## Verbindlich

- `docs/design/prinzipien.md` (19 PO-Regeln: Weiss/Grau mit leichten Blauakzenten, KOO-Gewerkefarben stechen heraus – Heizung rot, hell auch im Fokus, isometrische Ortho-Kamera, weiche Schatten/AO, schwebende Panels, Inter, echte Umlaute, nur echte Daten, keine dunklen Flaechen/schwarzen Kanten).
- Spec mit bestaetigtem Umfang: `docs/superpowers/specs/2026-11-12-redesign-digital-twin-design.md` (Abschnitte 2–3: Huelle parametrisch aus Daten, Anlagen als GLB aus Blender, Kulisse, Fokus hell, Separieren, Kopfzeile mit Pill-Navigation, Karten Gebaeude/Hinweise/Geschosse/Anlagen-Tabelle, Anlagenkarte am Objekt mit Dokumente-Platzhalter). Dein Spielraum: **wie** das aussieht – Gestaltung, Komposition, Materialitaet, Licht, Detailsprache, Typo-Behandlung, Bewegung, eine Signatur-Idee. Umfang und Datenmodell bleiben.
- Gemeinsames Designsystem: `docs/design/designsystem.md` (Arbeitswerte [A], darfst du je Ansatz neu vorschlagen).

## Daten (echt, nichts erfinden)

Beispielgebaeude 30 x 15 m, 2 Geschosse (EG 3 m, OG1 3.5 m), 5 Einheiten (Buero A, Restaurant, Technik im EG; Buero C, Buero D im OG1), 8 Heizungs-Symbole (Waermepumpe, Speicher, Verteiler in Technik; Heizkoerper Buero A; FBH Restaurant, Buero C, Buero D), Verteiler versorgt Restaurant und Buero C; ein Hinweis "Buero D: Verteiler noch nicht erfasst". Status je Anlage: bestaetigt/vorgeschlagen. Katalog: 10 Heizungstypen (`app/src/welt/katalog.v1.ts`).

## Ausgangslage und Fehler

- `2026-11-12-redesign/ausgangslage-stash.png`: angefangene Diorama-Szene (Stash, nicht committet) – plastischer, aber leer, grau, wenig Detail, keine UI. Darf Ansatz A sein (weiterentwickelt).
- `2026-11-12-redesign/ausgangslage-entwurf-fokus.png`: abgelehnter Entwurf (dunkler Fokus, duenne Linien).
- `docs/design/fehler.md` F1–F7.

## Referenzen

`docs/design/referenzen/README.md` – 01-dashboard.png ist Hauptreferenz (Qualitaetsrichtung, keine Kopie).

## Liefergegenstand

`docs/design/entscheide/2026-11-12-redesign-digital-twin.md` nach Vorlage (`entscheide/README.md`), dazu je Ansatz **ein visueller Schnellentwurf**, damit der PO zwischen Bildern waehlt, nicht zwischen Texten: statisches HTML-Mockup des ganzen Bildschirms (1440 x 900) unter `docs/design/entscheide/2026-11-12-redesign/ansatz-<x>/` mit einer Szenen-Illustration (z. B. Blender-Schnellrender des Beispielgebaeudes im jeweiligen Look, oder SVG/CSS-Isometrie) plus darueberliegender UI, gerendert zu `ansatz-<x>.png` (Playwright mit echter GPU, siehe `werkzeug/design/README.md`; fuer statisches HTML genuegt `file://`). Nur lokale Dateien.

Pro Ansatz ausserdem: wie die Idee in Three.js/R3F umsetzbar ist (Licht, Material, Detail, Leistung) und grober Mehraufwand gegenueber dem Plan (8–12 PT [A]).
