# 0003 – KI-Zugang AWS Bedrock eu-central-2 mit EU-Inferenzprofil

Status: vorgeschlagen · 2026-11-08 · Bezug: E4, E7, NFR "Datenstandort Schweiz", FA-12..FA-18, FA-37

> **Abweichung vom PO-Entscheid (teilweise):** E7 und die NFR fordern verwaltete Dienste und Datenstandort in der Schweiz. Fuer den **KI-Pfad** ist das nach heutigem Stand nicht erreichbar. Dokumentinhalte, die an die KI gehen, werden **in der EU** verarbeitet. Alle anderen Daten (Datenbank, Dokumente, Backups, Logs) bleiben in der Schweiz.

## Kontext
- Die Anthropic-API kennt nur `global` oder `us`, kein EU/CH [F, Q21-Tech].
- Bedrock in eu-central-2 (Zuerich) unterstuetzt die Profile "Global" und "EU", **nicht** "In-region only" [F, Q23-Tech]. Das EU-Profil routet u.a. nach Stockholm, Paris, Mailand, Spanien, Irland, Frankfurt, Zuerich; Prompts dort nur im Speicher, Logs in der Quellregion [F, Q24-Tech]; kein Operatorzugriff von Anthropic [F, Q23-Tech].
- EU/EWR-Staaten stehen in Anhang 1 DSV (angemessener Schutz) [A, juristisch zu bestaetigen; vgl. Q24-Domaene].
- Vertex AI: EU-Multi-Region zugesichert, Claude in `europe-west6` nicht bestaetigt [F/?, Q25-Tech].

## Entscheid
- Produktion: **AWS Bedrock, Konto in eu-central-2, EU-Inferenzprofil**. Modelle Claude Sonnet 5.5 (Auslesen) und Haiku 5.5 (Klassifikation, Spaltenzuordnung) [F, Q20/Q23-Tech]. Keine "Covered Models" (Fable), da nicht ZDR-faehig [F, Q22-Tech].
- KI-Zugriff nur ueber den Port `KiProvider` (Modul `extraktion`). Adapter: `bedrock` (Produktion), `anthropic` (nur Entwicklung mit synthetischen Daten), `vertex` (Reserve), `fake` (Tests, deterministische Antworten).
- **KI pro Mandant opt-in**: bei Mandantenanlage AUS. Einschalten nur durch Mandanten-Admin mit protokollierter Zustimmung zu "Verarbeitung in der EU" [A, sicherer Default].
- Modell-ID, Profil-ARN und Region sind Konfiguration, nicht Code. Ein Wechsel loest einen Golden-Set-Lauf aus (03 Kap. 5.8).
- Der Adapter sendet nur, wenn (a) KI fuer den Mandanten aktiv, (b) globaler KI-Schalter an, (c) Budget reserviert (ADR 0017). Jede Anfrage wird in `ki_aufruf` protokolliert, ohne Inhalt: Mandant, Dokument, Seiten, Modell, Tokens, Kosten, Profil, Dauer, Ergebnis.

## Alternativen
- Anthropic-API direkt: Verarbeitung `global`/`us` → fuer Kundendaten ausgeschlossen.
- Vertex EU-Multi-Region: gleichwertig, aber zweite Hyperscaler-Beziehung ohne Mehrwert. Bleibt Reserve-Adapter.
- Lokales Open-Source-VLM in CH: Datenstandort ideal, aber Qualitaet fuer Grundriss/Tabellen unbelegt und GPU-Betrieb fuer 1 Person nicht tragbar [A]. Option fuer V2/On-Prem.
- Keine KI: verletzt E3/E4. Bleibt als Betriebsmodus "KI aus" voll nutzbar (FA-37, FA-38).

## Konsequenzen
- + Beste belegte Datenzusage; Konto und Logs in CH.
- − Kunden mit "nur CH" lassen KI aus → manueller Pfad und Excel-Import muessen gleichwertig gut sein.
- − Zweiter Cloud-Vertrag (AWS) neben Exoscale; Subprozessorliste und Auftragsbearbeitungsvertrag anpassen.
- − Zielregionen des Profils koennen sich aendern [F, Q24-Tech] → monatliche automatische Pruefung per `aws bedrock get-inference-profile`, Alarm bei einer Region ausserhalb EU/EWR/CH.
- Spikes S5 (Verfuegbarkeit, Quoten, Latenz) und S6 (Kosten).
