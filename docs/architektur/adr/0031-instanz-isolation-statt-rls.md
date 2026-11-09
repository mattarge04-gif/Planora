# 0031 – Instanz-Isolation statt Row-Level-Security

Status: vorgeschlagen, ersetzt ADR 0010 · 2026-11-09 · Bezug: E34, E35, ADR 0005, ADR 0015, `07-analyse-b2b.md` Kap. 2 (0010), Kap. 3 (Kap. 4, 9), Kap. 4 (AD-3)

## Kontext
[F] E34: B2B, eine Instanz pro Kunde; RLS zurueckgestellt (spaeter Kundenmodul). E35: eigenes Compose-Paket pro Kunde. [A] Die Kundengrenze liegt damit ausserhalb der App. Rollen, Liegenschafts-/Objektrechte und minimale DB-Rechte innerhalb einer Instanz bleiben noetig; «Single-Tenant» heisst nicht «alle sehen alles» (07 Einleitung).

## Entscheid
- **Instanzgrenze:** pro Kunde eigene Datenbank, eigene Volumes (Dokumente, Derivate, Backups), eigene Secrets, eigenes Docker-Netz, eigenes Backup-Ziel bzw. eigener Prefix mit eigenem Schluessel (ADR 0027). Keine gemeinsam genutzten Container mit Kundendaten.
- **Keine Mandantenwahl** in der App, keine `mandant_id`-Pflichtspalte, keine mandantenweiten Plattform-Funktionen (`SECURITY DEFINER`-Mandantenliste u.ae. entfallen). Instanzparameter liegen in einer Konfigurationstabelle (`instanz_einstellung`) [A].
- **Normale Fremdschluessel** statt zusammengesetzter Mandanten-FKs; Integritaet per Constraints.
- **Minimale DB-Rechte bleiben:** `planora_owner` (Tabellenbesitz, nur Migrationen), `planora_migrator`, `planora_app` (kein Owner, kein DDL, kein UPDATE/DELETE auf Audit), optional `planora_readonly_ops` ohne Fachdaten [A, aus ADR 0010 uebernommen].
- **Autorisierung in der App** (ADR 0028): Session → Rolle → Liegenschafts-Scope → Zielobjekt, an HTTP- und Job-Grenze; gilt auch fuer Viewer-URLs, Derivate, Downloads und Suchtreffer.
- **Betriebszugriff:** Wer Host oder DB-Owner hat, kann technisch Fachdaten lesen [A]. Das wird im Betriebsvertrag benannt und Zugriffe des Betreibers werden protokolliert (ADR 0015).
- **RLS spaeter:** keine implizite Pflicht einer Single-Tenant-Instanz; falls ein Kunde interne Mandanten braucht, eigenes Modul mit eigenem ADR (ADR 0029).

## Alternativen (verworfen, mit Grund)
- RLS beibehalten (ADR 0010): Aufwand und Fehlerquellen (Pool-Kontext, Policy-Katalog) ohne Nutzen bei einem Kunden pro DB.
- Ein Cluster, ein Schema pro Kunde: widerspricht E34/E35 (eigener Server pro Kunde).

## Konsequenzen
- Positiv: einfacheres Schema, kein Mandantenkontext in Jobs/Pool, Kundendaten physisch getrennt.
- Negativ: Fehlkonfiguration (falsches Volume, falsches Backup-Ziel, URL auf Kunde B) wird zum Hauptrisiko statt Policy-Lecks.
- Folgearbeit: Tests «Installation/Instanztrennung» (05-tests, Neu): zweite Instanz mit eigenen Daten/Secrets/Backup-Ziel, keine gemeinsamen Volumes, Restore-Manifest passt zur Instanz. RLS-Suite (pgTAP) entfaellt; RLS-7 wird GRANT-Test, RLS-8/9 werden Rollen-/Objektzugriffstests (07 Kap. 6).
- [?] PO: Welche Liegenschafts-/Eigentuemergrenzen gelten innerhalb eines Kunden (07 Kap. 8 Punkt 8)?
