# M1b – Annahmen und Integrationsnotizen

## Spur B

- Basislinie 2026-11-10: `npm.cmd ci`, `npm.cmd test`: 101 Tests gruen (Plan nennt noch 98). Windows: `npm.cmd` umgeht die gesperrte PowerShell-Skriptausfuehrung.
- B2 [A]: Vollstaendige restic-Datenpruefung am ersten UTC-Monatstag, sonst 5 Prozent; entspricht der vorlaeufigen Prueffrequenz aus Spec §7.1. Staging wird je Lauf nach Erfolg oder Fehler entfernt (Dump ohne Klartext-Rollenpasswoerter).
- Integration ausserhalb Datei-Eigentum: `betrieb/planora` (Spur A) muss die Backup-/Restore-/Freigabe-CLI aufrufen. Backup-Einstieg: `node dist/betrieb/backup/cli.js sichern --anlass update`; Exit 0 und letzte stdout-Zeile gemaess Vertrag.
