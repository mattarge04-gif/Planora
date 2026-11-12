# M2b-1 – technischer Abschluss 12.11.2026

- [3D-Uebersicht](uebersicht.png): zwei Geschosse, fuenf Einheiten, acht Symbole.
- [Verteiler ausgewaehlt](verteiler.png): Standort EG / Technik; versorgt Restaurant (EG) und Buero C (OG1).

Die Screenshots stammen aus der lokalen Demo mit Beispieldaten. Login, Gebaeudeliste, Auswahl und Panel wurden per Playwright geprueft, ohne CSP-Verletzungen. Erwartetes initiales 401 auf `/api/ich`; Deprecation-Hinweis zu Three.Clock aus dem Abhaengigkeitsbaum.

Pruefstand derselben Sitzung: Backend 402 Tests, Frontend 19 Tests, Typpruefungen und Frontend-Produktionsbuild bestanden. Docker zuerst 27 Tests bestanden; nach Korrektur des fehlenden Web-Build-Kontexts separat alle sechs Update-Tests bestanden (207.73 s). Damit 33 unterschiedliche Tests der aktiven Docker-Suites bestanden. Suite B und vollstaendige WSL-/CH-VM-Abnahme nicht wiederholt. Abnahme-Skripte syntaktisch geprueft, keine vollstaendige SBOM-Neuerzeugung.

**Keine visuelle Endabnahme:** Der PO erwartet eine deutlich ausgearbeitete Darstellung. Verbindliche Zielrichtung und Zusatzschaetzung: [Design-Nachtrag](../../design/2026-11-12-visuelle-zielrichtung.md).
