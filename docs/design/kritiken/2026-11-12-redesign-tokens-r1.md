⚠ DEGRADED: single-context (Planora-Critic ohne weitere Subagenten; manuelle Prüfung vor Detector).

# Gemeinsame Design-Tokens – Kritik Runde 1

12.11.2026 · Basis-Commit `e9609128e3d4d3f94cbdc43819cdd9e2ead6b8bc`, lokale neue Tokenquelle · Teilaufgabe 2.

Geprüft: `app/web/src/design/tokens.ts`, importierende `docs/abnahme/2026-11-12-redesign-tokens/uebersicht.ts`, CSS und eigene lokale GPU-Aufnahmen bei **1440 × 900** und **1280 × 720**. Neue PO-Wahl A und heller geschossbezogener Schnitt in Entscheid/Prinzipien/Spec berücksichtigt.

Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002207) Direct3D11 vs_5_0 ps_5_0, D3D11)`.

Belege: [1440 × 900](2026-11-12-redesign-tokens-r1/tokens-1440x900.png), [1280 × 720](2026-11-12-redesign-tokens-r1/tokens-1280x720.png), [GPU-Bericht](2026-11-12-redesign-tokens-r1/bericht.json).

## Noten und Belege

| Kriterium | Note | Beleg |
|---|---:|---|
| Prinzipientreue / Palette | 5 | Quelle `farbe`: helle Weiss-/Graustufen, sparsame Eisakzente, Heizung exakt `#e5322d`. Farbfelder in beiden Bildern oben, Rot deutlich abgesetzt. Statuspalette als Muster ohne erfundene Betriebsdaten. |
| Lesbarkeit / Typografie | 4 | Inter, 12/13/15/22 px, Datentext `#64717f`; Dekorgrau ausdrücklich nicht für kleinen Datentext. Beide Aufnahmen vollständig lesbar; längere Schattenwerte brechen bei 1280 sinnvoll um. |
| Abstände / Übersicht | 4 | Beide Bilder: Palette und sechs Gruppen sauber getrennt, keine angeschnittenen Karten oder Überdeckungen. Dokumentationslayout, kein Produktlayout. |
| UI-/3D-Konsistenz | 4 | Eine importierbare Quelle; Einheiten Px/M/Ms klar. Panelradius12 px / Plattenradius0,05 m / Gerätradius0,03 m; matte Bauteile, seidigere Geräte, neutrales Tone-Mapping, Sonne225°/50° und sanfte Bewegungszeiten folgen dem Designsystem. |
| Räumlichkeit / Geometrie / Referenzniveau | n. p. | Keine Produkt- oder Materialszene vorhanden; numerische Vorgaben beweisen keinen späteren Look. Originalität ist für eine Tokenübersicht kein sinnvolles Qualitätsgate. |
| Funktion / Leistung | n. p. | Keine Produktinteraktionen oder Kamerabewegung geprüft, keine fps-/Ladezeit-Abnahme. |

## Messungen und technische Befunde

Beide Fenster mit eigener RTX-Aufnahme: **0 Konsolenfehler, 0 Warnungen**; fps-Listen leer. [Mechanischer Detector](2026-11-12-redesign-tokens-r1/detector.json): keine Befunde. Die Übersicht importiert die gemeinsame Quelle direkt; Farbwerte werden daraus in CSS-Variablen und Farbfelder übertragen. Kein getrennter Farbdatensatz in der Übersicht.

`kooHeizung` ist in der Quelle exakt `#e5322d`. Die Korrektheit der späteren roten 3D-Materialdarstellung unter Licht/Tone-Mapping ist damit noch nicht nachgewiesen. Paneldeckkraft/Blur und Materialwerte sind hier überwiegend Zahlenmuster; die weissen Dokumentationskarten sind kein Nachweis ihrer Wirkung über einer 3D-Szene.

## Top-3 für die spätere Anbindung, keine aktuelle Korrekturforderung

1. **3d-designer:** Licht-/Materialarbeitswerte an der echten Szene prüfen, KOO-Rot im GPU-Bild erhalten. Heller Schnitt folgt dem PO-Entscheid; aus den Tokens allein entsteht dieses Verhalten nicht.
2. **ui-ux-designer:** Bei der Anbindung Sekundärtext und feste Typografieskala verwenden; Dekorgrau für kleine Daten vermeiden. Paneldeckkraft und Weichzeichner mit tatsächlich dahinterliegenden Objekten prüfen.
3. **Hauptagent / Designer nacheinander:** UI und Szene aus dieser Quelle beziehen; bestehende Ansichten bei ihrer gezielten Umstellung prüfen. Keine vorzeitige Ablösung funktionierender Altansichten aus diesem Token-Schritt ableiten.

## Funktion und Leistung

Nur lokales Rendern der Dokumentationsübersicht bestätigt. Kein Produktserver gestartet oder berührt. Tokens sind noch nicht in die bestehenden Ansichten eingebunden. Keine Aussage zu Produktlook, Hover, Fokus, Esc, Objektankern, Kamerafit oder fps.

## Geschmacksurteile / Kandidaten für Lessons Learned

Subjektiv: Die Übersicht ist ruhig und zweckmässig; kein gestalterischer Korrekturbedarf für diesen Dokumentationsschritt. Keine neuen dauerhaften Regeln oder Lessons-Learned-Kandidaten.

## Gesamturteil: bereit

**Bereit als gemeinsame Tokenbasis für die gezielte UI-/3D-Anbindung.** Keine Korrekturrunde erforderlich. Keine Produktlook-, Funktions- oder Leistungsabnahme; diese folgt in den Szenen-/UI-Schritten.

Questions skipped: Kein offener Richtungsentscheid in diesem Token-Schritt.
