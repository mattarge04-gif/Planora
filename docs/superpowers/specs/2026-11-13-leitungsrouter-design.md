# Leitungsrouter – Design

13.11.2026 · Branch `m2c-interview` · PO-Entscheid im Chat: Ansatz C, alle Leitungen, ein Rohr endgueltig.

## 1. Problem [F]

- `szene3/netz.ts` `kantenNetz` fuehrt jede Hauptleitung einzeln nach fester Schablone (hoch auf Leitungsebene, Haken in z, rueber, runter). Kennt weder andere Leitungen noch Geraetekoerper. Folge: Schleifen ueber der Zentrale (`docs/abnahme/2026-11-12-gruppen/*-zentrale-*`).
- `szene3/gruppenNetz.ts` `strangBaum` zaehlt Konflikte und probiert Ausweichspuren, garantiert aber keine Kreuzungsfreiheit.
- Es gibt keine Pruefung, die ein unsauberes Ergebnis erkennt.

## 2. Ziel

Ein Router fuer **alle** Heizungsleitungen (Haupt- und Gruppenstraenge, alle Geschosse), der fuer **jede** Geraeteanordnung sauber fuehrt:

- keine Kreuzung, keine Beruehrung, keine Schleife, kein Rueckwaertslaufen,
- kein Rohr durch einen Geraetekoerper,
- nur 90°-Boegen, wenige Boegen, parallele Fuehrung mit gleichen Abstaenden,
- deterministisch (gleiche Welt -> gleiche Rohre).

Der Router **verschiebt keine Geraete**; er passt sich an jede Position an.

## 3. Nicht-Ziele

- Kein Vorlauf/Ruecklauf-Paar. Ein Rohr je Verbindung, endgueltig (PO). Keine Platzreserve fuer ein Paar.
- Keine hydraulische Berechnung, keine Dimensionierung; Radien bleiben `ROHR.haupt`/`ROHR.verteil`.
- Keine Aenderung an Topologie-Daten im Backend; Router arbeitet nur im Web auf der `Welt`.
- Flaechenleitungen (FBH-Kreise, `ROHR.flaeche`) bleiben wie heute.

## 4. Schnittstelle

Eingang wie heute `rohrnetz(welt, katalog, anschluesse)`, Ausgang unveraendert `Rohrstueck[]` (inkl. Adapter, `daten.gruppeId`, `frei`). `durchgaenge()`, Darstellung (`Technik3.tsx`), Gruppenhervorhebung und Karten bleiben unberuehrt. Zusaetzlich liefert der Router `befunde: Befund[]` aus dem Pruefer.

## 5. Bausteine (`app/web/src/szene3/router/`)

### 5.1 `topologie.ts` – Baum der Verbindungen
- Ableitung aus `verbindungen()` und `gruppenVerbindungen()`: Erzeuger -> Speicher -> Verteiler -> Gruppe -> Abgaben.
- Ergebnis ist ein **Baum** (jeder Knoten genau ein Vorgaenger). Doppelte oder zyklische Kanten werden verworfen und als Befund gemeldet. Damit sind Schleifen strukturell ausgeschlossen.
- Fehlende Geraete (kein Speicher etc.) werden uebersprungen wie heute.

### 5.2 `raum.ts` – Hinderniskarte je Geschoss
- Gesperrt: Geraetekoerper (Bounding Box aus Katalog/GLB-Massen + 0.05 m [A]), Decke, Boden, Aussenwaende.
- Innenwaende: passierbar mit hohen Kosten (erzeugt Huelse via `durchgaenge`).
- Frei: Steigzone (`welt.steigzone`), Leitungsebene unter der Decke (`deckenLauf`).
- Belegte Rohre werden laufend eingetragen (inkl. Achsabstand).

### 5.3 `trasse.ts` – Normalfall
- Je Raum mit >= 2 Anschluessen eine Trasse auf der Leitungsebene entlang der Wand, die die Anschluesse mit der kleinsten Summe senkrechter Abstaende erreicht [A]; Haupttrasse vom Zentraleraum zur Steigzone.
- Jeder Anschluss: senkrecht hoch (Adapter wie heute) bis Trassenhoehe, waagrecht quer zur Trasse auf seine Spur.
- Spurvergabe nach **Left-Edge** (Kanalverdrahtung): Intervalle der Verbindungen entlang der Trassenachse, sortiert nach linkem Ende; jede Verbindung erhaelt die niedrigste freie Spur. Quer-Stichleitungen werden so geordnet, dass sie keine fremde Spur kreuzen (Spurreihenfolge = Reihenfolge der Anschluesse quer zur Trasse). Spurabstand `SPUR` (0.18 m).
- Geschosswechsel nur in der Steigzone, je Strang eigene Spur (wie heute).

### 5.4 `wegsuche.ts` – Rueckfall
- Wenn eine Verbindung nicht auf eine Trasse passt (Geraet frei im Raum, Trasse blockiert): A* auf orthogonalem Raster 0.05 m [A] in der Hinderniskarte.
- Kosten: Laenge + 2 m je Bogen + 50 m je Kreuzung + Wanddurchbruch 5 m [A, an GPU-Bildern kalibrieren].
- Reihenfolge: Hauptleitungen, dann Gruppen absteigend nach Laenge, Gleichstand nach Schluessel.
- Bleibt ein Konflikt: betroffene Leitungen ausreissen und neu verlegen, hoechstens 3 Runden; danach Befund.
- Ergebnis wird mit `bereinigen()` auf Eckpunkte reduziert.

### 5.5 `pruefer.ts` – Garantie
Reine Funktion `pruefen(rohre, raum): Befund[]`. Regeln:
1. Achsabstand zweier fremder Rohre >= r1 + r2 + 0.04 m [A]; Ausnahme: echter T-Abzweig desselben Baums.
2. Kein Segment schneidet einen Geraetekoerper (ausser am eigenen Anschluss-Adapter).
3. Keine Selbstueberschneidung, kein 180°-Richtungswechsel.
4. Nur achsparallele Segmente (90°-Boegen).
5. Hoechstens 6 Boegen je Verbindung [A].
6. Keine Kante doppelt, Topologie ist Baum.

Befunde erscheinen im Panel "Hinweise" als "Leitungsführung unsauber" (UI-Text mit Umlauten), statt still ein schlechtes Bild zu zeigen.

## 6. Ablauf

```
welt -> topologie (Baum) -> raum (Hindernisse)
     -> trasse (Normalfall) -> wegsuche (Rest, Ausreissen) -> pruefer -> Rohrstueck[] + Befunde
```

`kantenNetz` und `strangBaum` werden nach Umstellung entfernt; `bereinigen`, `gruppenStock`, `ortVorBauteil`, `durchgaenge`, Adapter (`anschlussFuehrung`) bleiben.

## 7. Tests und Nachweis

- Einheitstests je Baustein (Left-Edge, A* mit Hindernissen, jede Pruefregel positiv/negativ).
- **Zufallstests:** 2000 Anordnungen je Lauf mit festem Startwert (Geraete beliebig in der Zentrale, 1–6 Gruppen, 1–4 Geschosse). Jede muss den Pruefer ohne Befund bestehen. Fehlschlag gibt Startwert aus.
- Alle 7 Muster: Pruefer ohne Befund; `npm run muster:welt` deterministisch.
- Laufzeit: Routing je Gebaeude < 50 ms im Browser [A].
- GPU-Bilder Zentrale + Geschosse aller Muster, `visual-critic`-Runde, danach PO-Sichtung (Ablauf `planora-design`).

## 8. Zwischenstaende

1. Pruefer + Zufallsgenerator zuerst (zeigt heutige Fehler messbar).
2. Topologie + Trasse fuer Zentrale -> Zwischenbild an PO (ca. 2 PT [A]).
3. Wegsuche + Ausreissen, Gruppenstraenge umstellen, alte Fuehrung entfernen.
4. GPU-Bilder, Kritik, PO-Sichtung.

Gesamt ca. 5–6 PT [A].

## 9. Annahmen / offen

- [A] Alle Zahlen (Raster, Kosten, Abstaende, max. Boegen, Sicherheitsabstand) sind Startwerte.
- [A] Trassenwand-Wahl nach Abstandssumme; kann bei L/U-Fluegeln an Bildern nachjustiert werden.
- [?] Darf ein Rohr unter der Decke ueber einem Geraet laufen, wenn genug Hoehe frei ist? Startannahme: ja, wenn Abstand zur Geraeteoberkante >= 0.15 m.
