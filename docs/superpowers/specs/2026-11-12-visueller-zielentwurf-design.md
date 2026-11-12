# Visueller Zielentwurf (E40) – Design

Stand 12.11.2026. Grundlage: [visuelle Zielrichtung](../../design/2026-11-12-visuelle-zielrichtung.md), PO-Entscheid E40.
Kennzeichnung: [F] Fakt, [A] Annahme, [?] offene Frage.

## 1. Ziel und Abgrenzung

Ein lauffaehiger Prototyp im echten Frontend zeigt das vorhandene Beispielgebaeude im Ziel-Look: plastische Gebaeudeuebersicht (Referenz 2), Technikansicht als Fokusmodus (Referenz 3), schwebende Informationskarten (Referenz 1). Der PO nimmt den Look am Prototyp ab; danach ersetzt der Code die heutige Szene.

PO-Entscheide in dieser Sitzung [F]:

1. Form: Prototyp direkt in three.js, nicht Blender-Render oder HTML-Mockup.
2. Stimmung: Uebersicht hell; Technikansicht als Fokusmodus – Umgebung abgedunkelt/entsaettigt (Schieferblau-Grau), nicht dunkel wie Referenz 3.
3. Versorgungslinien: rechtwinklig entlang Boden/Waenden, als "schematischer Verlauf" gekennzeichnet.
4. Layout: 3D vollflaechig, schwebende Karten statt festem Seitenpanel.
5. Technik: alles prozedural mit Bordmitteln von `three`, keine neue Abhaengigkeit.
6. Farben nach KOO-Logik: Farbe = Gewerk, Heizung durchgehend rot (Abschnitt 4).

Nicht im Umfang: Explosionsansicht, Tabellenweg, Erfassung, Mobiliar, glTF-Bauteile aus Blender, weitere Gewerke, Leistungsstufen ueber den Schalter "reduziert" hinaus.

## 2. Leitplanken

- Die App hat keinen URL-Router, Seiten wechseln ueber den Zustand in `App.tsx` [F]. Neu: Zustand `{ art: "entwurf"; gebaeudeId; name }`, erreichbar ueber einen Knopf "Entwurf" in der Kopfzeile der bestehenden Ansicht. Die bestehende Ansicht bleibt bis zur Abnahme unveraendert, abgesehen von diesem Knopf.
- Neuer Code in eigenen Modulen (`app/web/src/szene2/`, `app/web/src/karten/`), damit er die alte Szene spaeter ersetzen kann.
- Keine neuen npm-Pakete; nur `three`, `@react-three/fiber`, React. Effekte aus `three/examples/jsm` (`RoomEnvironment`, `EffectComposer`, `GTAOPass`, `OutputPass`). Lizenz-Dossier, SBOM und CSP bleiben unveraendert.
- Keine Assets von aussen laden (CSP `default-src 'self'`).
- Datenquelle unveraendert: `GET /api/szene/gebaeude/:id/welt` und Katalog-Endpunkt. Kein Backend-Umbau.
- Alle Ableitungen deterministisch: gleiche Welt ergibt gleiches Bild.

## 3. Module

| Modul | Aufgabe | Art |
|---|---|---|
| `szene2/huelle.ts` | Welt -> Fassadenflaechen, Fensterraster, Deckenbaender, Attika, Dachaufbau, Grundplatte | reine Funktion, getestet |
| `szene2/leitungen.ts` | Symbole + `versorgt` -> rechtwinklige Linienzuege (Haupt-/Verteilleitung) | reine Funktion, getestet |
| `szene2/stimmung.ts` | Parametersaetze "hell" und "fokus", Interpolation fuer die Ueberblendung | reine Funktion, getestet |
| `szene2/farben.ts` | Gewerkefarben-Tabelle (vorerst nur Heizung) | Konstanten |
| `szene2/bauteile.tsx` | eine Form je Katalog-ID, Ersatzform Kasten | Komponente |
| `szene2/Welt3D.tsx` | Zusammenbau, Kamera, Licht, Nachbearbeitung, Picking, Geschoss-Ausblenden | Komponente |
| `karten/GebaeudeKarte.tsx` | Kennzahlen und Hinweise (links) | Komponente |
| `karten/BauteilKarte.tsx` | Karte am gewaehlten Bauteil (Name, Hersteller/Typ, Menge, Status, versorgte Einheiten) | Komponente |
| `karten/GeschossLeiste.tsx` | Geschosse + "Alle" (unten) | Komponente |
| `karten/Legende.tsx` | Haupt-/Verteilleitung, "schematischer Verlauf" | Komponente |
| `seiten/Entwurf.tsx` | Seite fuer den Zustand "entwurf", laedt Welt und Katalog (wie `Ansicht.tsx`) | Komponente |

Die Bauteilkarte wird per Projektion des 3D-Punkts in Bildschirmkoordinaten als HTML ueber dem Canvas positioniert (kein drei-`Html`).

## 4. Gestaltungsregeln

Alle Masse und Farbwerte [A]; Abstimmung am Bild in der Korrekturrunde.

### Huelle (Uebersicht)

- Fenster: Raster 1.5 m, Breite 1.2 m, Bruestung 0.9 m, Sturz 0.5 m unter Decke. Keine Fenster bei Fassaden < 2 m und vor Einheiten mit `art = "technik"`.
- Geschossdecken als feine, leicht vorstehende Baender an der Fassade.
- Attika 0.4 m. Schematischer Dachaufbau (Kasten mit Gitter) ueber der Technik-Einheit, falls vorhanden [A].
- Grundplatte 0.3 m hoch, ringsum 4 m groesser als der Grundriss.
- Material: weiss/hellgrau, matt; Fenster neutral blaugrau, leicht spiegelnd.
- Technik ist aussen nicht sichtbar; je Geschoss eine kleine Beschriftung neben der Fassade mit Anzahl Symbole.

### Technikansicht (Fokus)

- Auswahl eines Geschosses: hoehere Geschosse ausgeblendet, Aussenwaende des gewaehlten Geschosses auf Bruestungshoehe (0.9 m) geschnitten, tiefere Geschosse bleiben als Sockel sichtbar.
- Einheiten: Boden leicht abgestuft eingefaerbt, Trennwaende 1 m, Bezeichnung als flache Schrift auf dem Boden.
- Bauteilformen: Waermepumpe abgerundeter Kasten mit Lueftergitter; Kessel/Speicher Zylinder; Fernwaerme-Uebergabe flacher Kasten; Pumpe kleiner Zylinder; Verteiler Balken mit Stutzen; Heizkoerper flache Rippenplatte; FBH/TABS Schlangenmuster auf dem Boden der Einheit.
- Unbekannte Katalog-ID: Kasten in Geraetefarbe.

### Farben (KOO-Logik)

| Element | Farbe [A] |
|---|---|
| Geraete/Apparate Heizung | dumpfes Grau-Rot `#8a5450` |
| Leitungen Heizung | leuchtendes Rot `#ff3b30` |
| Hauptleitung Zentrale -> Verteiler | Rot, Rohrradius gross (z. B. 0.08 m) |
| Verteilung Verteiler -> Einheit | Rot, Rohrradius klein (z. B. 0.04 m) |
| FBH/TABS-Muster | Rot, geringe Deckkraft |
| Status "vorgeschlagen" | gleiche Farbe, halbtransparent, heller Umriss |
| Auswahl | Rot heller und staerker leuchtend, weisser Umriss; kein Gelb/Orange |

Unterscheidung Haupt-/Verteilleitung nur ueber Dicke. Rot ist ausschliesslich der Heizung vorbehalten. Weitere Gewerke folgen spaeter; deren KOO-Farben liefert der PO [?].

### Versorgungslinien

- Verteiler -> Einheit: aus `WeltSymbol.versorgt` [F]. Start am Verteiler, auf Bodenhoehe + 0.05 m, erst entlang x, dann entlang z zum Mittelpunkt der Einheit.
- Zentrale -> Verteiler: nicht gespeichert [F]. Annahme [A]: jeder Verteiler haengt an der Zentrale (erstes Zentrale-Symbol nach Schluessel). Senkrecht in einer Steigzone an der Zentrale-Position, dann rechtwinklig ueber den Boden des Verteiler-Geschosses. Gleiche Kennzeichnung "schematisch".
- Parallele Segmente mit gleicher Achse und Ueberlappung erhalten 0.15 m Versatz.
- Im Fokusmodus leuchten die Linien (emissiv). Bei Auswahl eines Bauteils werden dessen Linien hervorgehoben, die uebrigen abgeblasst.

### Stimmung

| Parameter | hell | fokus |
|---|---|---|
| Hintergrund | fast weiss | Schieferblau-Grau, mittelhell |
| Umgebungslicht | hoch | reduziert |
| Gebaeudematerial | weiss | leicht entsaettigt/abgedunkelt |
| Leitungen emissiv | aus | an |

Ueberblendung ca. 400 ms, linear interpoliert ueber `stimmung.ts`.

## 5. Interaktion

- Geschossleiste: Geschoss waehlt Fokusmodus fuer dieses Geschoss; "Alle" kehrt zur hellen Uebersicht zurueck.
- Klick auf Bauteil: Bauteilkarte daneben; Klick ins Leere schliesst sie.
- Kamera: Orbit wie heute; beim Geschosswechsel sanfte Fahrt auf das Geschoss.
- Schalter "reduziert": Ambient Occlusion und Schatten aus.

## 6. Randfaelle

- Keine Geschosse/kein Grundriss: nur Grundplatte, Gebaeudekarte meldet "Noch keine Huelle erfasst".
- Verteiler ohne `versorgt`: keine Verteilleitung; vorhandener Hinweis bleibt in der Gebaeudekarte.
- Keine Zentrale: keine Hauptleitung.
- WebGL nicht verfuegbar: Meldung mit Link zur bestehenden Ansicht.
- Fehler beim Laden: Meldung wie in der bestehenden Ansicht.

## 7. Leistung [A]

- Fenster und gleiche Bauteile instanziert (`InstancedMesh`).
- Ziel 60 fps auf einem ueblichen Buero-Laptop am Beispielgebaeude.
- Schalter "reduziert" als Grundlage spaeterer Leistungsstufen.

## 8. Pruefung

- vitest fuer `huelle` (Fensteranzahl je Fassade, keine Fenster vor Technik, leere Welt), `leitungen` (nur achsparallele Segmente, Versatz, Endpunkte, fehlende Zentrale, leeres `versorgt`), `stimmung` (Interpolation an 0, 0.5, 1).
- Bestehende Tests (`npm test` in `app/` und `app/web/`) und Typpruefungen bleiben gruen; Build gruen.
- Browser am Beispielgebaeude ueber `npm run entwicklung`: keine CSP-Verletzungen in der Konsole.
- Screenshots nach `docs/abnahme/2026-11-12-entwurf/` (oder Datum der Umsetzung): Uebersicht, Fokus EG, Fokus OG1, Verteiler gewaehlt, reduziert.
- PO-Abnahme mit einer gemeinsamen Korrekturrunde.

## 9. Aufwand

[A] ca. 1–1.5 PT fuer den Prototyp, innerhalb des Planungswerts +8 PT aus E40.
