# 0030 – KI ueber die Claude API direkt (Stufe 4, pro Instanz aus)

Status: vorgeschlagen, ersetzt ADR 0003 · 2026-11-09 · Bezug: E36, E37, E26/E27, ADR 0017, `07-analyse-b2b.md` Kap. 2 (0003), Kap. 8 Punkt 5

> **Abweichung von der bisherigen NFR (teilweise):** Die NFR «Datenstandort Schweiz» gilt fuer DB, Dokumente und Backups weiter. Inhalte, die bei eingeschalteter KI an Claude gehen, werden nicht in CH/EU verarbeitet (siehe Kontext). Das bisherige EU-Bedrock-Versprechen (ADR 0003) entfaellt.

## Kontext
[F] E36: KI nur ueber die Claude API direkt (Anthropic), ersetzt Bedrock; App funktioniert ohne KI (Formular/Excel); KI pro Instanz abschaltbar; Embeddings fuer die Suche lokal. E37: Bedrock dauerhaft ersetzt.
[F] Die direkte API dokumentiert nur `us`/`global` fuer Inferenz und `us` fuer Workspace-Speicherung ([Datenregion](https://platform.claude.com/docs/en/manage-claude/data-residency)); Standardaufbewahrung bis 30 Tage mit Ausnahmen ([Retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)); Abruf jeweils 2026-11-09 (uebernommen aus 07 Kap. 8 Punkt 5).

## Entscheid
- **Ein Produktionsadapter** `anthropic-direkt` hinter dem bestehenden KI-Port plus **Fake-Adapter** fuer Tests; keine AWS-/Vertex-Adapter, kein IAM, keine Profil-ARNs.
- **Lieferstufe 4** [A, 07]: Claude-Interview (ADR 0026) und KI-Auslesen (ADR 0009). Stufen 2 und 3 laufen vollstaendig ohne API-Schluessel.
- **Pro Instanz standardmaessig aus:** KI ist ein Modul (ADR 0029). Einschalten nur durch Instanz-Admin mit dokumentierter Zustimmung des Kunden und eigenem API-Schluessel der Instanz (Ablage als Secret, ADR 0027). «KI aus» ergibt 0 neue externe Requests; nach Restore bleibt KI gesperrt, bis die Konfiguration geprueft ist.
- **Datenregion:** [A] Anfragen mit dokumentierter Region (`us` oder `global`); Wahl und Begruendung im Kundenvertrag. Keine Zusage CH/EU.
- **Kostenbremse ADR 0017 bleibt**, je Instanz statt je Mandant: Reservierung, Token-Maxima, Monatsbudget, Schalter an der Dispatch-Grenze.
- **Injection-Schutz** und Ausgabe nur gegen Katalog-IDs bleiben verbindlich (03 Kap. 5.5, 5.6).
- **Suche:** Volltext und lokale Semantik (Stufe 3) brauchen keinen Claude-Aufruf. [A] Embeddings lokal mit Open-Source-Modell (Kandidat `bge-m3`, Modell/Server/Lizenz/CPU-Last noch zu verifizieren, ADR 0023). Claude-Reranking/Antwort mit Quellen erst Stufe 4 [?, offene Frage in E37].

## Alternativen (verworfen, mit Grund)
- AWS Bedrock EU (ADR 0003), Vertex: durch E36/E37 dauerhaft ersetzt.
- Lokales generatives Modell: nicht beschlossen; ein lokales Embedding-Modell ist davon zu unterscheiden [A, 07 Kap. 3 Zeile 14].

## Konsequenzen
- Positiv: ein Anbieter, einfacher Adapter, App ohne KI voll nutzbar.
- Negativ: Inhaltsabfluss in die USA/global bei eingeschalteter KI; Kundenzustimmung noetig.
- [?] PO: Akzeptiert Siemens den direkten Inhaltsabfluss, unter welchen Vertrags-/Zustimmungsbedingungen, mit wessen API-Schluessel und welchen ZDR-/Loeschregeln (07 Kap. 8 Punkt 5)? Bis zur Klaerung bleibt KI aus.
- Folgearbeit: S5/S6 als direkte API-Gates in Stufe 4; echte API-Evaluation mit freigegebenen TGA-Daten (keine Abo-Ergebnisse als Nachweis, 07 Kap. 6); revDSG-Abschnitt (03 Kap. 9.7) neu.
