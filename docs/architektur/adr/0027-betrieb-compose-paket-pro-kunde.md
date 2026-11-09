# 0027 – Betrieb: ein Docker-Compose-Paket pro Kunde (CH-VM oder On-Premise)

Status: vorgeschlagen, ersetzt ADR 0002 · 2026-11-09 · Bezug: E34, E35, E37, `07-analyse-b2b.md` Kap. 2/3/8

## Kontext
[F] E34: eine Instanz pro Kunde. E35: ein Docker-Compose-Paket, Standard eigene VM in der Schweiz pro Kunde (von uns betrieben), auf Wunsch On-Premise mit demselben Paket; Self-Hosting und Open Source bevorzugt. E37: Exoscale-Managed dauerhaft ersetzt. [A] Damit fallen Managed-PG, PITR-/HA-Automatik und verwalteter Objektspeicher weg; deren Aufgaben (Backup, Restore, Updates, Ueberwachung) muessen explizit im Paket und in Runbooks liegen (07 Kap. 2 Zeile 0002, Kap. 3 Kap. 10).

## Entscheid
- **Ein Paket, zwei Betriebsarten:** dasselbe versionierte Compose-Paket fuer CH-VM und On-Premise. Inhalt [A]: Reverse Proxy mit TLS, `api`, `worker`, `migrator` (ADR 0001), PostgreSQL, Dokumentablage, ClamAV, lokale Konverter (Gotenberg, OCRmyPDF, ADR 0009/0022); ab Stufe 3 lokaler Embedding-Server. Keine kundenspezifischen Branches oder Images.
- **PostgreSQL selbst betrieben** im Paket, eigene DB pro Instanz (ADR 0031), Version im Versionsmanifest fixiert [A].
- **Lokale Dokumentablage** auf persistentem Volume. [?] PO/Architekt: Speicherwahl offen – S3-kompatibler Server im Paket oder Dateisystem-Adapter hinter dem bestehenden Speicher-Port. [F] MinIO-Community steht unter AGPLv3 ([Lizenz](https://raw.githubusercontent.com/minio/minio/master/LICENSE), Abruf 2026-11-09). [A] Lieferumfang und Kopplung brauchen Lizenzpruefung (ADR 0024); daraus folgt keine pauschale Pflicht, Planora offenzulegen.
- **Versionsmanifest** je Release: Image-Digests aller Container, Schema-Version, Katalog-/Regelwerk-Version, Modulmanifest-Version (ADR 0029), minimal unterstuetzte Vorgaengerversion.
- **Update pro Instanz:** Backup → `migrator` mit Migrationslock und Journal → `api`/`worker` neu → Health-Pruefung. Schema bleibt **N/N-1-kompatibel** (expand/contract, 03 Kap. 10.3); Rueckweg = vorheriges Image, bei nicht rueckwaertskompatiblem Schritt = geuebter Restore.
- **Backup/Restore pro Instanz:** DB plus alle referenzierten Originale/Derivate, Konfiguration und benoetigte Schluessel als konsistentes Paar; verschluesselt, Kopie **ausserhalb der VM** [A]. Restore auf frischer VM ist der Abnahmenachweis (05-tests, Neu: Backup/Restore).
- **Healthchecks/Ressourcen:** Healthcheck je Container, Ressourcenbudgets je Dienst, Installation aus sauberer unterstuetzter Linux-VM per Anleitung [A].
- **Secrets** nur als Umgebungsdatei/Secret-Datei auf dem Host, nie im Paket oder Repo.

## Alternativen (verworfen, mit Grund)
- Exoscale-Managed (ADR 0002): durch E35/E37 dauerhaft ersetzt.
- Kubernetes/Helm als Pflicht: fuer eine Instanz pro Kunde und On-Premise zu schwer [A].
- Gemeinsame DB-Instanz fuer mehrere Kunden: widerspricht E34.

## Konsequenzen
- Positiv: identische Lieferung fuer beide Betriebsarten, klare Kundengrenze, keine Managed-Abhaengigkeit.
- Negativ: eine VM ist kein HA-System [A]; RPO/RTO aus 03 Kap. 10.5 sind ohne eigene WAL-/Objektstrategie nicht uebertragbar [A, 07 Kap. 8 Punkt 7].
- Folgearbeit: Installations-, Update- und Restore-Runbook; Test Update N-1 → N und Restore (05-tests, Neu).
- [?] PO: Wer installiert/erzwingt Sicherheitsupdates auf CH-VMs und Kundenservern, welche Wartungsfenster, wie Offline-Image-Import (07 Kap. 8 Punkt 2)?
- [?] PO: Wer sichert, prueft, verschluesselt und restored je Betriebsart; wo liegt die VM-unabhaengige Kopie; wer verwahrt Schluessel (07 Kap. 8 Punkt 7)?
- [?] PO: Gilt «nur Claude als externe API» (E36) auch fuer Betriebsverkehr (ClamAV-Signaturen, Image-/Modell-Downloads, SMTP, Zeit) (07 Kap. 8 Punkt 6)?
