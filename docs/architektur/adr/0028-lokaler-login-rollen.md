# 0028 – Lokaler Login mit Rollen

Status: vorgeschlagen, ersetzt ADR 0007 · 2026-11-09 · Bezug: E34, FA-04, FA-05, `07-analyse-b2b.md` Kap. 2 (0004, 0007), Kap. 6

## Kontext
[F] E34: V1 mit einfachem lokalem Login und Rollen; Keycloak und Microsoft-SSO zurueckgestellt, spaeter als Kundenmodul. [A] Mit einer Instanz pro Kunde entfallen Mandantenwechsel und IdP-Brokering (ADR 0007). Rollen-, Liegenschafts- und Objektrechte bleiben noetig (07 Einleitung). Eigenbau von Passwort-Login ist sicherheitskritisch; E28/E31 verlangen fertige Bausteine.

## Entscheid
- **Etablierte Auth-Bibliothek** im Fastify-BFF (ADR 0004), kein Eigenbau von Hashing, Session-Token oder Reset-Flow. Kandidaten [A, Version/Lizenz/Reife im Scaffold pruefen]: Better Auth (MIT, 02-tech Q59), Fastify-eigene Session-/Auth-Plugins mit separater Hash-Bibliothek. Auswahl vor M1 dokumentieren.
- **Passwort-Hashing** mit einem speicherharten Verfahren nach aktueller OWASP-Empfehlung [A: Argon2id, Parameter im Scaffold gegen Quelle pruefen]; Rate-Limit und Sperre nach Fehlversuchen.
- **Erstadmin ohne Standardpasswort:** Installation erzeugt einen einmaligen Einrichtungs-Token (Ausgabe nur auf der Host-Konsole, kurz gueltig); der erste Admin setzt sein Passwort selbst [A].
- **Sessions** serverseitig (Tabelle `sitzung`), Cookie `httpOnly; Secure; SameSite=Lax`, Session-ID-Rotation nach Login und Rechteaenderung, Leerlauf- und absoluter Timeout wie 03 Kap. 9.1 [A]. CSRF: SameSite plus Pflicht-Header/Origin-Pruefung (ADR 0004).
- **Sofortiger Session-Entzug** bei Kontosperre, Rollenentzug, Passwortwechsel und Logout; Jobs pruefen beim Start die aktuellen Rechte des Ausloesers (ADR 0006).
- **Rollen** nur in Planora-Tabellen: Instanz-Admin, Bearbeiter, Bewerter [A], Leser (03 Kap. 9.2 ohne Mandant); Scope je Liegenschaft. [?] PO: Gelten innerhalb eines Kunden Liegenschafts-/Eigentuemergrenzen (07 Kap. 8 Punkt 8)?
- **Recovery:** Passwort-Reset per E-Mail-Link nur, wenn SMTP konfiguriert ist; sonst Reset durch Instanz-Admin; Notfall-Reset fuer den letzten Admin ueber Host-Konsole mit Audit-Eintrag [A].
- **MFA:** [?] PO: Ist MFA (TOTP) fuer lokale Konten in Stufe 2 Pflicht oder optional? FA-05 verlangte MFA, E34 sagt «einfacher Login».
- **SSO spaeter als Modul** (ADR 0029): liefert nur Identitaet, keine zweite Quelle fuer Rollen.
- Audit: Login, Fehlversuche, Sperre, Rollen- und Passwortaenderungen (ADR 0015).

## Alternativen (verworfen, mit Grund)
- Keycloak als Grundcontainer (ADR 0007): zusaetzlicher Dienst und Betrieb pro Instanz, durch E34 zurueckgestellt.
- Eigenbau Login: Sicherheitsrisiko, widerspricht E28/E31.

## Konsequenzen
- Positiv: ein Container weniger, kein externer IdP fuer die Demo noetig.
- Negativ: Passwortverwaltung liegt bei Planora; Siemens erwartet evtl. SSO [?, 07 Kap. 8 Punkt 1].
- Folgearbeit: Tests lokaler Login (05-tests, 07 Kap. 6): falsche Passwoerter/Rate-Limit, Hashing, Erstadmin, Recovery, Session-Fixation, Timeout/Logout/Sperre/Rollenentzug.
