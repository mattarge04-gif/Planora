# Planora: Kosten, Investition, Preise (Stand 2026-11-08)

Kennzeichnung: [F] Fakt mit Quelle, [A] Annahme/Schaetzung. Alle Betraege CHF, ohne MWST.

## 1. Investition bis Pilot (ca. 10 Monate)

### Externe Hilfe
Saetze: IT/Entwicklung CHF 130–180/h, UX CHF 120–160/h (Ratgeberwerte [F], magicheidi.ch); Security/Beratung CHF 200–400/h (Anbieter-Blog, [A]); 1 PT = 8 h.

| Rolle | PT | tief | hoch |
|---|---|---|---|
| UX/UI-Designer | 8–12 | 7'700 | 15'400 |
| Pentest (Firma) | 5–8 | 8'000 | 25'600 |
| Jurist Datenschutz | 2–4 | 4'000 | 12'800 |
| Code-Reviewer laufend | 20 | 20'800 | 28'800 |
| Three.js-Spezialist | 10–15 | 10'400 | 21'600 |
| 3D-Artist | 10–15 | 8'000 | 16'800 |
| DevOps | 5–8 | 5'200 | 11'500 |
| Doc-AI-Berater (optional) | 3–5 | 3'100 | 7'200 |
| Uebersetzung FR/IT | – | 2'000 | 4'000 |
| **Total extern** | | **≈ 69'000** | **≈ 144'000** |

### Weitere Investitionen [A]
| Posten | tief | hoch |
|---|---|---|
| Hosting Test/Staging 10 Mt (02-tech-recherche: Start CHF 300–400/Mt) | 2'000 | 4'000 |
| Tools (Claude Code, GitHub, Monitoring, Domain, E-Mail) 10 Mt | 2'000 | 4'000 |
| KI-API-Tests mit echten Unterlagen | 300 | 1'000 |
| Versicherung Berufshaftpflicht + Cyber (1. Jahr) | 2'000 | 5'000 |
| **Total** | **≈ 6'300** | **≈ 14'000** |

### Interne Arbeitszeit Matt [A]
~200 PT. Bei Lohnkosten inkl. Sozialabgaben ca. CHF 9'000–11'000/Mt → **≈ 90'000–110'000** fuer 10 Monate. Kein Cash-out, wenn Matt ohnehin angestellt ist, aber echter Aufwand.

### Summe
- **Cash-out (extern + Sachkosten): ≈ CHF 75'000–158'000**
- **Inkl. interner Zeit: ≈ CHF 165'000–268'000**

## 2. Laufende Kosten nach Go-live (pro Monat) [A, Hosting/KI aus 02-tech-recherche]

| Posten | Start (1–3 Kunden) | 20 Mandanten |
|---|---|---|
| Hosting Exoscale inkl. Backups | 325 | 915–1'275 |
| KI Betrieb (neue Dokumente, Suche) | 50–100 | 100–250 |
| Tools/Lizenzen | 150–300 | 300–500 |
| Code-Review/Security extern (2 PT/Mt) | 2'000–2'900 | 2'000–2'900 |
| Pentest jaehrlich, auf Mt verteilt | 700–2'100 | 700–2'100 |
| Versicherung, auf Mt verteilt | 170–420 | 250–500 |
| **Total ohne Loehne** | **≈ 3'400–6'100** | **≈ 4'300–7'500** |
| Matt (Weiterentwicklung + Support) | 9'000–11'000 | 9'000–11'000 + ev. 2. Person |

Einmalig pro neuem Gebaeude: KI-Erstbefuellung ca. CHF 8–12 (500 Seiten, Sonnet 5.5 via Bedrock EU) [A aus 02].

## 3. Preis fuer Kunden (Vorschlag) [A]

Keine oeffentlichen CH-Preise pro Gebaeude gefunden. Referenz: Planon Kernmodul geschaetzt USD 30–80k/Jahr (Quelle mit Interessenkonflikt, facilio.com); deutsche CAFM ab EUR 400/Mt (Concurrent User).

| Paket | Groesse (Richtwert) | Einrichtung einmalig | Abo pro Gebaeude/Jahr |
|---|---|---|---|
| S | bis 5'000 m² / 1'000 Elemente | 2'500 | 3'000 |
| M | bis 20'000 m² / 5'000 Elemente | 5'000 | 6'000 |
| L | darueber | ab 8'000 | ab 12'000 |
| Pilot | 1–2 Gebaeude, 12 Mt | – | 15'000–25'000 pauschal |

- Enterprise-Mindestvertrag: CHF 25'000/Jahr.
- Unbegrenzte Benutzer (wichtig fuer Enterprise-Einkauf).
- Zusatzmodule spaeter: Investitionsplan/Kosten (im Kundenauftrag), Stratus-Import, On-Premise, DWG.
- Einrichtung deckt KI-Erfassung + menschliche Pruefung; Arbeitszeit ist der eigentliche Kostentreiber, nicht die KI.

## 4. Break-even [A]

- Jahreskosten laufend inkl. Matt: ca. CHF 150'000–220'000.
- Bei Ø CHF 6'000 pro Gebaeude/Jahr: **≈ 25–37 Gebaeude** zum Decken der laufenden Kosten.
- Investition (Cash-out ≈ 75–158k) zusaetzlich zurueckverdienen: weitere ≈ 13–26 Gebaeude-Jahre.
- Beispiel: 40 Gebaeude im Abo (Mix S/M/L) ≈ CHF 240'000/Jahr + Einrichtungen.

## Quellen (Abruf 2026-11-08)
- Freelancer-Saetze CH: https://magicheidi.ch/de/hourly-rates , https://talentup.io/insights/de/contractors-benchmark-report/switzerland/
- Planon-Schaetzung: https://facilio.com/blog/planon-pricing/
- CAFM-Mietmodell DE: https://www.softguide.de/programm/atc-fm/vorschau
- Hosting- und KI-Kosten: docs/architektur/02-tech-recherche.md (Q1–Q40)
