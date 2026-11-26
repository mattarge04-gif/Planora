# Fahrplan Siemens-Demo (E47)

Stand 25.11.2026, PO-bestaetigt ("passt"). Ziel: Demo bei Siemens in 3–4 Wochen auf einem Online-Server. Massstab des PO: "es soll nichtmehr nach intern aussehen, keine zeichen fuer ai slop, also so interne notizen, es soll alles funktionieren, man sollte sich nicht da vorne bei der praesi blamieren".

| # | Teilaufgabe | PT [A] | Stand |
|---|---|---|---|
| 1 | Anlagenakte fertig: T8, T9, T10 Abnahme, Gesamtreview | 2.5 | T8 fertig (`4389208`, Kritik r3 bereit), T9 fertig (`4e781b8`, Kritik laeuft), T10 + Gesamtreview offen |
| 2 | Schlaue Suche + Ordner-Ablage (E48): Spec `docs/superpowers/specs/2026-11-26-suche-und-ablage-design.md`, Plan `docs/superpowers/plans/2026-11-26-suche-und-ablage.md` (10 Tasks) | 8 | Plan fertig, Umsetzung nach Fixwelle Anlagenakte |
| 3 | Preis aus Dokument mit echter KI (Schluessel, Probe, Messlauf, Abnahme) | 0.5 | wartet auf `OPENAI_API_KEY` |
| 4 | Bekannte sichtbare Maengel: Leitungsueberlappung Beimischschaltung/Sammelleitung, FBH ohne Hauptverteiler, Rohcode `ohne_gruppe` im Twin, Router-Konflikte nach Nachbesserung, neue Bauteiltypen ohne Position frei im Raum (T9), sichtbare Kann-Punkte aus Kritiken | 3 | offen |
| 5 | Aufraeumen "nicht intern": alle Seiten und Zustaende auf interne Hinweise, Annahme-Marker, rohe/englische Fehler, Test-Namen, Entwicklungselemente, leere Zustaende, Login/Titel/Favicon | 2 | offen |
| 6 | Demo-Gebaeude: realistisches Buerohaus, echt wirkende Datenblaetter (PDF), Preise, Baujahre; keine "Muster"/"Testgebaeude" | 1.5 | offen |
| 7 | Generalprobe: Drehbuch, unabhaengiger Pruefer als "Siemens-FM", 2 Probedurchlaeufe mit PO | 1.5 | offen |
| 8 | Server fuer wenige Tage (monatlich/stuendlich kuendbar), Installation, HTTPS/Domain, Konten, Entwicklungs-Login aus, lokaler Ersatz auf PO-Laptop. Vorher: `betrieb/compose.yaml` reicht `OPENAI_API_KEY`/`PLANORA_KI_*` nicht an `api` durch, `PLANORA_STUFE` steht auf 1 (Suche erst ab Stufe 3) | 2 | als letztes |
| 5b | Startseite neu (E49, Ansatz A Modellplatte, Login mit Kundennamen): Login + Gebaeudeliste mit Kennzahlen je Gebaeude (Ampel, faellige Kosten, Unterlagen, Silhouette), planora-design Vollablauf (art-director 2–3 Ansaetze, PO waehlt); dazu Restpunkte Kritik `docs/design/kritiken/2026-11-26-fixwelle-akte/r1/` (D4-Rest, D5 im Erneuerungsplan, Demodaten, 1280-Tabelle) | 3.75 | nach Suche |
| 9 | Puffer fuer Befunde der Generalprobe | 2 | – |
| | Total | ca. 27 | |

Kuerzen nur in dieser Reihenfolge: (1) T9-Modelle (erledigt), (2) Suche zuerst ohne KI-Antwort (−2 PT). Punkte 4–8 nicht kuerzen.

Arbeitsweise: Code nach Skill `ponytail`; Gestaltung ueber `planora-design`; kostenpflichtige Schritte einzeln mit PO-OK.
