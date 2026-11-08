# 0007 – AuthN mit Keycloak, AuthZ in der Planora-Datenbank

Status: vorgeschlagen · 2026-11-08 · Bezug: NFR SSO, FA-03, FA-04, FA-05

## Kontext
Enterprise-Kunden verlangen SSO mit Microsoft Entra ID (OIDC/SAML), sonst E-Mail + MFA (FA-05). FM-Dienstleister-Benutzer arbeiten fuer mehrere Mandanten (FA-03). Keycloak 26.8.2 (Apache-2.0); Zitadel v4 (AGPL-3.0); WorkOS US-SaaS ca. USD 125 pro Verbindung/Monat [F, Q56–Q58-Tech].

## Entscheid
- **Keycloak 26.8** selbst betrieben in CH, **ein Realm** `planora`. Pro Kunde ein Identity-Provider-Eintrag (Entra ID via OIDC, alternativ SAML), Zuordnung per E-Mail-Domain (Home-Realm-Discovery) [A, Spike S9 prueft Organizations-Funktion].
- Lokale Konten (ohne SSO): MFA (TOTP oder WebAuthn) **erzwungen** in Keycloak. Bei SSO-Konten liegt MFA beim Kunden-IdP; Planora verlangt im Vertrag MFA [A].
- Keycloak liefert **nur Identitaet** (`sub`, E-Mail, Name). **Autorisierung** (welcher Mandant, welche Rolle, welche Liegenschaften) steht ausschliesslich in Planora-Tabellen `benutzer` und `mitgliedschaft` (Modul `identitaet`). Keine Rollen aus Keycloak-Gruppen oder Token-Claims.
- Aktiver Mandant ist Teil der Server-Session (FA-03: Wechsel ohne Neuanmeldung); bei jedem Request neu gegen `mitgliedschaft` geprueft.
- Rollen und Rechte: 03 Kap. 9.2.

## Alternativen
- Rollen in Keycloak (Gruppen/Claims): zwei Wahrheiten, Rechteaenderung erst nach Token-Erneuerung wirksam, Audit verteilt → verworfen.
- Zitadel: eleganteres Mandantenmodell, aber AGPL [F, Q57-Tech]; Reserve.
- Better Auth (Bibliothek ohne IdP): schlank, Enterprise-SSO-Reife unklar [?, 02].
- WorkOS: US-SaaS, Kosten [F, Q58-Tech].

## Konsequenzen
- + Eine Quelle fuer Rechte, im Audit-Log, per RLS-Kontext durchsetzbar.
- + On-Prem: Keycloak mitliefern oder Kunden-IdP direkt per OIDC anbinden.
- − JVM-Komponente, ca. 1–2 GB RAM [A, 02], eigene Updates (Sicherheits-Patches innert 14 Tagen [A]).
- − SCIM-Provisionierung nicht in V1 (Benutzer werden beim ersten Login angelegt, Rolle vergibt der Mandanten-Admin).
