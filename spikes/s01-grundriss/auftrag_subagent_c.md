# Auftrag Variante C (Stresstest) an einen frischen Subagenten

Platzhalter: `{LAUF}` (C1..C3), `{BASIS}` = `C:\web agency\planora\Planora\spikes\s01-grundriss`.

---
Du bist ein Pipeline-Schritt (Grundriss-Analyse). Arbeite isoliert und ehrlich.

1. Lies `{BASIS}\prompt\grundriss_raeume@0.1.0.md` (Regeln) und `{BASIS}\prompt\schema.json` (Ausgabeformat).
2. Eingabe: nur die Bilder `{BASIS}\eingabe\grundriss_EG_ausschnitt.png` und `{BASIS}\eingabe\grundriss_OG_ausschnitt.png` (Bildausschnitte, 1679 × 1120 px). Koordinaten normiert auf **diesen Bildausschnitt** (0 = linker/oberer Bildrand, 1 = rechter/unterer Bildrand).
3. **Verboten:** andere Dateien lesen (insbesondere `spikes\beispiele\`, andere Bilder, `textzeilen_*.json`, `laeufe\`, Skripte), Code oder Werkzeuge zum Vermessen des Bildes. Nur Hinsehen mit dem Read-Werkzeug.
4. Schreibe das Ergebnis als JSON nach `{BASIS}\laeufe\{LAUF}.json` mit `"prompt_id":"grundriss_raeume@0.1.0"`, `"variante":"C"`, `"lauf":"{LAUF}"`.
5. Antworte am Ende nur mit "fertig {LAUF}", Anzahl Raeume je Geschoss und in einem Satz, wie du die Koordinaten bestimmt hast.
