# 0017 – KI-Kostenbremse und Schutzschalter

> **Status ab Welle 4: angepasst (E34–E37, 2026-11-09).**
> [A] Ab Stufe 4: Budget und Abschaltung je Instanz statt ueber Mandanten; direkte API (ADR 0030) und Interview-Verbrauch einbezogen.
> [A] Reservierungs-Reconciliation, Token-Maxima und ungewisse Abrechnung nach Absturz definieren; Schalter «KI aus» laesst keine neuen Aufrufe zu.
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: vorgeschlagen · 2026-11-08 · Bezug: NFR, E5, 02 Kap. 2.4

## Kontext
Erwartete Kosten ca. CHF 5–20 pro Gebaeude mit 500 Seiten (Sonnet 5.5), Erstbefuellung 100 Gebaeude CHF 800–1'200 [A auf F-Preisen, 02 Kap. 2.4]. Risiken: 2'000-Seiten-Uploads, Retry-Schleifen, Fehlbedienung, Missbrauch.

## Entscheid
- **Vorab-Schaetzung** je Seitenblock: Tokens = Seiten × (Text- + Bild-Tokens pro Seite) aus 02 Kap. 2.1/2.4 [F/A] → CHF via Preistabelle (Konfiguration, mit Quelle und Datum).
- **Reservierung vor dem Aufruf**: Der Worker reserviert den geschaetzten Betrag im Mandantenbudget (`ki_budget`: Monatslimit, verbraucht, reserviert) in einer Transaktion; reicht das Budget nicht, wird der Job `pausiert_budget` und der Mandanten-Admin informiert. Nach dem Aufruf wird mit den echten Tokens abgerechnet.
- Grenzen [A, Default, pro Mandant einstellbar]: Monatsbudget CHF 200; pro Dokument max. 600 Seiten fuer KI (darueber Rueckfrage: Seitenauswahl oder Freigabe); pro Vorgang Freigabe ab geschaetzt CHF 50.
- **Globale Bremse**: Tagesgrenze ueber alle Mandanten (Default CHF 300 [A]) und globaler Schalter "KI aus" (Feature-Flag in der DB, sofort wirksam).
- **Antwort-Cache**: Schluessel = SHA-256(Seiteninhalt-Hash + Prompt-Version + Modell-ID + Katalog-Version). Ein Retry nach einem DB-Fehler bezahlt nicht doppelt.
- **Schutzschalter (Circuit Breaker)** pro Provider: nach 5 Fehlern in 2 Minuten [A] offen fuer 5 Minuten; Jobs warten statt zu feuern.
- Batch-API fuer nicht dringende Erstbefuellung (−50 % [F, Q20-Tech]) [A: Verfuegbarkeit fuer Bedrock EU-Profil in Spike S5 pruefen].

## Alternativen
- Nur Monitoring ohne harte Grenze: eine Endlosschleife kostet bis zur Entdeckung.
- Pauschalpreis ohne Budget: Kostenrisiko bei Planora.

## Konsequenzen
- + Kosten pro Mandant transparent (Grundlage fuer Preisgestaltung).
- − Benutzer kann durch Budget blockiert werden → klare Meldung, Admin-Freigabe in der UI.
