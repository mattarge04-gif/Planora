# 0004 – Framework: Vite-SPA + Fastify als Backend-for-Frontend

> **Status ab Welle 4: angepasst (E34–E37, 2026-11-09).**
> [A] React/Vite, Fastify als BFF, Cookie-Session und API-Schema bleiben.
> [A] OIDC-Code-Flow mit Keycloak entfaellt; lokale Authentifizierung nach ADR 0028 (Session-Rotation, Logout/Sperre, CSRF/Origin, Passwort-Reset ohne externe Pflichtdienste).
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: vorgeschlagen · 2026-11-08 · Bezug: E7, FA-30 (Tablet), FA-33..FA-36

## Kontext
3D-lastige Fachanwendung hinter Login, kein SEO-Bedarf. 02-tech Kap. 6 vergleicht Next.js 16.4.5, React Router 8.5.1, Vite 8.3.6 + Fastify 5.12.8, Hono 4.13.17 [F, Q50-Tech].

## Entscheid
- Frontend: **React 19.3 + Vite 8.3 SPA**; 3D mit R3F (ADR 0008).
- Backend: **Fastify 5.12** als einzige HTTP-Schnittstelle in der Rolle **BFF**: Fastify fuehrt den OIDC-Code-Flow mit Keycloak, haelt die Session serverseitig (Tabelle `sitzung`) und gibt dem Browser nur ein `httpOnly; Secure; SameSite=Lax`-Cookie. Keine Access-Tokens im Browser.
- API-Stil: JSON ueber HTTP, versioniert unter `/api/v1`. Ein Schema-Werkzeug (Zod [A: Version im Scaffold pruefen]) ist die einzige Quelle fuer Validierung und Typen. Fehler im Format RFC 9457 (Problem Details).
- CSRF-Schutz: SameSite-Cookie plus Pflicht-Header `X-Planora-Request` fuer alle schreibenden Aufrufe [A].

## Alternativen
- Next.js 16: RSC-/Caching-Eigenheiten bringen Komplexitaet ohne Nutzen; On-Prem schwerer [A, 02 Kap. 6.2].
- React Router 8 (Framework-Modus): moeglich, falls spaeter SSR fuer Verwaltungsseiten gewuenscht.
- Token im Browser (SPA mit PKCE): einfacher, aber Token-Diebstahl per XSS moeglich; Enterprise-Frageboegen bevorzugen serverseitige Sessions [A].

## Konsequenzen
- + Klare Grenze UI/API; die API ist spaeter auch fuer Import-Schnittstellen (E9) nutzbar.
- + Ein Node-Prozesstyp fuer API und Worker.
- − Session-Tabelle und Session-Ablauf muessen selbst gebaut werden (klein).
