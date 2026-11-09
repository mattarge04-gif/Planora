# 0024 – Pflicht-Bausteine (Open Source) und Lizenzregeln

Status: akzeptiert (PO-Entscheid E31) · 2026-11-09 · Bezug: E28 ("fertige Bausteine statt Eigenbau"), E7

## Kontext
E28 verlangt fertige Bausteine statt Eigenbau. Abgleich der Recherche-Liste und der awesome-Listen: `06-bausteine-open-source.md`.

## Entscheid
Folgende Bausteine werden in V1 eingebaut; Eigenbau fuer dieselbe Funktion nur mit neuem PO-Entscheid. Versionen im Scaffold pinnen.

| Bereich | Pflicht-Bausteine |
|---|---|
| Dokumente/Upload | Uppy (`@uppy/aws-s3` Multipart), file-type, ClamAV (ADR 0016) |
| Viewer | PDF.js, React PDF Highlighter, Gotenberg, OCRmyPDF, sharp (ADR 0022) |
| Aufbereitung | Docling Serve, exceljs (ADR 0009) |
| Suche | pgvector, PostgreSQL-Volltext, kbar (ADR 0023) |
| Grundriss | react-konva, Zustand, zundo, flatbush (ADR 0014) |
| 3D | three, React Three Fiber, drei (ADR 0008) |
| Frontend | TanStack Table + Virtual, TanStack Query, react-hook-form, zod, i18next/react-i18next, shadcn/ui (Radix) |
| Backend | Fastify, pino, zod, @fastify/rate-limit, Nodemailer + MJML |
| Datenbank | pgTAP (RLS-Tests, CI), Squawk (Migrations-Lint, CI) |
| Betrieb | GlitchTip, Healthchecks, Uptime Kuma, Mailpit (lokal/CI) |
| Sicherheit/Lieferkette | Trivy, Syft, cosign, Gitleaks, Semgrep CE, Renovate, OWASP ZAP (Baseline), license-checker |
| Tests | Playwright, @axe-core/playwright, k6 |
| Uebersetzung | Tolgee (selbst gehostet) |

**Lizenzregeln:**
- Im ausgelieferten Code (Browser, Node): nur MIT, BSD, ISC, Apache-2.0, MPL-2.0 [A, Jurist bestaetigt].
- Eigenstaendige Dienste (ClamAV GPL-2.0, LibreOffice in Gotenberg): unveraendert, eigener Prozess, Lizenzhinweise in On-Prem-Lieferung.
- Nur-CI-Werkzeuge (k6, Renovate AGPL): unkritisch.
- Referenzprojekte (As-Built-Editor, Cutaway, Paperless-ngx, Floor Maker, Hybrid-RAG, DTwin): nur MIT-Code darf mit Lizenzhinweis uebernommen werden; GPL/AGPL/ohne Lizenz nur als Muster.
- SBOM (Syft) + license-checker in CI; Build bricht bei nicht erlaubter Lizenz.

**Nicht ersetzt** (fachlicher Kern bleibt Eigenbau): Rechenkern (ADR 0013), Herkunftsmodell (0012), Audit mit Hash-Kette (0015), KI-Kostenbremse (0017), Mandantentrennung (0010).

## Alternativen
- Eigenbau: widerspricht E28, verlaengert den Weg zur Demo (W7).
- Grosse Plattformen (Paperless-ngx, Suchmaschinen, KI-Gateways) als Basis: Lizenz bzw. zweite Mandantentrennung; siehe 06 Kap. 6.

## Konsequenzen
- + Weniger eigener Code, schnellere Demo, gepruefte Komponenten.
- − Mehr Abhaengigkeiten → Renovate, Trivy und SBOM sind Pflicht, nicht optional.
