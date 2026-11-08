# 01 – Domaene: Fachliche Grundlage Planora

Stand: 2026-11-08 · Rolle: Domaenen-Analyst (Welle 1) · Basis: `00-kontext.md` (E1–E10 verbindlich)
Kennzeichnung: **[F]** Fakt mit Quelle `[Qn]` · **[A]** Annahme · **[?]** offene Frage fuer den Product Owner.
Alle Quellen am 2026-11-08 abgerufen (Liste am Ende).

---

## Zusammenfassung (10 Punkte)

1. **Phase 53 gehoert zur Realisierung, nicht zur Bewirtschaftung.** Planora setzt nach der Teilphase 53 "Inbetriebnahme, Abschluss" ein und lebt in Phase 6. [F, Q1, Q2]
2. **Die Uebergabe ist geregelt, aber heterogen.** Die KBOB-Richtlinie Bauwerksdokumentation fordert u.a. DWG, PDF, PDF/A, TIF, IFC, XLS, DOC und das native CAD-Format; definitive Dokumentation 60 Tage nach Abnahme. Gemischte Formate (E4) sind damit der Normalfall, nicht die Ausnahme. [F, Q3]
3. **Beste Richtwertquelle fuer die Schweiz: CRB-LCC-Kennwerte** (Nutzungsdauer min/mittel/max pro eBKP-H-Element, Gebaeudetechnik inkl. Gebaeudeautomation und Brandschutz). Neue Ausgabe "LCC-Leitfaden D/2026". [F, Q4, Q5]
4. **Lizenzrisiko:** CRB untersagt die gewerbliche Nutzung "in elektronisch lesbarer Form" ohne schriftliche Genehmigung. Die Paritaetische Lebensdauertabelle (HEV/MV) und VDI 2067 sind ebenfalls urheberrechtlich geschuetzt. Planora braucht entweder eine CRB-Lizenz oder eine **eigene Richtwerttabelle** mit Quellenverweis. [F, Q4, Q5, Q6, Q8] → [?] PO-1
5. **Klassifikation zweistufig:** eBKP-H (SN 506 511, Ausgabe 2020) als Gruppierung fuer Kosten und Investitionsplan; ETIM (ODC-BY, frei, CH-Uebersetzungen nur fuer Mitglieder) als Produktklasse fuer den Bauteil-Katalog. [F, Q7, Q9]
6. **Zustandsbewertung:** In der Schweiz verbreitet ist die IP-Bau-/Stratus-Linie (Portfolio-Ebene). Fuer Elemente gibt es die ZHAW-Methode (Zustandswert 1→0, progressive Alterung unter 0,4) und NEN 2767 (Noten 1–6). V1: einfache Zustandsklasse mit Faktor pro Mandant. [F, Q11, Q12, Q13]
7. **Die Marktluecke ist bestaetigt, aber schmal.** Planon, Archibus/Eptura und Spacewell haben Zustandsbewertung und Mehrjahresplanung. Stratus und immopac decken die Portfolio- und Finanzsicht ab. **Kein gefundener Anbieter liest Anlagedaten per KI aus Uebergabedokumenten** und baut daraus automatisch einen Element-Bestand mit Herkunftsnachweis. [F, Q14–Q19, Q21]
8. **Enterprise-Einkauf:** revDSG Art. 9 (Auftragsbearbeitung, Vertrag), Art. 16 (Ausland; USA seit 15.09.2024 nur fuer DPF-zertifizierte Firmen angemessen), ISO/IEC 27001:2022 (2013er-Zertifikate seit 31.10.2025 ungueltig), bei Banken/Versicherern als Eigentuemer zusaetzlich FINMA-RS 2018/3. [F, Q22–Q26]
9. **38 funktionale Anforderungen (FA-01 bis FA-38)** mit Abnahmekriterien abgeleitet, konsistent mit E1–E10 (keine Tickets, keine Sensorik, 3D nur darstellerisch).
10. **Wichtigste offene Fragen:** Lizenz der Lebensdauerwerte (PO-1), Zustandsskala (PO-4), Kostenbasis pro Elementtyp (PO-5), Pilotkunde und Musterdokumente (PO-8).

---

## 1. SIA-Phasenmodell, Uebergabe und Unterlagen

### 1.1 Einordnung im SIA-Phasenmodell

| Phase | Teilphase | Bedeutung fuer Planora | Beleg |
|---|---|---|---|
| 5 Realisierung | 51 Ausfuehrungsprojekt, 52 Ausfuehrung | Hier entsteht die Anlagedokumentation ("Anlagedokumentationen SIA-Phase 52") | [F, Q3] |
| 5 Realisierung | **53 Inbetriebnahme, Abschluss** | Ziel: "dass das Bauwerk uebernommen und in Betrieb genommen wird", Schlussabrechnung abgenommen, Maengel behoben. Hier wird die Dokumentation an den Betreiber uebergeben. **Eingangstor fuer Planora.** | [F, Q1, Q2] |
| 6 Bewirtschaftung | 61 ff. | "Objektdokumentation SIA-Phase 6", dient "der Planung und operativen Umsetzung der Bewirtschaftung". **Arbeitsraum von Planora.** | [F, Q3] |

- [F] Die Teilphase 53 ist in SIA 108 und SIA 112 geregelt und die letzte Teilphase eines Projekts. [Q2]
- [F] Die KBOB stellt Phase 6 als separate FM-Phase dar, angelehnt an das Prozess-/Leistungsmodell ProLeMo (CRB/IFMA). [Q10]
- [A] Die Teilphasen von Phase 6 lauten in SIA 112:2014 "61 Betrieb" und "62 Erhaltung". Eine Sekundaerquelle nennt abweichend "61 Betrieb, 62 Ueberwachung/Wartung, 63 Instandhaltung". Die Norm selbst war nicht frei einsehbar. → Fuer Planora nicht kritisch: Planora bedient die **Erhaltung / Instandsetzung / Erneuerung**, nicht den Betrieb (E10).
- [F] Begriffe nach SIA 469 (zitiert im CRB-LCC-Handbuch): *Instandhaltung* = Gebrauchstauglichkeit durch einfache, regelmaessige Massnahmen bewahren; *Instandsetzung* = Sicherheit und Gebrauchstauglichkeit fuer festgelegte Dauer wiederherstellen; *Erneuerung* = Bauwerk/Bauteil in einen mit dem Neubau vergleichbaren Zustand bringen. [Q4] → Planora-Kern = **Erneuerung** (und grosse Instandsetzung).

### 1.2 Was wird bei der Uebergabe geliefert?

Nach KBOB/IPB-Richtlinie Bauwerksdokumentation 2016 [F, Q3]:

- **Dokumentationsarten:** Projektdokumentation (PD, Phase 1–5), Objektdokumentation (OD, Phase 1–6). Darin die **Anlagedokumentation (OD-A)**: "Teil der Fachdokumentation, welche Anlagen und deren Funktionen und Wartung beschreibt". Verantwortlich bei Inbetriebnahme: Fachplaner, Hersteller, Objektmanager, Betreiber.
- **Dokumenttypen** gegliedert in vier Bereiche: Organisation/Administration (O), K (prozessorientiert), Konzepte und Beschriebe (B), Visualisierungen (V). Jeder Dokumenttyp hat einen Dokumenttypcode (DTC); Checklisten in Beilage 1.
- **Fachbereiche** nach eBKP-H-Hauptgruppe D, z.B. D01 Elektrotechnik, D02 Leit- und Kommunikationstechnik, D03 Sicherheitstechnik, D04 Brandschutztechnik.
- **Papier:** Anlagedokumentation 1-fach zusaetzlich zur digitalen Lieferung.
- **Fristen:** Phase 11–52: 30 Tage nach Phasenabschluss. **Phase 53: provisorische Dokumentation vor Beginn der Abnahme, definitive Dokumentation 60 Tage nach Abnahme.**
- **Aufbewahrung:** "bis Ersatz" des Bauwerk(teil)s, 12 Jahre oder 5 Jahre je nach Dokumentkategorie.

Typischer Inhalt der Anlagedokumentation Gebaeudetechnik [A, aus Praxis und 00-kontext, nicht einzeln belegt]:

| Unterlage | Typischer Inhalt fuer Planora | Typisches Format |
|---|---|---|
| Revisionsplaene (Grundrisse, Installationsplaene) | Geschosse, Raeume, Lage der Anlagen | PDF, DWG, selten IFC |
| Prinzipschemas | Anlagenaufbau, Komponenten mit Anlagekennzeichen | PDF (Vektor), teils Scan |
| Anlage-/Apparate-/Leuchten-/Geraetelisten | Element, Typ, Hersteller, Menge, Standort/Raum | XLS(X), PDF-Tabelle |
| Datenblaetter Hersteller | Typ, Leistung, teils Lebensdauer (z.B. L70/B50 bei Leuchten) | PDF |
| Betriebs- und Wartungsanleitungen | Wartungsintervalle, Ersatzteile | PDF |
| Abnahme-/Mess-/Inbetriebnahmeprotokolle | **Einbau-/Inbetriebnahmedatum** | PDF, oft Scan mit Unterschrift |
| Garantie-/Lieferantenlisten | Garantieende, Lieferant | XLS, PDF |

Erlaubte Formate laut KBOB [F, Q3]: DWG (Standard-Austausch), CADprop (natives Format, zweitletzte Version), PDF, PDF/A, TIF, IFC, XLS, DOC; Alternativen DXF, TIF, SAT, TXT, Papier.

**Folgerungen fuer Planora:**
- [A] Das **Einbaudatum** steht selten im Datenblatt, sondern in Abnahme-/Inbetriebnahmeprotokollen oder muss aus dem Uebergabedatum abgeleitet werden. → Fallback-Regel noetig (FA-16).
- [A] Ein Kunde mit KBOB-konformer Dokumentation liefert bereits eine Ablagestruktur (Fachbereich + Dokumenttypcode). Planora sollte diese Codes als Metadaten uebernehmen koennen.
- [F] Die Bauwerksdokumentation ist nach eBKP-H-Fachbereichen gegliedert [Q3]. → eBKP-H als Gliederung ist anschlussfaehig.

---

## 2. Lebensdauer-Normen und Richtwerte

### 2.1 Vergleich der Quellen

| Quelle | Herausgeber, Stand | Inhalt | Schluessel | Eignung fuer Planora | Lizenz |
|---|---|---|---|---|---|
| **CRB LCC-Handbuch 2012 / LCC-Leitfaden D/2026**, Anhang "Kennwerte zum Bauwerksunterhalt" | CRB mit IFMA Schweiz, KBOB, pom+, SVIT FM u.a. | Nutzungsdauer **min / mittel / max** pro eBKP-H-Element, plus Instandhaltung in % der Bauwerkskosten | eBKP-H | **Hoch.** Schweizer Konsens, Gebaeudetechnik detailliert (D1 Elektro bis D8), Gebaeudeautomation, Brandschutz | Gewerbliche Nutzung "in elektronisch lesbarer Form" nur mit schriftlicher CRB-Genehmigung |
| **Paritaetische Lebensdauertabelle** | HEV Schweiz + Mieterinnen- und Mieterverband | Lebensdauer pro Einrichtungsgegenstand (z.B. Heizkessel 20 J., Umwaelzpumpe 20 J., Bodenheizung 50 J.) | eigene Bezeichnung | **Mittel.** Mietrechtlich gepraegt, Wohnbau, ein Wert ohne Bandbreite | Verkauft in Broschuere und Online-Tool, kein freies PDF |
| **VDI 2067 Blatt 1** (2012-09) | VDI, Vertrieb DIN Media | Rechnerische Nutzungsdauer pro Anlagenkomponente | eigene Gliederung | **Mittel–hoch** fuer technische Tiefe; deutsche Quelle, nicht eBKP-H | Kostenpflichtig, urheberrechtlich geschuetzt |
| **SIA 480** (2016), **SIA 2047** (2015) | SIA | Lebensdauer fuer Wirtschaftlichkeitsrechnung bzw. energetische Erneuerung | SIA-eigene | **Mittel.** Werte nicht frei einsehbar; SIA 2032 eher fuer Amortisation | Kostenpflichtig |
| **Herstellerdatenblatt** | Hersteller | z.B. Leuchten L80/B10 50'000 h | Produkt | **Hoch fuer Einzelelement** (Rangfolge Platz 2 laut 00-kontext) | frei auslesbar |

Belege: CRB [F, Q4, Q5]; Paritaetische Tabelle [F, Q4, Q6]; VDI 2067 [F, Q8]; SIA 480 / 2047 / 2032 [F, Q20].

Beispiele aus CRB LCC-Handbuch 2012, Verzeichnis der Kennwerte [F, Q4; Spaltenzuordnung aus PDF-Textextraktion, vor Uebernahme gegen Original pruefen]:
- D2 Gebaeudeautomation: Teilelemente Managementebene, Automationsebene, Feldebene, Raumautomation, Automationsnetzwerk mit Nutzungsdauern im Bereich ca. 5–35 Jahre.
- D4 Technische Brandschutzanlage (Brandmeldeanlage, Gasmeldeanlage, Loeschanlagen, RWA): Bandbreiten ca. 10–50 Jahre.
- HEV/MV-Werte mit eBKP-H-Zuordnung: Heizkessel 20 J. (D 5.2), Umwaelzpumpe 20 J., Bodenheizung 50 J., Radiatoren 30–50 J., Lueftung 25 J., Thermostatventile 15 J.

### 2.2 Empfehlung

1. **Primaere Richtwertbasis: CRB-Kennwerte (min/mittel/max pro eBKP-H-Element).** Sie sind Schweizer Konsens, decken Gebaeudetechnik ab und liefern eine Bandbreite, die zur Zustandskorrektur passt. [F, Q4, Q5]
2. **Vor Nutzung: Lizenz bei CRB anfragen** (info@crb.ch). Die Copyright-Klausel im LCC-Leitfaden 2026 verbietet das Anbieten in elektronisch lesbarer Form ohne Genehmigung. [F, Q5] → [?] PO-1
3. **Fallback ohne Lizenz:** eigene Planora-Richtwerttabelle pro **Anlagetyp aus dem Bauteil-Katalog** (30–50 Typen, E8), vom Chef (FM-Fachwissen) festgelegt, mit Feld "Referenzquelle" als Textverweis (z.B. "vgl. CRB LCC 2026, D 5.2"). [A] Ein Verweis ohne Uebernahme der Tabelle ist rechtlich unkritischer; juristisch nicht geprueft.
4. **Mandanten-Override:** Enterprise-Kunden haben oft eigene Lebensdauertabellen (z.B. Kantone mit Stratus). Planora muss pro Mandant eine eigene Tabelle importieren koennen (FA-19). [A]
5. Rangfolge laut 00-kontext bleibt: **manuell > Herstellerdatenblatt > Richtwert**.

[A] Wichtig fuer die KI: Herstellerangaben sind oft **Betriebsstunden** (Leuchten, Ventilatoren) und keine Jahre. Umrechnung braucht Betriebsstunden pro Jahr pro Elementtyp/Raumnutzung (FA-17).

---

## 3. Klassifikation: eBKP-H und ETIM

### 3.1 eBKP-H (SN 506 511)

- [F] Elementbasierter Baukostenplan Hochbau, **Ausgabe 2020, 1. Auflage**; Hauptgruppe D "Technik Gebaeude" wurde "in Anlehnung an Norm SIA 411" neu gegliedert; Code-Format "X01.01 statt X 1.1". [Q7]
- [F] Vertrieb ueber CRB-Webshop (Papier, E-Book). CRB stellt Standards "als Daten fuer Software-Programme" bereit; Lizenzbedingungen fuer Softwarehersteller sind nicht oeffentlich. [Q7]
- [F] CRB bietet einen **Regelsatz eBKP-H (2020) – IFC4** als Excel-Tabelle (Mengen/Kosten aus dem Modell). [Q7]
- [F] Die Bauwerksdokumentation (KBOB) und die LCC-Kennwerte (CRB) sind nach eBKP-H gegliedert. [Q3, Q4, Q5]
- [F] Die ZHAW-Instandsetzungsmethodik waehlte bewusst eBKP-H statt der gewerkeorientierten BKP. [Q12]
- [F] Fuer andere als vereinbarte Nutzungen von CRB-Standards ist laut einer Lizenzvereinbarung von Holzbau Schweiz "die vorherige schriftliche Zustimmung des CRB" noetig, gegen Entgelt. [Q27] (Analogie, nicht eBKP-H-spezifisch)

**Eignung:** Gut als **Gruppierungs- und Kostenschluessel** (Investitionsplan nach Elementgruppen, Anschluss an Richtwerte und Kundenbudgets). Zu grob als Produkttyp: "Leuchte" ist ein Element, aber Pendelleuchte vs. Downlight vs. Notleuchte unterscheiden sich in Lebensdauer und Kosten. [A]

### 3.2 ETIM

- [F] Das ETIM-Klassifikationsmodell und ETIM MC stehen unter der **Open Data Commons Attribution License (ODC-BY 1.0)**: "free to use for everyone"; teilen, ableiten, anpassen erlaubt; **Namensnennung Pflicht**. [Q9]
- [F] **Nationale Uebersetzungen** koennen auf Mitglieder beschraenkt sein: Englisch (Master) offen fuer alle; **Deutsch (CH), Franzoesisch (CH), Italienisch (CH): "beliebige Mitgliedschaft"** noetig. [Q9]
- [F] ETIM ist produktorientiert (Elektro, Sanitaer/Heizung/Klima), gepflegt im Classification Management Tool (CMT), Zugang frei. [Q9, Q28]
- [F] ETIM moechte keine abgeleiteten "Dialekte" des Modells. [Q9] → Planora referenziert ETIM-Klassen-IDs, statt das Modell zu veraendern.

### 3.3 Empfehlung Schluesselmodell Bauteil-Katalog

| Ebene | Schluessel | Zweck |
|---|---|---|
| Gruppierung (Investitionsplan, Richtwert) | **eBKP-H-Element** (z.B. D 5.2) | Kosten- und Planungssicht, Anschluss Schweizer Praxis |
| Katalogtyp (3D-Modell .glb, Icon, Default-Lebensdauer) | **Planora-Katalog-ID** (eigene, stabil) | KI waehlt nur hieraus (E8) |
| Produktklasse (optional) | **ETIM-Klassen-ID** (EC…) | Interoperabilitaet mit Hersteller-/Grosshandelsdaten |

- [A] Mapping-Tabelle Katalog-ID → eBKP-H + ETIM wird einmalig gepflegt (30–50 Eintraege).
- [A] ETIM-Klassennamen auf Englisch speichern, deutsche Anzeige selbst pflegen, bis eine ETIM-Schweiz-Mitgliedschaft geklaert ist. → [?] PO-2

---

## 4. Konkurrenz und Marktluecke

### 4.1 Anbieteruebersicht

| Anbieter | Erneuerungs-/Investitionsplanung | Zustandsbewertung | KI-Auslesen von Dokumenten | 3D | Schweiz | Beleg |
|---|---|---|---|---|---|---|
| **Planon** (IWMS, NL) | Ersatzkosten pro Asset, Szenarien kurz-/langfristig | Ja, mobile Erfassung | Nicht gefunden | Nicht beschrieben | Nicht gefunden | [F, Q14] |
| **Archibus / Eptura** (US) | Capital Budgeting, Facility Condition Index, What-if-Szenarien | Eigenes Condition-Assessment-Modul (SaaS) | Nicht gefunden ("Eptura AI" nicht geprueft) | **Autodesk-BIM-Viewer** | FedRAMP genannt, CH nicht | [F, Q15, Q16] |
| **Spacewell** (Axxerion, BE/NL) | **MJOP ueber 10, 20, 50+ Jahre**, Szenarien | **NEN 2767, Noten 1–6**, Inspektions-App | KI fuer Energie/Belegung, **nicht fuer Dokumente** | 2D/3D-Grundrisse fuer Flaechen | Nicht gefunden; 1'400 Organisationen in NL/BE | [F, Q17] |
| **immopac** (CH) | Capex-Projekte, Budgeting/Forecasting, Asset-Strategie (Finanzsicht) | Nicht gefunden | "Data and document analysis" durch KI-Agenten (allgemein) | Nicht gefunden | **Private Cloud in der Schweiz**, ISO/ISAE | [F, Q18] |
| **Stratus** (Basler & Hofmann, CH) | Kurz- und langfristiger Investitionsbedarf, 10–20 Jahre | Baulicher Zustand **aus wenigen Stammdaten** (Portfolio-Ebene, Expertenwissen, Statistik) | Nicht gefunden | Nicht gefunden | **"70% of the cantons and major Swiss cities"** (Herstellerangabe) | [F, Q11, Q19] |
| **Fabasoft** | Kein FM-/CAFM-Produkt gefunden | – | – | – | – | [F, Q29] (keine Treffer) |

Weitere: pit-cup (DACH-CAFM, mit metamagix.ICRS fuer Asset/Portfolio) [F, Q30]; Siemens Swiss LCDM Hub (Digitaler Zwilling, Planung bis Betrieb) [F, Q30].

### 4.2 Stand KI-Dokumentauslesen im Markt

- [F] KI-gestuetzte COBie-Erzeugung **aus BIM-Modellen** ist etabliert; Auslesen von Anlagedaten **aus gescannten/unstrukturierten O&M-Unterlagen** ist ueberwiegend Forschung oder Herstellerversprechen. [Q21]
- [F] Forschungsprojekt FacilityQ (FFG, 2026–2027): transformerbasierte Klassifikation technischer Dokumente fuer FM. [Q31]
- [F] Die Nachdigitalisierung von Bestandsdokumenten in CAFM gilt als grosse Herausforderung wegen heterogener Formate. [Q31]

### 4.3 Wo genau ist die Luecke?

1. **Datenerfassung statt Datenverwaltung.** CAFM/IWMS setzen einen gepflegten Anlagebestand voraus; der muss heute manuell oder aus BIM/COBie kommen. Planora erzeugt ihn **aus den Uebergabedokumenten**, die der Kunde ohnehin hat. [A, gestuetzt auf Q14–Q21]
2. **Element-Ebene Gebaeudetechnik statt Portfolio-Ebene.** Stratus schaetzt den Zustand top-down aus wenigen Stammdaten; Planora rechnet bottom-up pro Element mit Herkunftsnachweis. [A, gestuetzt auf Q11, Q19]
3. **Nachvollziehbarkeit (Herkunft je Kennwert)** als Vertrauensbasis fuer Investitionsentscheide. In keinem Anbieterauftritt als Merkmal gefunden. [A]
4. **Schweiz-spezifisch:** eBKP-H, CRB-Richtwerte, Datenstandort CH. Die Grossen (Planon, Eptura, Spacewell) zeigen keine CH-Normen oder CH-Hosting auf den geprueften Seiten. [F, Q14–Q17]
5. **Leichtgewichtiges 3D ohne BIM.** BIM-Viewer setzen ein Modell voraus, das bei Bestandsbauten meist fehlt. [A]

**Risiko:** Die Grossen koennen KI-Extraktion nachruesten. Der Vorsprung liegt im Ablauf (Upload → Pruefen → Plan), nicht in einer einzelnen Technik. [A]

---

## 5. Enterprise-Einkaufsanforderungen (Schweiz)

### 5.1 Datenschutz (revDSG, SR 235.1, in Kraft seit 01.09.2023)

- [F] **Art. 9 DSG:** Bearbeitung "kann vertraglich oder durch die Gesetzgebung einem Auftragsbearbeiter uebertragen werden". Cloud-/SaaS-Anbieter sind in der Regel Auftragsbearbeiter. [Q22, Q23] → Planora braucht einen **Auftragsbearbeitungsvertrag (ADV/AVV)** als Standardvorlage.
- [F] **Art. 16 DSG:** Bekanntgabe ins Ausland nur bei angemessenem Schutz (Staat in **Anhang 1 DSV**) oder mit Garantien wie Standarddatenschutzklauseln. [Q24]
- [F] **USA:** seit **15.09.2024** in Anhang 1 DSV, aber nur fuer Unternehmen, die nach dem **Swiss-US Data Privacy Framework** zertifiziert sind. [Q25]
- [F] Restrisiko US CLOUD Act bei US-Anbietern wird in Schweizer Gutachten thematisiert. [Q23]
- [A] Planora bearbeitet ueberwiegend **technische Sachdaten**. Personendaten entstehen durch Benutzerkonten, Audit-Log ("bestaetigt von wem") und Namen in Dokumenten (Protokolle mit Unterschrift). revDSG ist damit anwendbar, aber das Risiko ist gering. Der Datenfluss zur KI (Dokumente an LLM-Anbieter) ist der heikelste Punkt (00-kontext: KI pro Mandant abschaltbar).

### 5.2 Informationssicherheit

- [F] **ISO/IEC 27001:2022:** Zertifikate nach Version 2013 sind seit **31.10.2025 ungueltig**; Neuzertifizierungen seit Mai 2024 nur nach 2022. [Q26]
- [A] Planora selbst wird anfangs kein ISO-Zertifikat haben. Glaubwuerdig ist: zertifizierte Schweizer Hoster (ISO 27001), dokumentierte Kontrollen nach Anhang A, Pentest-Bericht. → Architekt schaerft.
- [A] Typische Enterprise-Security-Frageboegen fragen nach: Datenstandort, Verschluesselung (at rest / in transit), Mandantentrennung, Backup/Restore (RPO/RTO), Zugriffskontrolle, SSO/MFA, Logging, Incident-Response, Subunternehmerliste, Loeschkonzept, Pentest. Kein einheitlicher Schweizer Standard gefunden.

### 5.3 Regulierte Kunden

- [F] **FINMA-RS 2018/3 "Outsourcing"** gilt fuer Banken, Wertpapierhaeuser, Versicherungen und ausgewaehlte Finanzinstitute; regelt Ueberwachung, Pruefrechte, Sicherheit, Geschaeftskontinuitaet, Sub-Outsourcing, Auslagerung ins Ausland. [Q32]
- [A] Versicherungen und Pensionskassen sind grosse Immobilieneigentuemer. Ob die Bewirtschaftungssoftware eine "wesentliche Funktion" im Sinn des RS ist, entscheidet der Kunde. Planora sollte Pruef- und Weisungsrechte vertraglich anbieten koennen.

### 5.4 Identitaet und Zugriff

- [A] SSO per **Microsoft Entra ID** (SAML 2.0 / OpenID Connect) ist bei Schweizer Grossunternehmen Standard; SCIM-Provisionierung wird oft gefragt. Rollen pro Mandant und Liegenschaft (00-kontext).

---

## 6. Zustandsbewertung und Restlebensdauer

### 6.1 Methoden

| Methode | Herkunft | Skala | Ebene | Bezug Restlebensdauer | Beleg |
|---|---|---|---|---|---|
| **IP-Bau / Schroeder** | Hochbauinspektor Kt. Zuerich (1989), Impulsprogramm IP-Bau (1990–1996) | Zustandsbewertung pro Bauteilgruppe | Gebaeude/Portfolio | "bilden bis heute die methodische Grundlage zur Planung von Instandsetzungen" | [F, Q12] |
| **Stratus** | Basler & Hofmann, mit Kt. Zuerich entwickelt | proprietaer | Portfolio, wenige Stammdaten | Investitionsbedarf kurz- und langfristig | [F, Q11, Q19] |
| **DUEGA, EPIQR** | Weiterentwicklungen von IP-Bau / MERIP | – | EPIQR "fuer Wohnbauten praedestiniert" | – | [F, Q12, Q33] |
| **ZHAW-Methode** (Hubbuch/Paganini 2015) | ZHAW IFM, Spitalbauten | **10-teilige Skala, Zustandswert 1 (neu) → 0** | Element nach eBKP-H | Alterung **linear bis 0,4, darunter progressiv**; Nutzungsgrenze 0,1–0,4 je Anforderung; Kurve wird durch Inspektion angepasst | [F, Q12] |
| **NEN 2767** | Niederlande | **Noten 1 (wie neu) – 6 (sehr schlecht)** aus Schwere × Umfang × Intensitaet | Bauteil | Speist Mehrjahresplan (MJOP) | [F, Q34] |
| **Archibus FCI** | US | Facility Condition Index | Gebaeude | Maengel mit Kosten → Priorisierung | [F, Q15] |

Kernbefunde ZHAW-Methode [F, Q12]:
- Erste Inspektion **5 Jahre vor der minimalen Lebenserwartung**; naechste 5 Jahre vor dem berechneten Instandsetzungszeitpunkt → **2–3 Inspektionen pro Lebensdauer**.
- Lebensdauer-Bandbreite min/mittel/max aus den **CRB-LCC-Publikationen**.
- Bei unbekanntem Baujahr: Kurvenschar durch den aktuellen Zustand legen (Ansatz 2).
- Praxistest: 62 Bauteile eines Spitals in einem Arbeitstag, Standardabweichung der Zustandswerte zwischen vier Bewertern knapp 0,05.
- Lineare Alterung (wie in der Anlagebuchhaltung) ist "nicht realistisch".

### 6.2 Empfehlung fuer V1

- [A] **Zustandsklasse 1–5** pro Element (1 = neuwertig, 5 = Ersatz sofort), mit kurzer Beschreibung pro Klasse. Einfacher vor Ort als 10 Stufen. Mapping auf Zustandswert z (1→1,0; 2→0,75; 3→0,5; 4→0,25; 5→0,0) erlaubt spaeter das ZHAW-Modell.
- [A] **V1-Rechenregel** (konsistent mit 00-kontext "Zustandsfaktor pro Mandant"):
  - Ohne Bewertung: `Ersatzjahr = Einbaujahr + Lebensdauer`.
  - Mit Bewertung im Jahr t: `Restlebensdauer = Lebensdauer × Faktor(Klasse) − (t − Einbaujahr)`, mindestens 0. Die Faktor-Tabelle ist pro Mandant einstellbar (Default z.B. 1: 1,2 / 2: 1,0 / 3: 0,8 / 4: 0,6 / 5: 0).
  - Alternative Regel: Restlebensdauer direkt aus z und der Bandbreite min/max (ZHAW-nah). → [?] PO-4
- [A] Jede Bewertung speichert Datum, Person, Klasse, Notiz, Foto (optional) und ist historisiert (Audit).
- [A] Planora kann den **naechsten sinnvollen Bewertungszeitpunkt** vorschlagen (5 Jahre vor min. Lebensdauer, ZHAW). Das ist Planung, kein Wartungsauftrag (E10).

---

## 7. Funktionale Anforderungen V1 und Abnahmekriterien

Konsistenz: E1 (alle Teile einfach), E2 (3D darstellerisch), E3 (Raeume = Rechtecke, KI aus Grundriss), E4 (Elemente aus Listen/Schemas), E5 (Mandanten), E6 (Erneuerungsliste, Kosten, 10–20-J.-Plan, Zustand), E8 (Katalog-IDs, Pruefliste), E10 (keine Tickets/Sensorik).
Kriterien mit "[A]" bei Schwellwerten sind Vorschlaege und vom PO zu bestaetigen.

### A. Mandanten, Struktur, Rechte

| ID | Anforderung | Abnahmekriterium |
|---|---|---|
| FA-01 | Mandanten anlegen; alle Daten sind einem Mandanten zugeordnet. | Benutzer von Mandant A sieht in UI, API, Export und Suche keine Daten von Mandant B (Testfall mit zwei Mandanten). |
| FA-02 | Hierarchie Liegenschaft → Gebaeude → Geschoss → Raum → Element pflegen. | Jede Ebene anlegen, umbenennen, loeschen (mit Rueckfrage bei Kindobjekten). |
| FA-03 | Ein FM-Dienstleister-Benutzer kann Zugriff auf mehrere Mandanten haben und zwischen ihnen wechseln. | Wechsel ohne Neuanmeldung; aktive Mandant-Anzeige jederzeit sichtbar. |
| FA-04 | Rollen mindestens: Mandanten-Admin, Bearbeiter, Leser; Einschraenkung auf Liegenschaften. | Leser kann nichts aendern; Bearbeiter mit Liegenschaft X sieht Liegenschaft Y nicht. |
| FA-05 | Anmeldung per SSO (Entra ID) pro Mandant konfigurierbar, sonst E-Mail + MFA. | Login ueber Entra-Test-Tenant funktioniert; ohne SSO ist MFA erzwungen. |
| FA-06 | Audit-Log aller Aenderungen an Elementen, Kennwerten, Bewertungen, Kosten. | Fuer jede Aenderung sind wer, wann, alt, neu abrufbar; Log ist fuer Bearbeiter nicht editierbar. |

### B. Dokumente

| ID | Anforderung | Abnahmekriterium |
|---|---|---|
| FA-07 | Upload von PDF (Vektor und Scan), XLSX/XLS, CSV, PNG/JPG, TIF; mehrere Dateien gleichzeitig. | 50 Dateien / 1 GB in einem Vorgang hochladbar [A]; Fortschritt sichtbar; Fehler pro Datei gemeldet. |
| FA-08 | DWG/IFC/DOC werden gespeichert, aber in V1 nicht ausgelesen. | Upload moeglich, Hinweis "nicht auswertbar in V1". |
| FA-09 | Dokumente erhalten Metadaten: Dokumentart (Grundriss, Liste, Schema, Datenblatt, Anleitung, Protokoll, Sonstiges), Gebaeude, optional KBOB-Fachbereich/Dokumenttypcode. | KI schlaegt Dokumentart vor; Benutzer kann korrigieren; Filter nach Art funktioniert. |
| FA-10 | Dokumente n:m mit Elementtypen und Elementen verknuepfen. | Ein Datenblatt haengt an einem Typ und erscheint bei allen Elementen dieses Typs. |
| FA-11 | Dokumentvorschau im Browser mit Sprung auf die Herkunftsseite. | Klick auf Herkunft eines Kennwerts oeffnet das Dokument auf der richtigen Seite. |

### C. KI-Auslesen und Pruefung

| ID | Anforderung | Abnahmekriterium |
|---|---|---|
| FA-12 | KI erkennt aus Grundriss-PDF/Bild Geschoss und Raeume als Rechtecke mit Bezeichnung (E3). | Auf dem Pilot-Testset werden ≥ 80 % der Raeume erkannt [A]; Korrektur (verschieben, Groesse, loeschen, neu) per Maus. |
| FA-13 | KI liest aus Listen und Schemas Elemente aus: Bezeichnung, Typ, Hersteller, Menge, Raum/Standort, Anlagekennzeichen (E4). | Auf dem Pilot-Testset ≥ 90 % der Zeilen einer Excel-Liste korrekt [A], ≥ 70 % bei Scan-PDF [A]; Messung durch Test-Architekt. |
| FA-14 | KI ordnet jedes Element einer **Katalog-ID** zu oder legt es in die **Pruefliste** (E8). Keine freien Typen. | Element ohne sichere Zuordnung landet in der Pruefliste, nie stillschweigend in einem falschen Typ. |
| FA-15 | KI liest aus Datenblaettern Kennwerte: Hersteller, Typ, Lebensdauer (Jahre oder Stunden), Leistung. | Jeder Wert speichert Dokument, Seite, Konfidenz, Status "vorgeschlagen". |
| FA-16 | Einbaudatum aus Protokollen lesen; sonst Default = Uebergabedatum des Gebaeudes, als "abgeleitet" markiert. | Kein Element ohne Einbaudatum in der Berechnung; Herkunft "abgeleitet" ist sichtbar. |
| FA-17 | Lebensdauer in Betriebsstunden wird mit Betriebsstunden/Jahr pro Elementtyp in Jahre umgerechnet. | Umrechnung nachvollziehbar angezeigt (z.B. "50'000 h ÷ 2'500 h/a = 20 J."). |
| FA-18 | Pruefansicht: Vorschlaege nach Konfidenz sortiert, einzeln oder gesammelt bestaetigen, korrigieren, verwerfen. | 100 Vorschlaege mit hoher Konfidenz in ≤ 3 Klicks gesamthaft bestaetigen [A]; Bestaetigung speichert Person und Zeit. |

### D. Katalog und Richtwerte

| ID | Anforderung | Abnahmekriterium |
|---|---|---|
| FA-19 | Bauteil-Katalog mit Katalog-ID, Name, eBKP-H-Element, optional ETIM-Klasse, 3D-Modell, Icon, Richtwert-Lebensdauer (min/mittel/max), Referenzquelle. | 30–50 Eintraege vorhanden; jeder hat eBKP-H und 3D-Modell. |
| FA-20 | Mandant kann Richtwerte ueberschreiben (eigene Tabelle per Excel-Import). | Import einer Tabelle mit 50 Zeilen; Rangfolge manuell > Datenblatt > Mandant-Richtwert > Planora-Richtwert wird angewendet und angezeigt. |
| FA-21 | Pro Element ist sichtbar, **welche** Lebensdauer gilt und **warum** (Quelle in der Rangfolge). | Tooltip/Detail zeigt Quelle; Aenderung der Quelle aendert die Berechnung sofort. |

### E. Erneuerungsplanung und Kosten

| ID | Anforderung | Abnahmekriterium |
|---|---|---|
| FA-22 | Restlebensdauer und Ersatzjahr pro Element berechnen (Kap. 6.2). | Testfaelle mit bekannten Eingaben ergeben die erwarteten Jahre (Tabelle des Test-Architekten). |
| FA-23 | Erneuerungsliste mit Ampel: rot = faellig/ueberfaellig, gelb = in ≤ N Jahren, gruen = spaeter; N pro Mandant einstellbar (Default 3 [A]). | Filter nach Ampel, Gebaeude, eBKP-H-Gruppe, Jahr; Sortierung nach Ersatzjahr. |
| FA-24 | Kosten pro Elementtyp mit Preisjahr und Bezugsgroesse (Stk., m, m², kW); Mandant kann ueberschreiben. | Element ohne Kosten wird im Plan als "Kosten fehlen" markiert, nicht als 0 CHF. |
| FA-25 | Teuerung: Kosten werden vom Preisjahr auf das Ersatzjahr hochgerechnet (Satz pro Mandant, Default [A]). | Rechenweg im Export nachvollziehbar. |
| FA-26 | Investitionsplan 10 oder 20 Jahre: Summe pro Jahr, gruppiert nach Gebaeude und eBKP-H-Hauptgruppe/Element. | Summen stimmen mit der Elementliste ueberein (Abgleich im Test). |
| FA-27 | Wiederholte Ersatzzyklen innerhalb des Horizonts (z.B. Lebensdauer 8 J. → 2 Ersatz in 20 J.). | Element mit 8 J. erscheint im 20-J.-Plan zweimal. |
| FA-28 | Manuelle Verschiebung eines Ersatzes (Paketbildung) mit Begruendung, ohne Rechenwert zu ueberschreiben. | Geplantes und berechnetes Jahr sind beide sichtbar. |
| FA-29 | Excel-Export: Erneuerungsliste und Investitionsplan, mit Herkunft der Lebensdauer und Kosten. | Datei oeffnet in Excel ohne Fehler; Summen als Formeln oder Werte konsistent. |

### F. Zustandsbewertung

| ID | Anforderung | Abnahmekriterium |
|---|---|---|
| FA-30 | Zustandsbewertung pro Element vor Ort (Tablet/Smartphone-Browser): Klasse 1–5, Notiz, Foto optional. | Bewertung von 20 Elementen in ≤ 10 Min. [A]; funktioniert auf Tablet-Browser. |
| FA-31 | Bewertung passt Restlebensdauer gemaess Faktor-Tabelle des Mandanten an; Historie bleibt erhalten. | Vorher-/Nachher-Ersatzjahr sichtbar; alte Bewertungen abrufbar. |
| FA-32 | Mehrfachbewertung: gleiche Klasse fuer mehrere Elemente eines Typs in einem Raum/Geschoss. | 50 Leuchten eines Geschosses in einem Schritt bewertet. |

### G. 3D-Darstellung

| ID | Anforderung | Abnahmekriterium |
|---|---|---|
| FA-33 | Isometrisches Ton-Modell aus Geschossen und Raum-Rechtecken; Geschosse explodierbar/einzeln (E2). | Gebaeude mit 10 Geschossen fluessig drehbar auf Standard-Laptop [A, Schwelle vom Architekten]. |
| FA-34 | Elemente als Pins mit Icon, gruppiert bei vielen Elementen; Pin-Farbe = Ampel. | 10'000 Elemente im Gebaeude ohne Absturz; Gruppen zeigen Anzahl. |
| FA-35 | Klick auf Element zeigt Kennwerte mit Herkunft, Dokumente, Zustand, Ersatzjahr, Kosten. | Alle Felder aus FA-15/16/21/22/24 sichtbar, Sprung ins Dokument funktioniert. |
| FA-36 | Filter im 3D: Ampel, eBKP-H-Gruppe, Katalogtyp. | Nur gefilterte Pins sichtbar. |

### H. Daten und Abgrenzung

| ID | Anforderung | Abnahmekriterium |
|---|---|---|
| FA-37 | KI-Nutzung pro Mandant abschaltbar; dann nur manuelle Erfassung und Excel-Import. | Mit KI aus geht kein Dokument an einen KI-Dienst (Log-Pruefung). |
| FA-38 | Excel-Import von Elementlisten ohne KI (Spaltenzuordnung durch Benutzer). | Import von 1'000 Zeilen mit Zuordnung auf Katalog-IDs; nicht zuordenbare Zeilen landen in der Pruefliste. |

**Ausdruecklich nicht in V1 (E10):** Wartungsauftraege, Stoerungsmeldungen, Tickets, Live-Sensordaten, BIM-Bearbeitung, Plan-Symbolerkennung. Ein Bewertungs-Terminvorschlag (Kap. 6.2) ist kein Auftrag.

---

## Offene Fragen fuer den Product Owner [?]

| # | Frage | Warum wichtig |
|---|---|---|
| PO-1 | Sollen wir bei CRB eine Lizenz fuer die LCC-Kennwerte (Nutzungsdauern pro eBKP-H) anfragen, oder baut der Chef eine eigene Richtwerttabelle mit Quellenverweis? | Ohne Lizenz duerfen CRB-Werte nicht elektronisch angeboten werden; bestimmt FA-19. |
| PO-2 | ETIM-Schweiz-Mitgliedschaft fuer deutsche/franzoesische Klassennamen? Oder reicht Englisch plus eigene Anzeige? | Kosten und Pflegeaufwand. |
| PO-3 | Brauchen wir eine eBKP-H-Lizenz fuer die Code-Struktur in der Software? (Anfrage bei CRB) | Rechtliche Absicherung des Schluessels. |
| PO-4 | Welche Zustandsskala: 5 Klassen mit Faktor (einfach) oder ZHAW-nah mit Zustandswert und min/max-Bandbreite? | Bestimmt FA-22, FA-30, FA-31. |
| PO-5 | Woher kommen die Ersatzkosten pro Elementtyp? Eigene Erfahrungswerte des Chefs, Kundenwerte, CRB-Kennwerte? Inklusive Demontage/Nebenkosten? | Ohne Kosten kein Investitionsplan (E6). |
| PO-6 | Teuerung: fester Satz pro Mandant genuegt fuer V1, oder Index (z.B. Baupreisindex BFS)? | FA-25. |
| PO-7 | Welche Ampel-Schwellen (gelb ab wie vielen Jahren) erwarten Zielkunden? | FA-23. |
| PO-8 | Gibt es einen Pilotkunden mit echter Uebergabedokumentation (Grundrisse, Listen, Datenblaetter) als Testset? | Ohne echte Dokumente keine messbaren Abnahmekriterien fuer FA-12/13. |
| PO-9 | Sind Banken/Versicherungen/Pensionskassen Zielkunden? Dann FINMA-RS 2018/3 im Vertrag einplanen. | Vertragsvorlagen, Pruefrechte. |
| PO-10 | Sollen Mehrsprachigkeit (DE/FR/IT) und eBKP-H-Bezeichnungen in V1 enthalten sein? | Westschweizer Kunden. |
| PO-11 | Soll Planora den KBOB-Dokumenttypcode als Metadatum unterstuetzen (Kunden der oeffentlichen Hand)? | FA-09. |
| PO-12 | Ist eine Positionierung neben Stratus (Portfolio) als Ergaenzung (Element-Ebene) gewollt, inkl. Export/Import dorthin? | Vertrieb, spaetere Schnittstelle (E9). |

---

## Methodische Hinweise

- BMAD-Skills (`bmad-agent-analyst`, `bmad-deep-recon`, `bmad-product-brief`) wurden nicht gestartet: Die Aufgabe war ein Recherche-Dokument mit fester Gliederung; der Auftrag stellte die Skills frei.
- Mehrere Quell-PDFs wurden lokal per Textextraktion gelesen (KBOB-Richtlinie, CRB LCC 2012 und D/2026, ZHAW-Artikel). Tabellenspalten koennen dabei verrutschen; Zahlen aus Tabellen vor Uebernahme ins Produkt am Original pruefen.
- Nicht frei einsehbar und deshalb nicht direkt geprueft: SIA 112, SIA 480, SIA 2047, VDI 2067 Blatt 1, Paritaetische Lebensdauertabelle (Volltext), CRB-Lizenzbedingungen fuer Software, Stratus-Methodik im Detail.

---

## Quellen (alle abgerufen am 2026-11-08)

- [Q1] Stadt Bern, Hochbau: Leistungsbeschrieb Teilphase 53 "Inbetriebnahme, Abschluss" (V1.0, 2013). https://www.bern.ch/politik-und-verwaltung/stadtverwaltung/prd/hochbau-stadt-bern/downloads-fur-planer/kostensteuerung-und-abrechnung/we-hsb-abschluss-v1-0-20131212.pdf
- [Q2] suissetec: Merkblatt Phase 53 (2023). https://suissetec.ch/files/PDFs/Merkblaetter/Alle%20Branchen/Franz/2023_05_MB_Phase53_FR_neutral_editierbar.pdf
- [Q3] KBOB/IPB: Richtlinie Bauwerksdokumentation im Hochbau, Version 2016. https://www.kbob.admin.ch/dam/it/sd-web/-s2qA0Hnsejs/KBOB-IPB_Richtlinie_Bauwerksdokumentation_2016_DE.pdf
- [Q4] CRB: Handbuch LCC – Instandhaltung und Instandsetzung von Bauwerken, Auszug (2012). https://www.crb.ch/_Resources/Persistent/6/8/a/b/68abb4f73534c6467a1268a969f13ec05db3b9d0/Auszug_LCC_Handbuch_de.pdf
- [Q5] CRB: LCC-Leitfaden D/2026, Auszug, und Produktseite. https://www.crb.ch/_Resources/Persistent/5/a/0/1/5a01b9a17955ef6492dc3bf55fe7b2a11e113142/Auszug_LCC_Leitfaden_D26.pdf · https://www.crb.ch/de/normen-standards/facility-management/lcc-leitfaden
- [Q6] comparis.ch: Lebensdauertabelle Mieterschaeden (HEV/MV, Bezug nur Shop/Online-Tool). https://www.comparis.ch/immobilien/umzug/vor-dem-umzug/lebensdauertabelle-mieterschaeden · Mieterverband Einlage 2024: https://mieterverband.ch/dam/jcr:511293fb-f710-4111-8f7f-edd8de79a9f7/mp_Lebensdauertabelle_2024_Einlageseiten_Web.pdf
- [Q7] CRB: Baukostenplan Hochbau eBKP-H und Regelsatz eBKP–IFC. https://www.crb.ch/de/normen-standards/baukostenplane/baukostenplan-hochbau-ebkp-h · https://www.crb.ch/de/normen-standards/baukostenplane/regelsatz-ebkp-ifc
- [Q8] DIN Media / VDI: VDI 2067 Blatt 1 (2012-09). https://www.dinmedia.de/de/technische-regel/vdi-2067-blatt-1/151420393 · https://vdi.de/richtlinien/details/vdi-2067-blatt-1-economic-efficiency-of-building-installations-fundamentals-and-economic-calculation
- [Q9] ETIM International: License Info. https://www.etim-international.com/?p=1811
- [Q10] KBOB: Praesentation Bauwerksdokumentation (2014). https://www.kbob.admin.ch/dam/de/sd-web/B4Ve4C9L5OCI/20140501_PowerPoint-Pr%C3%A4sentation_(1).pdf
- [Q11] Basler & Hofmann: Stratus mit Nachhaltigkeitsfunktion (22.06.2022). https://www.baslerhofmann.ch/en/stratus-real-estate-management-software-with-new-sustainability-feature
- [Q12] Hubbuch, M.; Paganini, D.: Methodik einer systematischen Instandsetzungsplanung am Beispiel von Spitalgebaeuden. Journal fuer FM 10 (2015), ZHAW IFM. https://journal.ifm.tuwien.ac.at/article/82/galley/82/view
- [Q13] Spacewell / NEN 2767 siehe Q17, Q34.
- [Q14] Planon: Asset Lifecycle Management. https://planonsoftware.com/uk/modules/asset-lifecycle-management/
- [Q15] Archibus: Capital Budgeting (PDF) und Hilfe. https://archibus.com/wp-content/uploads/2024/04/capital-budgeting.pdf · https://help.archibus.com/user_en/Content/cap_plan_results/capital_plan_bus_results.htm
- [Q16] Eptura: Archibus Asset Management & BIM. https://eptura.com/our-platform/archibus/asset-management-bim/
- [Q17] Spacewell: Maintenance Planning (MJOP), AI for Building Management. https://spacewell.com/asset-facility-management-software/maintenance-planning-software/ · https://spacewell.com/ai-building-management/
- [Q18] immopac: Products. https://immopac.ch/en/products
- [Q19] Basler & Hofmann: Infrastructure management (Stratus, 10–20 Jahre). https://baslerhofmann.ch/en/skills/infrastructure-management
- [Q20] Faktenblatt Instandsetzung (ewz/Stadt Zuerich) und HES-SO-Publikation zu SIA 480/2047/2032. https://www.ewz.ch/content/dam/stzh/energie/Startseite/beratung-froerderung/Faktenblatt_Instandsetzung.pdf · https://arodes.hes-so.ch/record/6719/files/published%20version.pdf?version=1
- [Q21] EC3 2024: NLP-based Data-Enrichment for Building Management; BIMA+ 2025 (Baig). https://ec-3.org/publication/ec32024_248/ · https://bimaplus.org/wp-content/uploads/2025/10/13-2025-AhtishamAliBaig.pdf
- [Q22] WEKA Schweiz: Auftragsdatenbearbeitung in der Praxis. https://www.weka.ch/themen/datenschutz-und-it-recht/datenschutz-umsetzen/article/die-auftragsdatenbearbeitung-auftragsdatenbearbeitung-in-der-praxis/
- [Q23] Kanton Bern, Rechtsamt DIJ: Gutachten Bekanntgabe von Personendaten ins Ausland im Rahmen einer Auftragsbearbeitung. https://www.dij.be.ch/content/dam/dij/dokumente/de/%C3%BCber-uns/%C3%A4mter-der-dij/rechtsamt/Verfassungs-%20und%20v%C3%B6lkerrechtliche%20Vorgaben%20%20der%20Bekanntgabe%20von%20Personendaten%20%20ins%20Ausland%20im%20Rahmen%20einer%20Auftragsbearbeitungl.pdf
- [Q24] EDOEB: Anleitung fuer die Pruefung der Zulaessigkeit von Datenuebermittlungen mit Auslandbezug. https://www.edoeb.admin.ch/dam/edoeb/de/Dokumente/datenschutz/Anleitung%20f%C3%BCr%20die%20Pr%C3%BCfung%20der%20Zul%C3%A4ssigkeit%20von%20Daten%C3%BCbermittlungen%20mit%20Auslandbezug_DE.pdf.download.pdf · DSG: https://www.fedlex.admin.ch/eli/cc/2022/491/de · DSV: https://www.fedlex.admin.ch/eli/cc/2022/568/de
- [Q25] Bundesrat: Swiss-US Data Privacy Framework (14.08.2024); Kanton Freiburg OEDSMB (Inkrafttreten 15.09.2024). https://admin.ch/gov/en/start/documentation/media-releases.msg-id-102054.html · https://www.fr.ch/de/oedsmb/news/zertifizierte-us-unternehmen-mit-angemessenem-datenschutzniveau-begrenzte-auswirkungen-auf-auslagerungsmassnahmen
- [Q26] BSI: ISO 27001:2022 Timeline; Kiwa: Anpassungen ISO/IEC 27001:2022. https://www.bsigroup.com/globalassets/localfiles/de-de/isoiec-27001/ressourcen/bsi-iso-27001-2022-timeline-de.pdf · https://www.kiwa.com/de/de/nachrichten/2023/anpassungen-der-isoiec-270012022/
- [Q27] Holzbau Schweiz: Nutzungsbestimmungen fuer EDV-Lizenzen (2023, CRB-Standards). https://holzbau-schweiz.ch/wp-content/uploads/2025/01/20230710_Nutzungsbestimmungen-fuer-EDV-Lizenzen.pdf
- [Q28] itek: ETIM-Klassifizierung und -Mitgliedschaft. https://www.itek.de/en/services/etim-klassifizierung · https://www.itek.de/en/services/etim-mitgliedschaft
- [Q29] Websuche "Fabasoft Facility Management CAFM Schweiz" ohne relevante Treffer (Capterra CH, softguide.de). https://www.softguide.de/software/facility-management-cafm
- [Q30] pit-cup PRO pitTGA / metamagix; Siemens Swiss LCDM Hub. https://pit.de/en · https://www.siemens.com/de-de/products/bbv-software-services-swiss-lcdm-hub/
- [Q31] vhw FWS 4/2025 (Rinnenburger); FFG-Projekt FacilityQ. https://www.vhw.de/fileadmin/user_upload/08_publikationen/verbandszeitschrift/FWS/2025/4_2025/FWS_4_2025_Rinnenburger.pdf · https://projekte.ffg.at/projekt/5142825/pdf
- [Q32] FINMA: Medienmitteilung RS 2018/3 Outsourcing. https://www.finma.ch/de/news/2017/12/20171205-mm-rs-outsourcing/
- [Q33] CORDIS: EPIQR-Projekt (MERIP, Schweiz). https://cordis.europa.eu/project/id/JOR3960044
- [Q34] SOCOTEC / Bureau Veritas: Condition assessment NEN 2767. https://socotec.nl/en/services/building-performance/condition-assessment-nen2767 · https://benelux.bureauveritas.com/en/consultancy/assetmanagement/condition-measurement-accordance-nen-2767
