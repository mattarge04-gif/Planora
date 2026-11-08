# S12 Preisquellen: automatisch aktualisierte Herstellerpreise Gebaeudetechnik Schweiz

Stand 2026-11-08 · Test-Architekt (Welle 3) · Desk-Recherche, kein Code.
Kennzeichnung: [F] belegt mit Quelle · [A] Annahme · [?] offen. Alle Quellen abgerufen am **2026-11-08**.

## Ziel

Pruefen, ob es mindestens 2 Quellen (Hersteller oder CH-Grosshandel) mit maschinenlesbarem Feed und **kommerziell fuer Planora nutzbarer Lizenz** gibt (Kriterium 03 Kap. 13.2, S12; Risiko R11; ADR 0018).

## Vorgehen

Websuche nach Datenaustausch-Angeboten von ELDAS, Elektro-Material (EM), Debrunner Acifer, Sanitas Troesch, (Meier) Tobler, IGH, ETIM Schweiz sowie zu BMEcat/Datanorm. Bewertet: Format, wer Zugang bekommt, ob Preise enthalten sind, ob Weitergabe/Nutzung in Drittsoftware geregelt ist.

## Ergebnis

| Quelle | Gewerk | Format / Kanal | Preise enthalten? | Zugang | Lizenz fuer Planora (SaaS, Weitergabe an Mandanten) |
|---|---|---|---|---|---|
| **ELDAS** (Genossenschaft der Schweizer Elektro-Grosshaendler, u.a. EM) | Elektro | EDA 2.0 (Excel mit ETIM-Merkmalen), EDA 1.1, BMEcat; Download "EDA komplett" inkl. Preisdaten, max. 10'000 Artikel je Datei [F, Q1, Q2] | ja, Preisdatei im eKatalog [F, Q3] | eKatalog nur fuer Mitglieder und vertraglich gebundene Lieferanten; Kunden sollen die Shops der Mitglieder nutzen; "interessierten Kunden" wird ein Auszug angeboten [F, Q1, Q3] | **[?] nicht geregelt/oeffentlich**; Anfrage noetig |
| **Elektro-Material AG** | Elektro | Artikel mit ELDAS-Nr. und EM-Nr. im Shop [F, Q4]; eigener Feed nicht gefunden | [?] | Kundenkonto | [?] |
| **IGH** (Interessengemeinschaft Haustechnik) | Sanitaer/Heizung | DataExpert / DataExpert-BIM Kataloge, Schnittstelle IGH451; Kataloge per IGH451.ch nach Excel konvertierbar [F, Q5, Q6] | ja, indirekt ueber Haendler-Kataloge (Netto-Preislisten) | Software-Anbieter werden nach Integrationstiefe A–C gefuehrt; IGH451-Betreuung CHF 250/Jahr fuer Mitglieder [F, Q7, Q8] | **[?]** Software-Partnerschaft moeglich, Nutzungsbedingungen nicht oeffentlich |
| **Debrunner Acifer** | Haustechnik, Wasser | EDI, OCI, **IGH-Kataloge**; Kunden importieren ihre **individuellen Nettopreislisten** in die Handwerkersoftware, automatische Aktualisierung bei Preisaenderung [F, Q9, Q10] | ja, **kundenspezifische Nettopreise** | Kunden (Installateure) | Daten gehoeren zum Kundenvertrag; Weitergabe an Dritte [?] |
| **Sanitas Troesch** | Sanitaer, Kueche | Sortiment im IGH-DataExpert-Format, IGH451-Schnittstelle, Onventis u.a. Beschaffungsplattformen [F, Q11] | ja (Profi-Preise) [A] | Profikunden | [?] |
| **Meier Tobler** (ehem. Tobler) | Heizung/Lueftung | Bewirbt IGH DataExpert im E-Shop [F, Q12]; oeffentliche Seite nur PDF-Kataloge [F, Q13] | [A] ja ueber IGH | Profikunden | [?] |
| Datanorm / BMEcat allgemein | alle | Standardformate fuer Stammdaten + Preise [F, Q14, Q15] | ja | je Lieferant | je Lieferant |
| **ETIM Schweiz** (Verein seit 2020, aus ELDAS und IGH) | alle | Klassifikation, Beratung [F, Q16] | nein (Klassifikation, keine Preise) | Mitglieder | – |

### Kernaussagen

1. **Maschinenlesbare Feeds existieren** [F]: Elektro ueber ELDAS (EDA 2.0/BMEcat), HLKS ueber IGH (DataExpert/IGH451). Damit ist das Format-Problem geloest; Adapter `eldas_eda` und `igh_dataexpert` sind technisch machbar.
2. **Es ist keine Quelle belegt, deren Lizenz die Nutzung in einer fremden SaaS fuer viele Mandanten erlaubt** [F: in keiner Quelle geregelt gefunden]. Die Daten sind fuer Grosshaendler-Kunden (Installateure) gedacht, oft als **kundenspezifische Nettopreise**.
3. **Grosshandelspreise ≠ Ersatzkosten** [A]: Ein FM braucht Ersatzkosten inkl. Demontage, Montage, Inbetriebnahme. Materialpreise sind ein Teil (fuer Leuchten gross, fuer Lueftungsgeraete eher klein). Auto-Update der Materialpreise loest E15 nur teilweise.
4. Zuordnung Artikel → Katalog-ID ueber ETIM-Klasse ist realistisch fuer Elektro (EDA 2.0 traegt ETIM) [A]; fuer HLKS unklar.

## Urteil gegen das Kriterium (03 Kap. 13.2, S12)

| Kriterium | Ergebnis | Urteil |
|---|---|---|
| ≥ 2 Quellen mit maschinenlesbarem Feed | ja (ELDAS, IGH-Kataloge von Debrunner Acifer/Sanitas Troesch) | erfuellt |
| … und kommerziell fuer Planora nutzbarer Lizenz | **keine belegt** | **nicht erfuellt** |
| Automatische Zuordnung ≥ 50 % der Katalogtypen | nicht pruefbar ohne Daten | offen |

**Gesamturteil S12: nicht bestanden (Stand Recherche).** Kein Beweis der Unmoeglichkeit, aber keine belegte Lizenz.

## Empfehlung

1. V1 wie ADR 0018: manuell + Import. **Zusaetzlich zwei Import-Formate** statt "Feed": ELDAS EDA 2.0 und IGH DataExpert (Excel-Export ueber IGH451.ch). Der **Mandant importiert seine eigenen** Lieferantenpreise; damit liegt die Lizenz beim Mandanten, nicht bei Planora.
2. Schriftliche Anfragen (Chef/Verkauf): ELDAS (Datenbankauszug fuer Software-Anbieter, Lizenz fuer SaaS), IGH (Software-Partnerschaft IGH451, Bedingungen), Debrunner Acifer und Sanitas Troesch (Weitergabe an FM-Software im Auftrag des Kunden).
3. Preis im Plan immer mit Preisjahr und Quelle anzeigen (bereits in 03 Kap. 13.1 R11 vorgesehen).

## Quellen (abgerufen 2026-11-08)

- Q1 ELDAS, Ueber uns: https://www.eldas.ch/de/ueber-uns/eldas
- Q2 ELDAS, Datenaustauschformat EDA 2.0: https://www.eldas.ch/de/news/258-eldas-datenaustauschformat-eda-2-0
- Q3 ELDAS, FAQ: https://www.eldas.ch/de/faq
- Q4 Elektro-Material, Shop (ELDAS-Katalog): https://www.elektro-material.ch/de/shop/alle-produkte/eldas-katalog/leiter/datenkabel/c/eldas-1373615262096
- Q5 IGH451.ch Handbuch: https://www.igh451.ch/help/de/index.htm
- Q6 IGH, Katalogkonverter: https://www.igh.ch/en/produkte/it-loesungen/katalogkonverter/
- Q7 IGH, Software-Anbieter: https://www.igh.ch/en/services/weitere-dienste/software-anbieter/
- Q8 IGH, Kosten fuer Mitglieder: https://www.igh.ch/en/services/kosten/kosten-fuer-igh-mitglieder-anbieter/
- Q9 Debrunner Acifer, IGH-Kataloge: https://www.d-a.ch/da/leistungen/digitaler-datenaustausch/igh-kataloge/
- Q10 Debrunner Acifer, Blog Nettopreise: https://www.d-a.ch/da/kunden-referenzen/aktuelles/blog/igh-kataloge-nettopreise.html
- Q11 Sanitas Troesch, Profibereich: https://www.sanitastroesch.ch/de/business/bad
- Q12 Meier Tobler E-Shop, Aktion IGH DataExpert: https://eshop.meiertobler.ch/shop/campaign?id=0000000146
- Q13 Tobler, Downloads: https://www.tobler-ag.com/de/service/downloads/
- Q14 BME, BMEcat: https://www.bme.de/services/bmecat/
- Q15 DATANORM.de: https://www.datanorm.de/
- Q16 technik-und-wissen.ch, ETIM Schweiz: https://technik-und-wissen.ch/produktdaten-strukturiert-zur-verfuegung-stellen.html
