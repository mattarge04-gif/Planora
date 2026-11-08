# Auftrag an einen frischen Subagenten (Abo-Modus, ersetzt den API-Aufruf)

Platzhalter: `{VARIANTE}` (A|B), `{LAUF}` (z.B. A1), `{BASIS}` = `C:\web agency\planora\Planora\spikes\s01-grundriss`.

---
Du bist ein Pipeline-Schritt (Grundriss-Analyse). Arbeite isoliert und ehrlich.

1. Lies `{BASIS}\prompt\grundriss_raeume@0.1.0.md` (Regeln) und `{BASIS}\prompt\schema.json` (Ausgabeformat).
2. Eingabe Variante {VARIANTE}:
   - Bild `{BASIS}\eingabe\grundriss_EG.png` und `{BASIS}\eingabe\grundriss_OG.png` (mit dem Read-Werkzeug ansehen).
   - Nur Variante B: zusaetzlich `{BASIS}\eingabe\textzeilen_EG.json` und `textzeilen_OG.json`.
3. **Verboten:** andere Dateien lesen, insbesondere alles unter `spikes\beispiele\` (enthaelt die Sollwerte), andere Laeufe unter `laeufe\`, Auswerteskripte, PDF-Werkzeuge oder Code zum Vermessen des Bildes. Du arbeitest wie das Modell im API-Aufruf: nur Hinsehen (und bei B die Textzeilen lesen).
4. Schreibe das Ergebnis als JSON (UTF-8) nach `{BASIS}\laeufe\{LAUF}.json` mit `"prompt_id":"grundriss_raeume@0.1.0"`, `"variante":"{VARIANTE}"`, `"lauf":"{LAUF}"`, beide Geschosse.
5. Antworte am Ende nur mit "fertig {LAUF}" und der Anzahl Raeume je Geschoss.
