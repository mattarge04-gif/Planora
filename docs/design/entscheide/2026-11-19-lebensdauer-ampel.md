# Lebensdauer/Ampel – Design-Entscheid (Stufe mittel)

19.11.2026, ui-ux-designer, Runde 1 (2D). Brief `.superpowers/sdd/2026-11-19-lebensdauer-ampel/design-brief.md`, Spec `docs/superpowers/specs/2026-11-19-lebensdauer-ampel-design.md` Abschnitt 6. Kein Richtungswechsel: Regeln 9, 10, 12, 17 aus `prinzipien.md` werden angewendet, nicht geändert.

## 1. Konflikt KOO-Rot vs. Status-Rot im Modus Erneuerung

**Entscheid:** Modus E ist eine *Zustandsansicht*. Solange er an ist, tritt die Gewerkefarbe zurück und nur die Ampel ist farbig:

1. Anlagen neutral (Gehäuse grau/weiss, KOO-Farbband und rote Anschlussstutzen entsättigt).
2. Leitungen gedimmt und entsättigt (wie das bestehende Dimmen fremder Leitungen bei Geräteauswahl, aber für alle Leitungen), damit kein rotes Rohr neben einer roten Ampel steht.
3. Ampelfarbe allein auf einem eigenen Ampelelement je Anlage, ungetönt (`toneMapped={false}`), damit `statusStoerung` `#d64541`, `statusWarnung` `#e08a1e`, `statusOk` `#2f9e6b` und `grau3` `#8a929e` im Bild exakt den UI-Farben entsprechen.
4. In der UI trägt jede Ampelstufe zusätzlich eine eigene Form (lucide: `OctagonAlert` = Ersetzen, `Clock` = Bald ersetzen, `CircleCheck` = In Ordnung, `CircleDashed` = Baujahr fehlt; `app/web/src/ui/Ampel.tsx`). Farbe ist nie das einzige Merkmal (designsystem.md Abschnitt 1: Rot nie gleichzeitig KOO und Status ohne Icon).

**Begründung:** Im GPU-Bild (`docs/design/kritiken/2026-11-19-lebensdauer-ui/r3/modus-e-technik-1440x900.png`) ist die Zentrale ein Bündel roter Heizungsrohre; die 6-%-Hülle (BackSide, 1.06) geht darin unter, Rot "Ersetzen" ist von KOO-Rot nicht unterscheidbar. Neutralisieren statt Umfärben hält Regel 9 ausserhalb des Modus unangetastet und Regel 10 im Modus sauber: Rot bedeutet dort nur "Ersetzen". Der Modus ist ein bewusster Schalter (Pill mit Ampelzeichen, Taste E), der Wechsel ist also erwartet und umkehrbar.

**Verworfen:** (a) Ampel als Icon-Overlay in HTML über jeder Anlage – zu viele Marker bei 17+ Bauteilen, verdeckt die Szene (Regel 12); (b) Heizungs-KOO im Modus auf Blau umfärben – erfindet eine Gewerkefarbe, verletzt Regel 9.

## 2. Vorgabe für den 3d-designer (`app/web/src/szene3/**`)

- Bei gesetztem `ampel`-Prop (Modus E): Anlagenmaterial ohne KOO-Akzent (Farbband/Stutzen in `grau2`/`grau3`), Gehäuse wie `grau1`; Leitungen und Formstücke stark gedimmt (Arbeitswert Deckkraft 0.25–0.35 oder Mischung Richtung `grau2`), Rohrverdickung aus Distanz beibehalten.
- Ampelelement deutlich lesbar aus Gebäudedistanz (Lesson 12.11./15.11.: aus der Übersicht prüfen, nicht nur nah): kräftiger als die heutige 1.06-Hülle, z. B. Hülle 1.10–1.12 *und/oder* Bodenring/Sockelscheibe in Ampelfarbe; `toneMapped={false}`, keine Emission, die AO/Schatten überstrahlt.
- Hover/Auswahl (`eisAkzent`, 1.04) muss im Modus E erkennbar bleiben und darf die Ampel nicht ersetzen: Auswahl innen (1.04), Ampel aussen bzw. als Bodenring; beide zugleich sichtbar.
- Grau (Baujahr fehlt) muss sich vom neutralisierten Gehäuse abheben (Hülle `grau3` auf `grau1`-Gehäuse reicht nur knapp – im Bild prüfen; ggf. gestrichelter/gepunkteter Bodenring analog `CircleDashed`).
- Farbwerte ausschliesslich aus `AMPEL_FARBE` (`lebensdauer/ansicht.ts` → `TOKENS.farbe.status*`, `grau3`). Neue 3D-Arbeitswerte (Dimmung, Hüllenmass) als Tokens in `design/tokens.ts` ablegen.
- Pruefen mit `werkzeug/design/szenarien/lebensdauer.json` nach `node werkzeug/design/lebensdauer-daten.mjs` (Muster 6: rot 5, gelb 5, grün 5, grau 2).

## 3. 2D-Umsetzung Runde 1 (erledigt)

- **Pill:** "Erneuerung" steht als eigener Schalter neben dem Segment Übersicht/Technik (nicht darin), mit Mini-Ampel (grau aus, farbig an) und Ring statt dunkler Füllung – liest als An/Aus, nicht als dritte Ansicht. `aria-keyshortcuts="E"`.
- **Legende** links unter "Gebäude" (rechts bleibt Platz für Geschosse und Anlagenkarte; vorher schob die Legende die Karte aus dem Bild): Mengenband aus echten Zählern, 2×2-Zähler mit Ampelzeichen, Erklärung "Gezählt wird je Bauteil. Im Modell zeigt jede Anlage die Farbe ihres dringendsten Bauteils.", Kosten 5 Jahre mit Hinweis "Unvollständig, n Bauteile ohne Preis", Link zum Plan. Linke Spalte scrollt im Modus E.
- **Anlagenkarte:** Statuschip (Icon + Text, Text in dunkleren Statustönen ≥ 4.5:1: neue Tokens `status*Text`), je Bauteil eine Kachel mit Ersatzjahr/Restjahren und Kosten als Kennzahlen, Quellen neben dem Wert; "Preis erfassen" springt direkt ins Preisfeld.
- **Erneuerungsplan:** Kopf wie Twin (Marke, zentrierter Titel, CSV als Hauptknopf), Überblick (5-Jahres-Summe gross, Unvollständig-Hinweis, Ampelband und Zähler), Baujahr, Balken mit Betrag direkt über dem Balken und gestrichelter Kappe für Jahre mit fehlenden Preisen, Tabelle mit Ampelzeichen und Marke "eigen", Typwerte als Raster.
- **Bedienbarkeit:** Fokus nach Esc/Abbrechen/Speichern zurück auf "Bearbeiten"; Fokus auf erstes fehlerhaftes Feld (Karte, Baujahr, Typwerte); ohne Schreibrecht Text statt `disabled`-Felder; `aria-describedby` für Fehler im Plan; 409-Banner verschwindet nach erfolgreichem Speichern; "1 Jahr" Singular.

## 4. Runde 2 (2D, nach Kritik r1)

- **Ansicht und Erneuerung** (`app/web/src/seiten/ansichtModus.ts`, getestet): Erneuerung ist eine Ebene der Technikansicht. Einschalten aus der Übersicht wechselt in Technik, Ausschalten kehrt dorthin zurück; jeder Weg in die Übersicht (Pill, Esc, Pos1) beendet die Erneuerung mit sichtbarer Meldung. Pill und Taste E nutzen dieselbe Aktion; der Canvas behält nach E den Fokus.
- **Anlagenkarte passt ins Fenster:** Geschosse-Panel wird bei offener Karte zu einer Zeile (Geschoss-Chips), Kartenkopf fest, Inhalt scrollt, Speichern/Abbrechen kleben unten.
- **Datenklarheit:** Anlagentabelle zeigt im Modus E die Ampel statt Erfassungsstatus; Filterchip nennt Bauteile ohne Preis; Plan und Karte zeigen den Zustand mit seiner Wirkung ("Schlecht, 5 Jahre früher", aus Baujahr + Lebensdauer − Ersatzjahr abgeleitet); Preisfelder mit Tausendertrenner.

## Offen

- [?] PO-Sichtung; visual-critic nach der 3D-Runde.
- Ampelfarben der UI-Icons (Grundtöne) liegen für Orange/Grau unter 3:1 auf Weiss; zulässig, weil stets mit Text, aber bei der Kritik beachten.
