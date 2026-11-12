# Dokumentierte Gestaltungsfehler

Gescheiterte Ansaetze mit Beleg und Ursache. Neue Arbeiten pruefen sich gegen diese Liste. [F] Fakt, [A] Annahme.

## F1 – Schematische Quader mit Linien (M2b-1, 11./12.11.2026)

- Beleg: [../abnahme/2026-11-12-m2b1/uebersicht.png](../abnahme/2026-11-12-m2b1/uebersicht.png)
- Bild: transparente Rechtecke, Drahtgitterlinien, Zylinder-Pins, Canvas-Text.
- PO-Urteil [F]: wirkt wie Zeichnung, nicht wie 3D.
- Ursache: technischer Funktionsschnitt ohne Gestaltung; Linien statt Licht tragen die Form.
- Regel daraus: Form durch Volumen, Licht und Schatten; keine Linienzeichnung ([prinzipien.md](prinzipien.md) Nr. 4, 11).

## F2 – Prozedurale Kisten ohne Detail und mit schwachem Licht (Entwurf E40, 12.11.2026)

- Beleg: [../abnahme/2026-11-12-entwurf/uebersicht.png](../abnahme/2026-11-12-entwurf/uebersicht.png), [fokus-eg.png](../abnahme/2026-11-12-entwurf/fokus-eg.png)
- PO-Urteil [F]: "kein Leben, keine Farben, keine Schatten, fuehlt sich nicht 3D an"; "4 Ecken mit Linien und einfach Text".
- Ursachen:
  - Scharfkantige Boxen ohne Radien, keine Rahmen, keine Kulisse – zu wenig Detail fuer Wertigkeit.
  - Live-Licht ohne Umgebungslicht-Setup; AO kaum sichtbar; Schatten hart/schwach.
  - UI: Standard-HTML-Karten ohne gestaltete Typografie und Hierarchie.
  - Gestaltung durch Technik-Agenten ohne Design-Skills, ohne Ansaetze-Vergleich, ohne unabhaengige Kritik.
- Regel daraus: Designprozess `planora-design`; Detail und Licht vor Feinwerten.

## F3 – ACES-Tone-Mapping verfaelscht KOO-Rot (12.11.2026)

- Beleg: [../abnahme/2026-11-12-entwurf/README.md](../abnahme/2026-11-12-entwurf/README.md) (Runde 1), Zwischenstand Fokus-Screenshots.
- Bild: Heizungsleitungen lachsfarben statt rot; Hintergrund vergraut.
- Ursache [F]: ACESFilmic komprimiert gesaettigte Farben. Neutral-Tone-Mapping hielt das Rot.
- Regel: Tone-Mapping bewusst waehlen, Gewerkefarben im Screenshot pruefen.

## F4 – Beurteilung nur mit Software-Rendering (12.11.2026)

- Ursache [F]: Screenshots aus SwiftShader (ca. 4 fps, schwache AO/Schatten) – nicht repraesentativ; Probleme wurden spaet sichtbar.
- Regel: Screenshots nur mit echter GPU (`werkzeug/design/`), Renderer-Kennung belegen.

## F5 – Zu dunkler Fokusmodus (12.11.2026)

- Beleg: [../abnahme/2026-11-12-entwurf/fokus-eg.png](../abnahme/2026-11-12-entwurf/fokus-eg.png)
- PO-Entscheid [F]: Fokus bleibt hell, Rest blasser ([prinzipien.md](prinzipien.md) Nr. 7).

## F6 – Unlesbare Beschriftungen in der Szene (12.11.2026)

- Ursache [F]: Canvas-Sprite-Text zu klein, kontrastarm, in AO/Schatten abgedunkelt.
- Regel [A]: Beschriftungen als HTML-Overlay in der UI-Schrift ([designsystem.md](designsystem.md) Abschnitt 5).

## F7 – "ae" statt echter Umlaute in UI-Texten (12.11.2026)

- PO [F]: "nicht ae sondern ä". Regel: [prinzipien.md](prinzipien.md) Nr. 15.

## F8 – VSM und akkumulierte Schatten erzeugen graue Flächen (12.11.2026)

- Beleg: [Szene Runde 1](../abnahme/2026-11-12-redesign-szene/r1/uebersicht-1440x900.png), [korrigierte Runde 2](../abnahme/2026-11-12-redesign-szene/r2/uebersicht-1440x900.png).
- Bild [F]: grosse graue Quadrat-/Dreiecksausläufer neben der Modellplatte; im reduzierten Modus ohne Schatten verschwinden sie.
- Ursache [F]: Der installierte Three-VSM-Pfad behandelt auch `receiveShadow`-Objekte als Schattenwerfer. Dadurch kann die Empfängerebene von `AccumulativeShadows` selbst Schatten erzeugen. Im lokalen `WebGLShadowMap`-Code geprüft.
- Korrektur [F]: BasicShadowMap mit drei-PCSS (`SoftShadows`) für die Sonne, akkumulierte Schatten für weiche Kontakte; dieselben GPU-Ansichten erneut geprüft. Filterweite in Texeln und Lichtquellenradius in Metern sind getrennte Tokens.
