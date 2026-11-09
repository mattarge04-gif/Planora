# 0025 – Oeffentliche APIs: geo.admin.ch/GWR, Nager.Date, Pwned Passwords

> **Status ab Welle 4: zurueckgestellt bis nach Demo (E34–E37, 2026-11-09).**
> [F] E36: oeffentliche APIs aus E32 bis nach der Demo zurueckgestellt.
> [A] Kein GWR-/Feiertags-/HIBP-Aufruf in der Demo, Stammdaten manuell. Wiederaufnahme muss mit der Vorgabe «einzige externe API Claude» neu abgeglichen werden.
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: akzeptiert (PO-Entscheid E32) · 2026-11-09 · Bezug: E3 (minimaler Kundenaufwand), E22, E29, revDSG, `06-bausteine-open-source.md` Kap. 9

## Kontext
Abgleich mit public-apis/public-apis: drei Dienste bringen Nutzen ohne Kundendokumente nach aussen zu geben. Live-Erreichbarkeit und Nutzungsbedingungen sind im Scaffold zu verifizieren [A].

## Entscheid
1. **geo.admin.ch (Bund) – Adresse und Gebaeude- und Wohnungsregister (GWR)**
   - Port **`GebaeudeRegister`** im Modul `struktur`, Adapter `geo-admin`; nur der Prozess `api` ruft `api3.geo.admin.ch` auf (Netzfreigabe nur dieser Host).
   - Funktionen: `adresseSuchen(text)` (Autovervollstaendigung beim Anlegen von Liegenschaft/Gebaeude), `gebaeudeDaten(egid)` (Baujahr, Anzahl Geschosse, Gebaeudekategorie, Energietraeger Heizung).
   - Neue Spalte `gebaeude.egid` (eindeutig je Mandant: `UNIQUE (mandant_id, egid)`).
   - GWR-Werte werden **nie direkt** geschrieben: sie werden `angabe`-Zeilen mit `ziel_typ=gebaeude`, `quelle_art=import`, Quelle `gwr`, `status=vorgeschlagen` und muessen bestaetigt werden (AD-4, AD-5). Anzahl Geschosse aus dem GWR = Vorschlag fuer die Geschossliste.
   - Antworten werden in PG gecacht (`register_cache`, global, ohne Mandantenbezug, 30 Tage [A]). Bei Ausfall: manuelle Eingabe, keine Fehlermeldung, die die Erfassung blockiert.
   - Gesendet wird nur Adresstext bzw. EGID, keine Personen- oder Dokumentdaten.
2. **Nager.Date – Feiertage CH inkl. Kantone**
   - Kein Live-Aufruf zur Laufzeit: jaehrlicher Job `feiertage_importieren` fuellt die globale Tabelle `feiertag` (`datum`, `kanton` NULL = ganze CH, `name`). Rueckfall bei Ausfall: npm-Paket `date-holidays` (offline).
   - Nutzer: `hinweise` (keine Mails an Feiertagen, Fristen in Arbeitstagen nach Kanton der Liegenschaft), `zustand` (Vorschlag naechste Inspektion auf Arbeitstag).
3. **Have I Been Pwned – Pwned Passwords (Range-API, k-Anonymitaet)**
   - Nur fuer lokale Keycloak-Konten (nicht Entra-ID-Konten): Passwort bei Setzen/Aendern gegen bekannte Leaks pruefen; gesendet werden nur die ersten 5 Zeichen des SHA-1-Hashes.
   - Umsetzung als Keycloak-Passwort-Policy-Erweiterung [?: geeignete Erweiterung mit erlaubter Lizenz im Scaffold waehlen, sonst eigener kleiner Provider]. Netzfreigabe `api.pwnedpasswords.com` nur fuer den Keycloak-Container. Bei Ausfall: Policy laesst das Passwort zu (fail-open) und protokolliert das [A].

## Alternativen
- Nominatim/OSM: fuer CH ungenauer, Nutzungsgrenzen der oeffentlichen Instanz.
- Feiertage live abfragen: unnoetige Laufzeitabhaengigkeit.
- Cloud-Virenscanner, Cloud-OCR/ML: verworfen (Dokumente verlassen Planora; ADR 0003, 0016).

## Konsequenzen
- + Weniger Tipparbeit beim Onboarding; EGID als stabiler Schluessel fuer Austausch (E22) und Importe aus Bestandssystemen (E29).
- + Bessere Antworten in Sicherheits-Frageboegen (Passwort-Leak-Pruefung).
- − Zwei neue Netzfreigaben; Fakes der Adapter in CI (keine echten Aufrufe in CI).
- Subprozessorliste: Bund/swisstopo und HIBP erhalten keine Personendaten im Sinne des DSG [A, Jurist bestaetigt].
