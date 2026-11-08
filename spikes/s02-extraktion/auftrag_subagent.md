# Auftrag an einen frischen Subagenten (Abo-Modus, ersetzt den API-Aufruf)

Platzhalter: `{LAUF}` (E1, E2, E3), `{BASIS}` = `C:\web agency\planora\Planora\spikes\s02-extraktion`, `{DOK}` = `C:\web agency\planora\Planora\spikes\beispiele\lindenhof`.

---
Du bist ein Pipeline-Schritt (Element- und Kennwert-Extraktion). Arbeite isoliert und ehrlich.

1. Lies `{BASIS}\prompt\elemente_kennwerte@0.1.0.md` (Regeln), `{BASIS}\prompt\schema.json` (Ausgabe) und `{BASIS}\prompt\katalog.test.json` (erlaubte Katalog-IDs).
2. Eingabe: genau diese 11 PDFs, mit dem Read-Werkzeug gelesen (wie ein PDF im API-Aufruf):
   `{DOK}\01_Grundriss_EG.pdf`, `{DOK}\01_Grundriss_OG.pdf`, `{DOK}\02_Datenblatt_CO2-01.pdf`, `{DOK}\02_Datenblatt_HK-01.pdf`, `{DOK}\02_Datenblatt_HK-02.pdf`, `{DOK}\02_Datenblatt_LT-01.pdf`, `{DOK}\02_Datenblatt_LT-02.pdf`, `{DOK}\02_Datenblatt_MB-01.pdf`, `{DOK}\02_Datenblatt_P-01.pdf`, `{DOK}\02_Datenblatt_VAV-01.pdf`, `{DOK}\02_Datenblatt_WP-01.pdf`.
3. **Verboten:** jede andere Datei im Ordner `{DOK}` (CSV, JSON, LIESMICH, Gesamtunterlagen), andere Laeufe unter `laeufe\`, Auswerteskripte, Shell-Werkzeuge zur Textextraktion (pdftotext etc.). Nur Lesen mit dem Read-Werkzeug.
4. `dokument` = Dateiname ohne Pfad, z.B. `02_Datenblatt_LT-01.pdf`; `seite` = 1 bei einseitigen PDFs.
5. Schreibe das Ergebnis als JSON (UTF-8) nach `{BASIS}\laeufe\{LAUF}.json` mit `"prompt_id":"elemente_kennwerte@0.1.0"`, `"lauf":"{LAUF}"`, `"katalog_version":"test-0.1"`.
6. Antworte am Ende nur mit "fertig {LAUF}" und Anzahl Elementtypen / Elementzeilen.
