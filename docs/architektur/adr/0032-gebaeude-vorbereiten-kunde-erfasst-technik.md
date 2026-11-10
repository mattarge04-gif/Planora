# 0032 – Gebaeude vorbereiten, Kunde erfasst Einheiten und Technik

Freigabestatus: akzeptiert · 2026-11-11 · PO-Bestaetigung im Projektgespraech (E38)
Aenderungsstatus: neu · praezisiert ADR 0026 und ADR 0008
Lieferstufe: 1 Grundstruktur/Erfassung · 2 Lebensdauer/Ampel · 4 optionales KI-Interview

## Kontext

Planora bereitet je Kunde, zuerst Siemens, eine schematische Gebaeudehuelle vor. Der Kunde ergaenzt Einheiten und Technik ueber gefuehrte Fragen. Dies konkretisiert den vorhandenen Plan; M2–M6 sind noch zu implementieren.

## Entscheid

1. **Eine Software fuer alle Kunden:** kundenspezifische Gebaeudedaten, keine eigene Codebasis oder individuell programmierte Szene je Kunde.
2. **Planora bereitet die Huelle vor:** Grundform (Rechteck/L/U), ungefaehre Breite/Tiefe, Geschosszahl/-reihenfolge und Hoehen. Defaultwerte und Formen kommen aus einem versionierten Welt-Regelwerk. Schematische Darstellung, keine massstabsgetreue BIM-Planung.
3. **Kunde definiert Einheiten:** je Geschoss Bezeichnung, Art und optionale ungefaehre Flaeche. Automatisches Rechtecklayout mit Vorschau und einfacher Positions-/Groessenkorrektur. Aehnliche Einheiten und Geschosse kopieren koennen.
4. **Gefuehrte Technik-Erfassung:** zuerst Heizung, danach weitere Gewerke. Mehrfachauswahl Heizkoerper (HK), Fussbodenheizung (FBH), thermisch aktivierte Bauteilsysteme (TABS). Passende Folgefragen fuer vorhandene Verteiler, Mengen, Kreise, Standort und Zuordnung. Hersteller, Typ, Baujahr und Unterlagen optional.
5. **Vorschlaege bestaetigen:** FBH darf einen Verteiler vorschlagen, aber nicht dessen Existenz behaupten. Ja/Nein/Unbekannt unterscheiden; Unbekannt ist nicht Null. Mengen und Katalog-IDs pruefen.
6. **Standort und Versorgung trennen:** ein Bauteil steht in einer Einheit/an einem Geschoss und kann mehrere Einheiten versorgen. Eine Einheit kann mehrere Heizungsarten haben. Kein Zwang zu einem Verteiler je Einheit, keine Leitungsnetzsimulation.
7. **Gemeinsames Beschreibungsschema:** Formular, Excel und spaeter KI-Interview verwenden dieselben validierten Daten. Geometrie entsteht ausschliesslich im deterministischen Generator; gleiche Eingabe und Regelwerk-Version ergeben dieselbe Welt.
8. **Stabile Identitaet:** Bearbeitung und Wiederimport erhalten Bauteil-IDs, Dokumentverknuepfungen und bestaetigte manuelle Positionen. Kopien erhalten eigene IDs. Bauteiltyp, Menge und individuell gepflegtes Exemplar unterscheiden.
9. **Navigation:** Gebaeudeuebersicht mit Glas-Geschossen und gruppierten Pins; Geschossauswahl/Explosionsansicht; Einheit mit vereinfachten Bauteilmodellen; Elementauswahl mit Eigenschaften/Dokumenten im Seitenpanel. Ampel erst mit M7.
10. **Darstellung:** Three.js/React Three Fiber, InstancedMesh je Katalogtyp, Rendern bei Aenderung. Reduzierter Modus und funktionaler 2D-/Tabellenweg nach ADR 0008. Keine KI-Geometrie und kein freier Modellierer.

## Erster durchgehender Schnitt

Zwei Geschosse, mehrere Einheiten, HK und FBH sowie ein Verteiler fuer zwei Einheiten. Planora bereitet die Huelle vor; Kunde erfasst/kopiert/korrigiert Einheiten, bestaetigt Technik und oeffnet ein Bauteil im Seitenpanel. Zuerst Beispieldaten; echte Dokumentverknuepfung mit M4/M5. PO-Rueckmeldung vor Ausbau des Katalogs.

## Abnahme

- Reproduzierbare Geometrie und stabile IDs bei unveraenderter Beschreibung.
- Gemischte Heizungsarten, gemeinsamer Verteiler und Standort unabhaengig von Versorgung.
- Unbekannt erzeugt keine bestaetigten Anlagen; Mengenfehler und liegenschaftsfremde Verweise werden abgelehnt.
- Kopieren erzeugt eigene Exemplare; Neugenerierung verliert keine Dokumente/manuellen Positionen.
- Auswahl von Geschoss, Einheit und Element auch ueber Tastatur/Tabellenweg und reduzierte Darstellung.

## Aufwand [A] und Grenzen

Gebaeude-/Einheiten-Erfassung und Generator sind bereits M2/M6 und werden nicht doppelt gerechnet. Der Heizungsassistent samt Versorgungsbeziehungen/Validierung ist neu auf **+3–5 PT** geschaetzt; mehrere ausgearbeitete Gewerke **insgesamt +6–10 PT**, nicht nochmals zusaetzlich zu den 3–5 PT. Neue Schaetzung, keine gemessene Agentenzeit. Layoutkorrektur und sichere Kopier-/Wiederimportregeln vor Umsetzung im Detail schaetzen; moegliche Einsparungen noch nicht gegengerechnet.

Verworfen: eigene Software/Handmodellierung je Kunde (Pflegeaufwand), freier 3D-Editor (nicht erforderlich), Grundriss-/KI-Erkennung als Voraussetzung (Formular muss eigenstaendig funktionieren).
