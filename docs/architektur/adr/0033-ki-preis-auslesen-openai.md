# 0033 – Preis-Auslesen aus Dokumenten mit OpenAI gpt-6.2-sol

Status: akzeptiert (PO-Entscheid E45) · 2026-11-22 · Bezug: E36, E37, E43, E44, ADR 0030, ADR 0017, Spec `docs/superpowers/specs/2026-11-22-preis-aus-dokument-design.md`

> **Abweichung vom PO-Entscheid E36/E37 und von ADR 0030:** Dort laeuft KI ausschliesslich ueber die Claude API. Fuer das Preis-Auslesen aus Dokumenten entscheidet der PO am 22.11.2026 (roh: "nutze 6.2 sol von openai") fuer OpenAI. ADR 0030 bleibt fuer alle anderen KI-Funktionen (Interview, Suche) gueltig, bis der PO anders entscheidet.

## Kontext
[F] Preise je 1 Mio. Tokens (abgerufen 22.11.2026): OpenAI `gpt-6.2-sol` 2/10 USD; Claude Sonnet 5.5 2/10 USD (Anthropic-Preisliste 03.11.2026). Preislich gleichwertig.
[F] OpenAI bietet fuer `gpt-6.2-sol` US- und EU-Datenresidenz ("Europe (EEA + Switzerland)") mit 10 % Aufpreis; Zugang ueber OpenAI-Vertrieb ("Contact sales ... become eligible"). Die Claude API direkt dokumentiert nur `us`/`global` (ADR 0030).

## Entscheid
- Produktionsadapter `openai` (offizielles SDK, Responses API, strikte JSON-Schema-Ausgabe, `store: false`) hinter einem anbieterneutralen Port; Fake-Adapter fuer Tests.
- Modell per Konfiguration, Standard `gpt-6.2-sol`; Basis-URL konfigurierbar (EU-Endpunkt `eu.api.openai.com` fuer Kundenbetrieb).
- Weiterhin pro Instanz aus (Modul `preisdokument`), eigener Schluessel der Instanz als Secret, Kostenbremse nach ADR 0017.

## Alternativen
- Claude Sonnet 5.5 / Opus 5.5 (ADR 0030): gleicher Preis bzw. doppelt; vom PO nicht gewaehlt.
- Beide Anbieter im Messlauf: mehr Aufwand, vom PO nicht verlangt.

## Konsequenzen
- Positiv: moegliche EU-Verarbeitung inkl. Schweiz (Argument fuer Siemens) [?].
- Negativ: zweiter KI-Anbieter im Produkt (zwei Datenschutz-/Vertragspruefungen, sobald Claude fuer Interview kommt); `/v1/responses` speichert ohne `store: false` 30 Tage; Missbrauchs-Logs bis 30 Tage; ZDR nur mit OpenAI-Freigabe.
- [?] Siemens-Zustimmung zum Inhaltsabfluss an OpenAI; EU-Residenz-Zugang fuer das Planora-Konto; PDF-Eingabe fuer `gpt-6.2-sol` per Probeaufruf bestaetigen.
