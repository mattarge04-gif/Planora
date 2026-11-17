# Abnahme «Heizungserfassung vereinfachen» – 17.11.2026

Kennzeichnung: [F] Fakt, [A] Annahme, [?] offen. Branch `m2c-interview`, Endstand `817ff91`. Kein Push, kein Merge.

## Ergebnis

- [F] **33 Klicks/Eingaben** für den Kunden beim Review-Gebäude statt rund 165 (−80 %). Ziel ≤ 40 erreicht. Details: [fm-review.md](fm-review.md), Bilder `fm-*.png`.
- [F] Twin nach Übernahme: 21 Einheiten, 8 FBH-Verteiler mit Namen «FBH-Verteiler» (Status vorgeschlagen), Heizkörper bestätigt. Assistent erneut geöffnet: Regelgeschoss samt Abweichung OG5 ist wieder da.
- [F] Prüfstand `817ff91`: Web 452/452, Typprüfung und Build grün. Backend 581/581 (auf `23398b9`; danach nur Web-Änderungen).
- [F] Bildkritik (visual-critic, echte GPU RTX 3070 Ti): Runde 1 «verbessern» (1×P1, 6×P2), Runde 2 «verbessern» (neu 1×P1, 1×P2). Beide P1 und alle P2 in zwei Designrunden behoben und per Code-Review bestätigt. Laut Skill keine dritte Kritikrunde; **PO-Sichtung steht aus**. Kritik: `docs/design/kritiken/2026-11-17-heizungserfassung.md`, Endbilder `vk3-*.png`.
- [F] Leistung: Assistent öffnet in ~340 ms, 60 fps bei 1280/1440/1920, keine CSP-Verletzung.

## Nachtrag E42 (17.11.2026, abends)

PO-Antworten: [E42](../../architektur/00-kontext.md). Umgesetzt in `55c48ef` (Backend) und `488cad2` (Web), Plan `docs/superpowers/plans/2026-11-17-automatik-merker.md`.

- [F] **Automatik nach dem Wiederöffnen behoben.** Die Merker der Automatik werden in `geschoss_vorlage.daten.automatik` gespeichert, auch bei Gebäuden ohne Regelgeschoss. Gemeint sind: Auto-FBH-Verteiler, Gruppenregeln mit angefasst/vorgeschlagen, abgewählte FBH-Verteiler und der Wärmezähler an allen Verteilern.
- [F] **Im Browser gemessen** (Testinstanz 3100, Playwright, Gebäude EG + OG1–OG3, FBH in OG2, übernommen): Gebäude wieder öffnen und in OG3 die Fussbodenheizung ergänzen braucht **5 Klicks statt 17**: Bearbeiten, Heizung, OG3 «Fussbodenheizung», Prüfen, Übernehmen. Es entstehen 4 FBH-Verteiler, alle an der Gruppe «Fussbodenheizung», alle mit Wärmezähler. Prüfen zeigt keine Verbraucher ohne Gruppe, und der Twin zeigt 0 Hinweise. Bilder: `e42-schritt5-nach-wiederoeffnen.png`, `e42-pruefen.png`.
- [F] **Prüfhinweis** `keine_abgaben`: Gibt es Einheiten, aber keine Heizkörper, keine FBH und kein TABS, meldet Prüfen das und verweist auf Schritt 3.
- [A] Gebäude, die vor dieser Änderung übernommen wurden, haben keine Merker. Bei ihnen bleibt die Automatik aus, bis sie einmal mit eingeschalteter Automatik übernommen werden.
- [F] Prüfstand `488cad2`: Backend 585/585, Web 457/457, beide Typprüfungen und der Webbuild sind grün.

## Für den PO zu entscheiden (Stand vor E42; 1, 3, 4, 5 beantwortet)

1. **[?] Automatik nach dem ersten Übernehmen (kritisch laut FM-Review).** Wird ein gespeichertes Gebäude wieder geöffnet und z. B. FBH in OG3 ergänzt, entsteht kein FBH-Verteiler und die neuen Verbraucher gehören zu keiner Gruppe; Schritt 5 warnt nicht. Von Hand 17 statt 6 Klicks. Ursache: Plan-Annahme 5 (Automatik nur für neue/leere Gebäude), Gruppenregeln werden nicht gespeichert. Vorschlag: Gruppenregeln und FBH-Merker in `geschoss_vorlage` mitspeichern (Folgeauftrag, [A] ca. 1 Tag).
2. **[?] Sollen Kerne beheizt sein?** Vorläufig ja: Bei Geschoss-Wahl «Fussbodenheizung» behält der Kern seine Heizkörper (Hinweiszeile im Geschoss).
3. **[?] Standard beim Kunden:** Ein vom Betreiber angelegtes Gebäude öffnet beim Kunden mit «Weiss nicht» für alle Heizarten. Wer das übersieht, erfasst 0 Heizkörper; «Prüfen» warnt nicht. Vorschlag: Standard Heizkörper «Ja» vorbelegen oder Prüfhinweis.
4. **Plan-Annahmen 1–9** (`docs/superpowers/plans/2026-11-16-heizungserfassung.md`, Abschnitt «Entscheide») bestätigen, darunter Nummerierung «Büro 3.01», EG = 0, UG = U1.
5. Beschriftung «Standard (offen)» statt «Standard (Weiss nicht)» im Auswahlfeld (Platzgründe).

## Weitere Befunde (nicht behoben)

- Twin zeigt einen Hinweis als Rohcode «ohne_gruppe» statt Klartext (FM-Review, wichtig).
- Nach manueller Nachbesserung meldet der Twin «Leitungsführung unsauber» (19 Konflikte); im Hauptlauf 0. Router, ausserhalb dieses Umbaus.
- Offen aus der Kritik: Vorschau im Assistenten zeigt nur den Kubus (B15, 3d-designer), P3-Befunde N3/N4, Hinweise unter der Falz bei 1280.
- Code-Review, aufgeschoben: Technik-Einheit entsteht still beim Sprung zu Schritt 5; Twin nennt Hauptverteiler «Heizungsverteiler»; Ableitung O(n²) je Tastendruck (bei Review-Grösse unkritisch).
- Spec Abschnitt 8 (5 Befunde ausserhalb) unverändert offen.

## Bilder

| Präfix | Inhalt | im Repo |
|---|---|---|
| `fm-` | FM-Durchlauf je Schritt, Twin, Wiederöffnen | ja |
| `vk3-` | Endstand nach Designrunde 2 | ja |
| `vk-`, `vk2-` | Kritik Runde 1 und 2 | nein, lokal (Grösse) |
| `t9-`, `t10-`, `t11-`, `vk1-` | Zwischenstände der Umsetzung | nein, lokal |
