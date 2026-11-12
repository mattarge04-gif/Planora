# M2b-1 Sichtbarer Schnitt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login → Gebaeudeliste → 3D-Uebersicht → Klick auf Pin → Seitenpanel, ausgeliefert im bestehenden App-Image.

**Architecture:** Neues Vite/React-Paket unter `app/web/` (im Docker-Build-Kontext `app/`). Fastify liefert `web/dist` per `@fastify/static` unter `/` aus, mit SPA-Fallback; `/api` bleibt unberuehrt. Frontend-Logik (Szene- und Panel-Daten) in reinen, getesteten Funktionen; React/R3F-Komponenten zeichnen nur.

**Tech Stack:** React 19.3.1, three 0.187.0, @react-three/fiber 9.8.2, Vite 8.3.8, @vitejs/plugin-react 6.3.0, Vitest 5.1.0, TypeScript 7.0.2, Fastify 5 + @fastify/static 10.1.10.

**Spec:** `docs/superpowers/specs/2026-11-11-m2b1-sichtbarer-schnitt-design.md`

## Fortsetzung 12.11.2026

Claude hat Tasks 1–5 committet (bis `376885d`) und Task 6 begonnen. Codex hat Task 6 vervollstaendigt und Task 7 umgesetzt. Die historischen Schritt-Checkboxen unten sind keine nachtraegliche Behauptung ausgefuehrter Red/Green-Schritte.

- Backend: 402 Tests bestanden, Typpruefung bestanden.
- Frontend: 19 Tests bestanden, Produktionsbuild bestanden (Vite meldet das grosse Three.js-Bundle).
- Lokaler Entwicklungsstart und Sichtpruefung per Playwright bestanden: Login, Liste, 2 Geschosse / 5 Einheiten / 8 Symbole, Verteiler-Picking, Panel mit Restaurant (EG) und Buero C (OG1). Keine CSP-Verletzungen; erwartetes initiales 401 auf `/api/ich`, Three.Clock-Deprecation im R3F-Abhaengigkeitsbaum.
- Task 6 ergaenzt: Der Docker-Update-Test kopiert jetzt auch `web/` ohne `node_modules`/`dist`; der erste Lauf fand hier den fehlenden Build-Kontext. Abnahme-Bundle und Dossier-Aufruf reichen das Web-Lockfile weiter.
- Task 7 verwendet ein frisches temporaeres Datenverzeichnis statt rekursiv ein festes Verzeichnis zu loeschen. Startfehler schliessen Server, Pool und gestartetes PostgreSQL. Ports sind konfigurierbar, Produktion ist gesperrt.
- Docker: erster Lauf 27 bestanden, Update-Suite wegen fehlendem Web-Kontext fehlgeschlagen; korrigierter Update-Lauf 6/6 bestanden (207.73 s). Damit alle 33 Tests der aktiven Docker-Suites bestanden; Suite B separat nicht wiederholt.
- Tagesabschluss: Commit und Push auf dem Arbeitsbranch beauftragt, kein Merge oder produktives Deployment. E40 und [Design-Nachtrag](../../design/2026-11-12-visuelle-zielrichtung.md) sind der Einstieg fuer die naechste Sitzung; +6–10 PT Zusatzaufwand [A], Planungswert +8 PT. WSL-/CH-VM-Gesamtabnahme und vollstaendige SBOM-Neuerzeugung nicht wiederholt.

## Global Constraints

- Sprache in Code, Kommentaren und UI-Texten: Deutsch (de-CH), kein Eszett, immer `ss`, Umlaute als ae/oe/ue.
- Exakte Versionen (nachgeschlagen 2026-11-12 per `npm view`, alle MIT ausser TypeScript Apache-2.0, nur Build): `react`/`react-dom` 19.3.1, `three` 0.187.0, `@react-three/fiber` 9.8.2, `vite` 8.3.8, `@vitejs/plugin-react` 6.3.0, `vitest` 5.1.0, `typescript` 7.0.2, `@types/react`/`@types/react-dom` 19.3.0, `@types/three` 0.187.0, `@fastify/static` 10.1.10. Keine weiteren Pakete, insbesondere kein `@react-three/drei`, keine UI-Bibliothek, kein Router.
- Frontend liegt unter **`app/web/`** (nicht Repo-Wurzel): Der Docker-Build-Kontext ist `app/` (`app/.dockerignore`, `betrieb/abnahme/abnahme.ps1`, `test-docker/paket-hilfe.ts`).
- Gestaltung schlicht: Systemschrift, Farben Hintergrund `#f4f5f7`, Text `#1f2937`, Linien `#475569`, Glas `#9fb7c9` (Deckkraft 0.22), Pins Zentrale `#c2410c`, Verteilung `#2563eb`, Einheit `#059669`, Auswahl `#f59e0b`; `vorgeschlagen` = Pinfarbe 55 % zu Weiss aufgehellt.
- CSP fuer Seite und Assets: `default-src 'self'; img-src 'self' data: blob:; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` (ohne `unsafe-inline`; React setzt Stile per CSSOM).
- Jede `/api`-Route muss einem Modul gehoeren (`src/module/manifest.ts`): neue Routen unter `/api/struktur/` und `/api/katalog/`.
- Mutierende API-Aufrufe aus dem Frontend senden `x-planora-request: 1` (Origin setzt der Browser).
- Alle `app`-Befehle in `app/`, alle Frontend-Befehle in `app/web/`. Commits enden mit `Co-Authored-By: <tatsaechliches Modell> <noreply@anthropic.com>`. Branch `m2b1-sichtbarer-schnitt`.

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `app/src/welt/routen.ts` (aendern) | + `GET /api/struktur/gebaeude`, `GET /api/katalog/v1` |
| `app/src/server.ts` (aendern) | Fehlerformat 400, Option `webWurzel`, Aufruf `registriereWeb` |
| `app/src/web.ts` | statische Auslieferung, CSP, Caching, SPA-Fallback |
| `app/src/start/api.ts` (aendern) | `PLANORA_WEB_DIR` → `webWurzel` |
| `app/vitest.config.ts` (aendern) | nur `test/**` (Frontend-Tests laufen in `web/`) |
| `app/web/*` | Vite-Projekt: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/**` |
| `app/web/src/typen.ts` | Spiegel der benoetigten Typen aus `app/src/welt/typen.ts` |
| `app/web/src/api.ts` | fetch-Hilfen, Fehlertexte |
| `app/web/src/szene/daten.ts`, `Szene.tsx` | Welt → Zeichendaten; R3F-Szene |
| `app/web/src/panel/daten.ts`, `Panel.tsx` | Panel-Daten; Panel |
| `app/web/src/seiten/*.tsx`, `App.tsx`, `main.tsx`, `stil.css` | Seiten und Zustand |
| `app/Dockerfile`, `app/.dockerignore` (aendern) | Stufe `web-bau`, Kontext |
| `app/src/betrieb/dossier.ts` (aendern) | optionales zweites Lockfile |
| `app/entwicklung/start.ts` | lokaler Start mit Beispieldaten (nicht im Image) |

---

### Task 1: Backend – Gebaeudeliste, Katalog-Endpunkt, einheitliches 400-Format

**Files:**
- Modify: `app/src/welt/routen.ts`, `app/src/server.ts`
- Test: `app/test/m2b-api.test.ts`

**Interfaces:**
- Produces: `GET /api/struktur/gebaeude` → `{ id: string; name: string; liegenschaftId: string; liegenschaftName: string; geschosse: number }[]`; `GET /api/katalog/v1` → `{ version: number; eintraege: { id: string; name: string; bereich: "zentrale" | "verteilung" | "einheit" }[] }`; Schemafehler → `400 { fehler: { pfad: string; code: "struktur_ungueltig"; meldung: string }[] }` mit `pfad = <body|params|querystring><instancePath>` (z.B. `body/bauteile/0/status`).

- [ ] **Step 1: Failing Test schreiben** – `app/test/m2b-api.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

const ORIGIN = "http://localhost:3996";
const pw = randomBytes(12).toString("base64url");
const HUELLE = { name: "Haus", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
let L1: string, L2: string, kAdmin: string, kBetr: string, kLeser: string, G1: string, G2: string;

const anfrage = (method: "GET" | "POST" | "PUT", url: string, cookie: string, body?: unknown) => app.inject({
  method, url,
  headers: { cookie, origin: ORIGIN, "x-planora-request": "1", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
  payload: body !== undefined ? JSON.stringify(body) : undefined,
});
const cookieVon = (r: any) => ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
async function konto(email: string, rolle: string, scopes: string[]) {
  const { benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), email, email, pw);
  await db.pool.query("update rolle_zuordnung set rolle=$2 where benutzer_id=$1", [benutzerId, rolle]);
  for (const l of scopes) await db.pool.query("insert into rolle_liegenschaft(benutzer_id, liegenschaft_id) values ($1,$2)", [benutzerId, l]);
  const r = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { "content-type": "application/json", origin: ORIGIN }, payload: JSON.stringify({ email, password: pw }) });
  expect(r.statusCode).toBe(200);
  return cookieVon(r);
}

beforeAll(async () => {
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 2, baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('B-Liegenschaft') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('A-Liegenschaft') returning id")).rows[0].id;
  kAdmin = await konto("admin@planora.invalid", "admin", []);
  kBetr = await konto("betrieb@planora.invalid", "betreiber", []);
  kLeser = await konto("leser@planora.invalid", "leser", [L1]);
  G1 = (await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, HUELLE)).json().id;
  G2 = (await anfrage("POST", `/api/struktur/liegenschaften/${L2}/gebaeude`, kBetr, { ...HUELLE, name: "Annex", geschosse: [{ code: "EG" }] })).json().id;
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("GET /api/struktur/gebaeude", () => {
  it("Admin sieht alle, sortiert nach Liegenschaft und Name", async () => {
    const r = await anfrage("GET", "/api/struktur/gebaeude", kAdmin);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual([
      { id: G2, name: "Annex", liegenschaftId: L2, liegenschaftName: "A-Liegenschaft", geschosse: 1 },
      { id: G1, name: "Haus", liegenschaftId: L1, liegenschaftName: "B-Liegenschaft", geschosse: 2 },
    ]);
  });
  it("Leser sieht nur seine Liegenschaft", async () => {
    expect((await anfrage("GET", "/api/struktur/gebaeude", kLeser)).json().map((g: any) => g.id)).toEqual([G1]);
  });
  it("Betreiber sieht keine Fachdaten", async () => {
    expect((await anfrage("GET", "/api/struktur/gebaeude", kBetr)).json()).toEqual([]);
  });
  it("ohne Sitzung 401", async () => {
    expect((await app.inject({ url: "/api/struktur/gebaeude" })).statusCode).toBe(401);
  });
});

describe("GET /api/katalog/v1", () => {
  it("liefert IDs, Namen und Bereich", async () => {
    const r = await anfrage("GET", "/api/katalog/v1", kLeser);
    expect(r.statusCode).toBe(200);
    const k = r.json();
    expect(k.version).toBe(1);
    expect(k.eintraege).toHaveLength(10);
    expect(k.eintraege.find((e: any) => e.id === "heizung.verteiler")).toEqual({ id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung" });
  });
  it("ohne Sitzung 401", async () => {
    expect((await app.inject({ url: "/api/katalog/v1" })).statusCode).toBe(401);
  });
});

describe("Fehlerformat 400", () => {
  it("Schemafehler im Body als {fehler} mit Pfad", async () => {
    const b = (await anfrage("GET", `/api/struktur/gebaeude/${G1}/beschreibung`, kAdmin)).json();
    const r = await anfrage("PUT", `/api/struktur/gebaeude/${G1}/beschreibung`, kAdmin, { ...b, stand: "x" });
    expect(r.statusCode).toBe(400);
    expect(r.json().fehler[0]).toMatchObject({ pfad: "body/stand", code: "struktur_ungueltig" });
    expect(typeof r.json().fehler[0].meldung).toBe("string");
  });
  it("Schemafehler in Params", async () => {
    const r = await anfrage("GET", "/api/struktur/gebaeude/keine-uuid/beschreibung", kAdmin);
    expect(r.statusCode).toBe(400);
    expect(r.json().fehler[0]).toMatchObject({ pfad: "params/id", code: "struktur_ungueltig" });
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag pruefen**

Run: `npx vitest run test/m2b-api.test.ts`
Expected: FAIL (Liste/Katalog 404 bzw. 501, Fehlerformat anders).

- [ ] **Step 3: Routen ergaenzen** – in `app/src/welt/routen.ts` innerhalb von `registriereWeltRouten`, nach den bestehenden Routen; Imports `MATRIX, type Rolle` aus `../rechte/rechte.js` ergaenzen:

```ts
  /** Gebaeude, die der Benutzer lesen darf; Betreiber und Benutzer ohne Fachrecht erhalten eine leere Liste. */
  app.get("/api/struktur/gebaeude", async (req) => mitClient(async (c) => {
    const benutzerId = req.kontext!.benutzerId;
    const rolle = (await c.query("select rolle from rolle_zuordnung where benutzer_id=$1", [benutzerId])).rows[0]?.rolle as Rolle | undefined;
    if (!rolle || !MATRIX["fach.lesen"].includes(rolle)) return [];
    const r = await c.query(
      `select g.id, g.name, l.id liegenschaft_id, l.name liegenschaft_name,
              (select count(*)::int from geschoss s where s.gebaeude_id = g.id) geschosse
         from gebaeude g join liegenschaft l on l.id = g.liegenschaft_id
        where $2::boolean or exists (select 1 from rolle_liegenschaft r where r.benutzer_id = $1 and r.liegenschaft_id = g.liegenschaft_id)
        order by l.name, g.name, g.id`, [benutzerId, rolle === "admin"]);
    return r.rows.map((x) => ({ id: x.id, name: x.name, liegenschaftId: x.liegenschaft_id, liegenschaftName: x.liegenschaft_name, geschosse: x.geschosse }));
  }));

  /** Katalog fuer die Anzeige (Namen statt IDs). */
  app.get("/api/katalog/v1", async () => ({
    version: KATALOG_V1.version,
    eintraege: KATALOG_V1.eintraege.map(({ id, name, bereich }) => ({ id, name, bereich })),
  }));
```

Hinweis: Die Sortierung `order by l.name, g.name, g.id` ist deterministisch; die Admin-Regel entspricht `pruefe()` (Admin liest alle Liegenschaften).

- [ ] **Step 4: Fehlerformat** – in `app/src/server.ts` direkt nach `const app = Fastify(...)`:

```ts
  // Einheitliches Fehlerformat fuer Schemafehler (M2b-1 Spec §4.3): wie fachliche Fehler { fehler: [{ pfad, code, meldung }] }.
  app.setErrorHandler((err, _req, reply) => {
    if (err.validation) {
      return reply.code(400).send({
        fehler: err.validation.map((v) => ({ pfad: `${err.validationContext ?? "body"}${v.instancePath ?? ""}`, code: "struktur_ungueltig", meldung: v.message ?? "ungueltig" })),
      });
    }
    throw err; // alle anderen Fehler wie bisher (Fastify-Standard)
  });
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run test/m2b-api.test.ts test/welt-api.test.ts test/server.test.ts`
Expected: PASS. Pruefen, ob ein bestehender Test den alten 400-Text (`message`) erwartet: `grep -rn "\.message\|FST_ERR_VALIDATION" test` — falls ja, auf `fehler` umstellen und im Bericht nennen.

- [ ] **Step 6: Gesamtsuite und Typen**

Run: `npm test` und `npm run pruefe:typen`
Expected: alles gruen.

- [ ] **Step 7: Commit**

```bash
git add app/src/welt/routen.ts app/src/server.ts app/test/m2b-api.test.ts
git commit -m "M2b-1: Gebaeudeliste, Katalog-Endpunkt, einheitliches 400-Format"
```

---

### Task 2: Backend – statische Auslieferung

**Files:**
- Create: `app/src/web.ts`
- Modify: `app/src/server.ts` (Option + Aufruf), `app/src/start/api.ts`, `app/package.json` (+ `@fastify/static` 10.1.10), `app/vitest.config.ts`
- Test: `app/test/web-auslieferung.test.ts`

**Interfaces:**
- Consumes: `baueServer(o: ServerOptionen)`.
- Produces: `ServerOptionen.webWurzel?: string`; `registriereWeb(app: FastifyInstance, wurzel: string): Promise<void>`; Konstante `WEB_CSP`.

- [ ] **Step 1: Abhaengigkeit** – `npm install --save-exact @fastify/static@10.1.10` in `app/`.

- [ ] **Step 2: Vitest auf `test/` beschraenken** – `app/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/**/*.test.ts"], globalSetup: ["./test/globalSetup.ts"], testTimeout: 30000, hookTimeout: 60000, fileParallelism: false } });
```

- [ ] **Step 3: Failing Test schreiben** – `app/test/web-auslieferung.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { WEB_CSP } from "../src/web.js";

let db: Awaited<ReturnType<typeof frischeDb>>; let mitWeb: FastifyInstance; let ohneWeb: FastifyInstance;
const INDEX = '<!doctype html><html><body><div id="app"></div></body></html>';

beforeAll(async () => {
  db = await frischeDb();
  const wurzel = mkdtempSync(join(tmpdir(), "web-"));
  writeFileSync(join(wurzel, "index.html"), INDEX);
  mkdirSync(join(wurzel, "assets"));
  writeFileSync(join(wurzel, "assets", "index-abc123.js"), "console.log(1)");
  const basis = { pool: db.pool, stufe: 2 as const, baseURL: "http://localhost:3995", secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) };
  mitWeb = await baueServer({ ...basis, webWurzel: wurzel });
  ohneWeb = await baueServer({ ...basis, webWurzel: join(tmpdir(), "gibt-es-nicht-" + randomBytes(4).toString("hex")) });
});
afterAll(async () => { await mitWeb.close(); await ohneWeb.close(); await db.ende(); });

describe("Auslieferung Frontend", () => {
  it("GET / liefert index.html mit CSP und no-cache", async () => {
    const r = await mitWeb.inject({ url: "/" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/html/);
    expect(r.body).toContain('<div id="app">');
    expect(r.headers["content-security-policy"]).toBe(WEB_CSP);
    expect(r.headers["cache-control"]).toBe("no-cache");
  });
  it("unbekannter Seitenpfad faellt auf index.html zurueck", async () => {
    const r = await mitWeb.inject({ url: "/gebaeude/irgendwas" });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('<div id="app">');
    expect(r.headers["content-security-policy"]).toBe(WEB_CSP);
  });
  it("Assets mit Hash sind lange cachebar", async () => {
    const r = await mitWeb.inject({ url: "/assets/index-abc123.js" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });
  it("unbekannte API-Pfade bleiben 404 JSON, nicht index.html", async () => {
    const r = await mitWeb.inject({ url: "/api/gibt-es-nicht" });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ fehler: "nicht gefunden" });
  });
  it("nicht-GET auf Seitenpfade ergibt 404", async () => {
    expect((await mitWeb.inject({ method: "POST", url: "/irgendwas" })).statusCode).toBe(404);
  });
  it("API laeuft unveraendert", async () => {
    expect((await mitWeb.inject({ url: "/api/health" })).statusCode).toBe(200);
    expect((await mitWeb.inject({ url: "/api/ich" })).statusCode).toBe(401);
  });
  it("ohne Web-Verzeichnis keine Auslieferung", async () => {
    expect((await ohneWeb.inject({ url: "/" })).statusCode).toBe(404);
    expect((await ohneWeb.inject({ url: "/api/health" })).statusCode).toBe(200);
  });
});
```

Run: `npx vitest run test/web-auslieferung.test.ts` → FAIL (Modul `web.js` fehlt).

- [ ] **Step 4: `app/src/web.ts`**

```ts
import { existsSync } from "node:fs";
import { join, sep } from "node:path";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

/** CSP fuer die ausgelieferte Seite (M2b-1 Spec §4.4), ohne unsafe-inline: React setzt Stile per CSSOM. */
export const WEB_CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const LANG = "public, max-age=31536000, immutable";

/** Liefert das gebaute Frontend aus; nur wenn <wurzel>/index.html existiert. /api bleibt unberuehrt. */
export async function registriereWeb(app: FastifyInstance, wurzel: string): Promise<boolean> {
  if (!existsSync(join(wurzel, "index.html"))) return false;
  await app.register(fastifyStatic, {
    root: wurzel,
    prefix: "/",
    index: ["index.html"],
    setHeaders(res, pfad) {
      res.setHeader("content-security-policy", WEB_CSP);
      res.setHeader("cache-control", pfad.includes(`${sep}assets${sep}`) ? LANG : "no-cache");
    },
  });
  app.setNotFoundHandler((req, reply) => {
    const pfad = req.url.split("?", 1)[0];
    const istSeite = (req.method === "GET" || req.method === "HEAD") && pfad !== "/api" && !pfad.startsWith("/api/");
    if (!istSeite) return reply.code(404).send({ fehler: "nicht gefunden" });
    return reply.header("content-security-policy", WEB_CSP).header("cache-control", "no-cache").type("text/html; charset=utf-8").sendFile("index.html");
  });
  return true;
}
```

Hinweis: `sendFile` ruft `setHeaders` ebenfalls auf; die expliziten Header im Fallback stellen sicher, dass CSP und `no-cache` auch dort sicher gesetzt sind. Der Modul-Guard (`registriereModulGuard`) und die Sitzungsregeln greifen nur bei Routen, die mit `/api` beginnen; die Static-Route `/*` ist davon nicht betroffen.

- [ ] **Step 5: Server und Start** – `app/src/server.ts`:
  - `ServerOptionen` um `webWurzel?: string` ergaenzen (Kommentar: "gebautes Frontend; fehlt das Verzeichnis, wird nichts ausgeliefert").
  - Import `import { registriereWeb } from "./web.js";`
  - Direkt **nach** der Platzhalter-Schleife fuer Fachmodule und vor `return app;`: `if (o.webWurzel) await registriereWeb(app, o.webWurzel);`

  `app/src/start/api.ts`: im `baueServer`-Aufruf `webWurzel: env("PLANORA_WEB_DIR", "/app/web"),` ergaenzen.

- [ ] **Step 6: Tests**

Run: `npx vitest run test/web-auslieferung.test.ts test/server.test.ts test/module-guard.test.ts`, dann `npm test` und `npm run pruefe:typen`
Expected: alles gruen. Schlaegt "unbekannte API-Pfade" fehl, weil `@fastify/static` selbst 404 sendet statt `callNotFound`: Option `wildcard: false` ist **nicht** die Loesung (dann fehlt der SPA-Fallback fuer Assets nicht, aber fuer Seitenpfade); stattdessen Verhalten mit `app.inject` pruefen und im Bericht genau beschreiben.

- [ ] **Step 7: Commit**

```bash
git add app/src/web.ts app/src/server.ts app/src/start/api.ts app/package.json app/package-lock.json app/vitest.config.ts app/test/web-auslieferung.test.ts
git commit -m "M2b-1: Frontend-Auslieferung mit CSP, Caching und SPA-Fallback"
```

---

### Task 3: Frontend-Geruest – Projekt, API-Hilfen, Login, Gebaeudeliste

**Files:**
- Create: `app/web/package.json`, `app/web/vite.config.ts`, `app/web/tsconfig.json`, `app/web/index.html`, `app/web/.gitignore`, `app/web/src/main.tsx`, `app/web/src/App.tsx`, `app/web/src/stil.css`, `app/web/src/typen.ts`, `app/web/src/api.ts`, `app/web/src/seiten/Login.tsx`, `app/web/src/seiten/Liste.tsx`, `app/web/src/seiten/Ansicht.tsx` (Platzhalter, in Task 5 ersetzt)
- Test: `app/web/src/api.test.ts`

**Interfaces:**
- Produces: `fehlerMeldungen(j: unknown): string[]`; `class ApiFehler extends Error { status: number; meldungen: string[] }`; `holeJson<T>(pfad: string): Promise<T>`; `sendeJson<T>(pfad: string, body: unknown): Promise<T>`; `loginFehlertext(status: number): string`; Typen in `typen.ts` (siehe Step 4); `App` mit Zustaenden `laden | login | liste | ansicht(gebaeudeId, name)`; Komponente `Ansicht({ gebaeudeId, name, onZurueck })`.

- [ ] **Step 1: Projektdateien**

`app/web/package.json`:
```json
{
  "name": "planora-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p tsconfig.json && vite build",
    "test": "vitest run",
    "pruefe:typen": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@react-three/fiber": "9.8.2",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "three": "0.187.0"
  },
  "devDependencies": {
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@types/three": "0.187.0",
    "@vitejs/plugin-react": "6.3.0",
    "typescript": "7.0.2",
    "vite": "8.3.8",
    "vitest": "5.1.0"
  }
}
```
Dann `npm install` in `app/web/` (erzeugt `package-lock.json`, mitcommitten).

`app/web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Entwicklung: /api an Fastify (Standard http://localhost:3000). Origin wird auf das Ziel gesetzt, damit die
// Origin-/CSRF-Pruefung von Planora und Better Auth wie im Betrieb (gleiche Herkunft) greift.
const ziel = process.env.PLANORA_API ?? "http://localhost:3000";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: ziel, configure: (proxy) => proxy.on("proxyReq", (anfrage) => anfrage.setHeader("origin", ziel)) } },
  },
  build: { outDir: "dist", assetsDir: "assets", sourcemap: false },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```
Falls `test` im `defineConfig` von Vite typseitig nicht akzeptiert wird: `/// <reference types="vitest/config" />` als erste Zeile ergaenzen.

`app/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`app/web/index.html`:
```html
<!doctype html>
<html lang="de-CH">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Planora</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`app/web/.gitignore`:
```
node_modules/
dist/
```

`app/.dockerignore` bleibt in diesem Task unveraendert (Task 6).

- [ ] **Step 2: Failing Test** – `app/web/src/api.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { fehlerMeldungen, loginFehlertext } from "./api";

describe("fehlerMeldungen", () => {
  it("liest Planora-Fehlerlisten", () => {
    expect(fehlerMeldungen({ fehler: [{ pfad: "body/stand", code: "struktur_ungueltig", meldung: "muss Zahl sein" }] })).toEqual(["muss Zahl sein"]);
  });
  it("liest einfache Fehlertexte", () => {
    expect(fehlerMeldungen({ fehler: "nicht gefunden" })).toEqual(["nicht gefunden"]);
  });
  it("liest Better-Auth-Meldungen", () => {
    expect(fehlerMeldungen({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" })).toEqual(["Invalid email or password"]);
  });
  it("leer bei Unbekanntem", () => {
    expect(fehlerMeldungen(null)).toEqual([]);
    expect(fehlerMeldungen("x")).toEqual([]);
  });
});

describe("loginFehlertext", () => {
  it("uebersetzt Statuscodes", () => {
    expect(loginFehlertext(401)).toBe("E-Mail oder Passwort falsch.");
    expect(loginFehlertext(403)).toBe("Konto gesperrt oder noch nicht freigegeben.");
    expect(loginFehlertext(429)).toBe("Zu viele Versuche. Bitte spaeter erneut versuchen.");
    expect(loginFehlertext(500)).toBe("Anmeldung fehlgeschlagen (Status 500).");
  });
});
```

Run (in `app/web/`): `npx vitest run` → FAIL (Modul `./api` fehlt).

- [ ] **Step 3: `app/web/src/api.ts`**

```ts
/** Fehler einer API-Antwort mit Status und lesbaren Meldungen. */
export class ApiFehler extends Error {
  readonly status: number;
  readonly meldungen: string[];
  constructor(status: number, meldungen: string[]) {
    super(meldungen.join(" ") || `Fehler ${status}`);
    this.status = status;
    this.meldungen = meldungen;
  }
}

/** Meldungen aus Planora-Fehlern ({ fehler: [...] } oder { fehler: "..." }) und Better-Auth ({ message }). */
export function fehlerMeldungen(j: unknown): string[] {
  if (j === null || typeof j !== "object") return [];
  const o = j as { fehler?: unknown; message?: unknown };
  if (Array.isArray(o.fehler)) return o.fehler.map((f) => (f && typeof f === "object" && typeof (f as { meldung?: unknown }).meldung === "string" ? (f as { meldung: string }).meldung : "")).filter(Boolean);
  if (typeof o.fehler === "string") return [o.fehler];
  if (typeof o.message === "string") return [o.message];
  return [];
}

export function loginFehlertext(status: number): string {
  if (status === 401) return "E-Mail oder Passwort falsch.";
  if (status === 403) return "Konto gesperrt oder noch nicht freigegeben.";
  if (status === 429) return "Zu viele Versuche. Bitte spaeter erneut versuchen.";
  return `Anmeldung fehlgeschlagen (Status ${status}).`;
}

async function anfrage<T>(methode: "GET" | "POST", pfad: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (methode !== "GET") headers["x-planora-request"] = "1";
  const r = await fetch(pfad, { method: methode, credentials: "same-origin", headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    let j: unknown = null;
    try { j = await r.json(); } catch { /* kein JSON */ }
    throw new ApiFehler(r.status, fehlerMeldungen(j));
  }
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const holeJson = <T,>(pfad: string) => anfrage<T>("GET", pfad);
export const sendeJson = <T,>(pfad: string, body: unknown) => anfrage<T>("POST", pfad, body);
```

- [ ] **Step 4: `app/web/src/typen.ts`** (Spiegel von `app/src/welt/typen.ts`, nur was das Frontend braucht)

```ts
// Spiegel der API-Typen aus app/src/welt/typen.ts (Welt, Beschreibung). Bei Aenderungen dort hier nachziehen.
export type BauteilStatus = "vorgeschlagen" | "bestaetigt";
export interface Rechteck { x: number; z: number; breite: number; tiefe: number }
export interface Hinweis { code: string; bezug: string }
export interface WeltSymbol {
  schluessel: string; katalogId: string; hersteller: string | null; typ: string | null;
  bauteilIds: string[]; mengeSumme: number; mengeUnbekannt: boolean; status: BauteilStatus;
  position: { x: number; y: number; z: number }; versorgt: string[];
}
export interface Welt {
  regelwerkVersion: number; hash: string; grundriss: Rechteck[];
  geschosse: { id: string; code: string; yUnten: number; hoehe: number }[];
  einheiten: { id: string; geschossId: string; bezeichnung: string; art: string; rechteck: Rechteck; quelle: "schematisch" | "manuell" }[];
  symbole: WeltSymbol[]; hinweise: Hinweis[];
}
export interface BauteilZeile {
  id?: string; katalogId: string; standort: { einheitId?: string; geschossId?: string };
  menge: number | null; status: BauteilStatus; hersteller?: string | null; typ?: string | null; baujahr?: number | null;
}
export interface Beschreibung { gebaeudeId: string; stand: number; bauteile: BauteilZeile[]; hinweise?: Hinweis[] }
export interface KatalogEintrag { id: string; name: string; bereich: "zentrale" | "verteilung" | "einheit" }
export interface Katalog { version: number; eintraege: KatalogEintrag[] }
export interface GebaeudeEintrag { id: string; name: string; liegenschaftId: string; liegenschaftName: string; geschosse: number }
```

- [ ] **Step 5: Seiten und App**

`app/web/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./stil.css";

createRoot(document.getElementById("app")!).render(<StrictMode><App /></StrictMode>);
```

`app/web/src/App.tsx`:
```tsx
import { useEffect, useState } from "react";
import { holeJson, sendeJson } from "./api";
import { Login } from "./seiten/Login";
import { Liste } from "./seiten/Liste";
import { Ansicht } from "./seiten/Ansicht";

type Zustand = { art: "laden" } | { art: "login" } | { art: "liste" } | { art: "ansicht"; gebaeudeId: string; name: string };

export function App() {
  const [zustand, setZustand] = useState<Zustand>({ art: "laden" });
  useEffect(() => {
    holeJson("/api/ich").then(() => setZustand({ art: "liste" }), () => setZustand({ art: "login" }));
  }, []);
  const abmelden = async () => {
    try { await sendeJson("/api/auth/sign-out", {}); } finally { setZustand({ art: "login" }); }
  };
  if (zustand.art === "laden") return <p className="status">Laden …</p>;
  if (zustand.art === "login") return <Login onAngemeldet={() => setZustand({ art: "liste" })} />;
  return (
    <div className="rahmen">
      <header className="kopf">
        <strong>Planora</strong>
        {zustand.art === "ansicht" && <><button className="link" onClick={() => setZustand({ art: "liste" })}>← Gebaeude</button><span>{zustand.name}</span></>}
        <span className="abstand" />
        <button className="link" onClick={abmelden}>Abmelden</button>
      </header>
      {zustand.art === "liste"
        ? <Liste onWahl={(g) => setZustand({ art: "ansicht", gebaeudeId: g.id, name: g.name })} />
        : <Ansicht gebaeudeId={zustand.gebaeudeId} />}
    </div>
  );
}
```

`app/web/src/seiten/Login.tsx`:
```tsx
import { useState, type FormEvent } from "react";
import { ApiFehler, loginFehlertext, sendeJson } from "../api";

export function Login({ onAngemeldet }: { onAngemeldet: () => void }) {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const senden = async (e: FormEvent) => {
    e.preventDefault(); setFehler(null); setLaeuft(true);
    try { await sendeJson("/api/auth/sign-in/email", { email, password: passwort }); onAngemeldet(); }
    catch (x) { setFehler(x instanceof ApiFehler ? loginFehlertext(x.status) : "Server nicht erreichbar."); }
    finally { setLaeuft(false); }
  };
  return (
    <main className="login">
      <form onSubmit={senden} className="karte">
        <h1>Planora</h1>
        <label>E-Mail<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Passwort<input type="password" autoComplete="current-password" required value={passwort} onChange={(e) => setPasswort(e.target.value)} /></label>
        {fehler && <p className="fehler" role="alert">{fehler}</p>}
        <button type="submit" disabled={laeuft}>{laeuft ? "Anmelden …" : "Anmelden"}</button>
      </form>
    </main>
  );
}
```

`app/web/src/seiten/Liste.tsx`:
```tsx
import { useEffect, useState } from "react";
import { holeJson } from "../api";
import type { GebaeudeEintrag } from "../typen";

export function Liste({ onWahl }: { onWahl: (g: GebaeudeEintrag) => void }) {
  const [liste, setListe] = useState<GebaeudeEintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => { holeJson<GebaeudeEintrag[]>("/api/struktur/gebaeude").then(setListe, (e: Error) => setFehler(e.message)); }, []);
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>;
  if (!liste) return <p className="status">Laden …</p>;
  if (liste.length === 0) return <p className="status">Noch keine Gebaeude erfasst.</p>;
  return (
    <main className="liste">
      <h2>Gebaeude</h2>
      <table>
        <thead><tr><th>Liegenschaft</th><th>Gebaeude</th><th>Geschosse</th></tr></thead>
        <tbody>
          {liste.map((g) => (
            <tr key={g.id}>
              <td>{g.liegenschaftName}</td>
              <td><button className="link" onClick={() => onWahl(g)}>{g.name}</button></td>
              <td>{g.geschosse}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

`app/web/src/seiten/Ansicht.tsx` (Platzhalter bis Task 5):
```tsx
export function Ansicht({ gebaeudeId }: { gebaeudeId: string }) {
  return <p className="status">Ansicht {gebaeudeId} folgt.</p>;
}
```

`app/web/src/stil.css`:
```css
:root { --hg: #f4f5f7; --text: #1f2937; --linie: #d1d5db; --akzent: #2563eb; --fehler: #b91c1c; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--text); background: var(--hg); }
* { box-sizing: border-box; }
body { margin: 0; }
button { font: inherit; padding: 0.45rem 0.9rem; border: 1px solid var(--linie); border-radius: 6px; background: #fff; cursor: pointer; }
button:disabled { opacity: 0.6; cursor: default; }
button.link { border: none; background: none; color: var(--akzent); padding: 0.2rem 0.4rem; }
input { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--linie); border-radius: 6px; width: 100%; }
label { display: grid; gap: 0.3rem; font-size: 0.9rem; }
.status { padding: 2rem; color: #6b7280; }
.fehler { color: var(--fehler); margin: 0; }
.login { min-height: 100vh; display: grid; place-items: center; }
.karte { background: #fff; border: 1px solid var(--linie); border-radius: 10px; padding: 2rem; width: min(360px, 92vw); display: grid; gap: 1rem; }
.karte h1 { margin: 0; font-size: 1.4rem; }
.rahmen { height: 100vh; display: grid; grid-template-rows: auto 1fr; }
.kopf { display: flex; align-items: center; gap: 0.8rem; padding: 0.6rem 1rem; background: #fff; border-bottom: 1px solid var(--linie); }
.abstand { flex: 1; }
.liste { padding: 1.5rem; }
.liste table { border-collapse: collapse; background: #fff; min-width: 480px; }
.liste th, .liste td { text-align: left; padding: 0.5rem 0.8rem; border-bottom: 1px solid var(--linie); }
```

- [ ] **Step 6: Tests, Typen, Build**

Run in `app/web/`: `npx vitest run` (PASS, 5 Tests), `npm run pruefe:typen` (Exit 0), `npm run build` (erzeugt `dist/index.html` und `dist/assets/*`).

- [ ] **Step 7: Commit**

```bash
git add app/web
git commit -m "M2b-1: Frontend-Geruest mit Login und Gebaeudeliste"
```

---

### Task 4: Szene-Daten (reine Funktionen)

**Files:**
- Create: `app/web/src/szene/daten.ts`
- Test: `app/web/src/szene/daten.test.ts`

**Interfaces:**
- Consumes: `Welt`, `KatalogEintrag` aus `typen.ts`.
- Produces:
  - `FARBEN = { zentrale: "#c2410c", verteilung: "#2563eb", einheit: "#059669", auswahl: "#f59e0b" }`
  - `aufhellen(hex: string, anteil = 0.55): string`
  - `interface SzenePlatte { mitte: [number, number, number]; breite: number; tiefe: number }`
  - `interface SzeneBeschriftung { text: string; position: [number, number, number]; groesse: number }`
  - `interface SzenePin { schluessel: string; position: [number, number, number]; farbe: string; name: string }`
  - `interface SzeneDaten { platten: SzenePlatte[]; linien: Float32Array; beschriftungen: SzeneBeschriftung[]; pins: SzenePin[]; kamera: { ziel: [number, number, number]; radius: number } }`
  - `szeneDaten(welt: Welt, katalog: KatalogEintrag[]): SzeneDaten`

- [ ] **Step 1: Failing Test** – `app/web/src/szene/daten.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { FARBEN, aufhellen, szeneDaten } from "./daten";
import type { KatalogEintrag, Welt } from "../typen";

const KATALOG: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale" },
  { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit" },
];
const WELT: Welt = {
  regelwerkVersion: 1, hash: "x",
  grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "g0", code: "EG", yUnten: 0, hoehe: 3 }, { id: "g1", code: "OG1", yUnten: 3, hoehe: 3.5 }],
  einheiten: [
    { id: "e1", geschossId: "g0", bezeichnung: "Technik", art: "technik", rechteck: { x: 0, z: 0, breite: 10, tiefe: 15 }, quelle: "schematisch" },
    { id: "e2", geschossId: "g1", bezeichnung: "Buero", art: "buero", rechteck: { x: 0, z: 0, breite: 30, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [
    { schluessel: "s1", katalogId: "heizung.waermepumpe", hersteller: null, typ: null, bauteilIds: ["b1"], mengeSumme: 1, mengeUnbekannt: false, status: "bestaetigt", position: { x: 5, y: 0, z: 7.5 }, versorgt: [] },
    { schluessel: "s2", katalogId: "heizung.heizkoerper", hersteller: "Zehnder", typ: null, bauteilIds: ["b2"], mengeSumme: 4, mengeUnbekannt: false, status: "vorgeschlagen", position: { x: 15, y: 3, z: 7.5 }, versorgt: [] },
  ],
  hinweise: [],
};

describe("aufhellen", () => {
  it("mischt mit Weiss", () => {
    expect(aufhellen("#000000", 0.5)).toBe("#808080");
    expect(aufhellen("#059669")).toBe("#8fd0bc");
  });
});

describe("szeneDaten", () => {
  const d = szeneDaten(WELT, KATALOG);
  it("eine Glasplatte je Geschoss und Teilrechteck", () => {
    expect(d.platten).toEqual([
      { mitte: [15, 0, 7.5], breite: 30, tiefe: 15 },
      { mitte: [15, 3, 7.5], breite: 30, tiefe: 15 },
    ]);
  });
  it("Linien: Fassade (2 Umrisse + 4 Senkrechte) und je Einheit ein Umriss", () => {
    // Fassade: 2 × 4 Segmente + 4 Senkrechte = 12 Segmente; Einheiten: 2 × 4 = 8 Segmente; je Segment 6 Zahlen
    expect(d.linien.length).toBe((12 + 8) * 6);
  });
  it("Beschriftung je Geschoss mit Einzahl/Mehrzahl und je Einheit", () => {
    expect(d.beschriftungen.map((b) => b.text)).toEqual(["EG · 1 Einheit", "OG1 · 1 Einheit", "Technik", "Buero"]);
  });
  it("Pins mit Bereichsfarbe; vorgeschlagen aufgehellt; knapp ueber dem Boden", () => {
    expect(d.pins).toEqual([
      { schluessel: "s1", position: [5, 0.25, 7.5], farbe: FARBEN.zentrale, name: "Waermepumpe" },
      { schluessel: "s2", position: [15, 3.25, 7.5], farbe: aufhellen(FARBEN.einheit), name: "Heizkoerper" },
    ]);
  });
  it("Kamera zielt auf die Gebaeudemitte", () => {
    expect(d.kamera.ziel).toEqual([15, 3.25, 7.5]);
    expect(d.kamera.radius).toBeCloseTo(Math.hypot(15, 3.25, 7.5), 6);
  });
  it("unbekannte Katalog-ID: Farbe Einheit, Name = ID", () => {
    const w = { ...WELT, symbole: [{ ...WELT.symbole[0], katalogId: "x.y" }] };
    expect(szeneDaten(w, KATALOG).pins[0]).toMatchObject({ farbe: FARBEN.einheit, name: "x.y" });
  });
  it("leere Welt ergibt leere Szene ohne Fehler", () => {
    const leer = szeneDaten({ ...WELT, geschosse: [], einheiten: [], symbole: [] }, KATALOG);
    expect(leer.platten).toEqual([]);
    expect(leer.pins).toEqual([]);
    expect(Number.isFinite(leer.kamera.radius)).toBe(true);
  });
});
```

Run in `app/web/`: `npx vitest run src/szene/daten.test.ts` → FAIL.

- [ ] **Step 2: `app/web/src/szene/daten.ts`**

```ts
import type { KatalogEintrag, Rechteck, Welt } from "../typen";

export const FARBEN = { zentrale: "#c2410c", verteilung: "#2563eb", einheit: "#059669", auswahl: "#f59e0b" } as const;
const PIN_HOEHE = 0.25;      // Pin knapp ueber dem Geschossboden
const EINHEIT_HOEHE = 0.05;  // Einheiten-Umriss knapp ueber der Platte

export interface SzenePlatte { mitte: [number, number, number]; breite: number; tiefe: number }
export interface SzeneBeschriftung { text: string; position: [number, number, number]; groesse: number }
export interface SzenePin { schluessel: string; position: [number, number, number]; farbe: string; name: string }
export interface SzeneDaten {
  platten: SzenePlatte[]; linien: Float32Array; beschriftungen: SzeneBeschriftung[]; pins: SzenePin[];
  kamera: { ziel: [number, number, number]; radius: number };
}

/** Mischt eine Hex-Farbe mit Weiss (anteil 0 = unveraendert, 1 = weiss). */
export function aufhellen(hex: string, anteil = 0.55): string {
  const n = parseInt(hex.slice(1), 16);
  const kanal = (v: number) => Math.round(v + (255 - v) * anteil).toString(16).padStart(2, "0");
  return `#${kanal((n >> 16) & 255)}${kanal((n >> 8) & 255)}${kanal(n & 255)}`;
}

export function szeneDaten(welt: Welt, katalog: KatalogEintrag[]): SzeneDaten {
  const eintrag = new Map(katalog.map((k) => [k.id, k]));
  const l: number[] = [];
  const umriss = (r: Rechteck, y: number) => {
    const x0 = r.x, x1 = r.x + r.breite, z0 = r.z, z1 = r.z + r.tiefe;
    l.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
  };

  const yMin = welt.geschosse.length ? Math.min(...welt.geschosse.map((g) => g.yUnten)) : 0;
  const yMax = welt.geschosse.length ? Math.max(...welt.geschosse.map((g) => g.yUnten + g.hoehe)) : 3;
  const xs = welt.grundriss.flatMap((r) => [r.x, r.x + r.breite]), zs = welt.grundriss.flatMap((r) => [r.z, r.z + r.tiefe]);
  const xMin = xs.length ? Math.min(...xs) : 0, xMax = xs.length ? Math.max(...xs) : 10;
  const zMin = zs.length ? Math.min(...zs) : 0, zMax = zs.length ? Math.max(...zs) : 10;

  // Fassade nur, wenn es Geschosse gibt
  if (welt.geschosse.length) for (const r of welt.grundriss) {
    umriss(r, yMin); umriss(r, yMax);
    for (const [x, z] of [[r.x, r.z], [r.x + r.breite, r.z], [r.x + r.breite, r.z + r.tiefe], [r.x, r.z + r.tiefe]]) l.push(x, yMin, z, x, yMax, z);
  }
  const yGeschoss = new Map(welt.geschosse.map((g) => [g.id, g.yUnten]));
  for (const e of welt.einheiten) umriss(e.rechteck, (yGeschoss.get(e.geschossId) ?? 0) + EINHEIT_HOEHE);

  const platten: SzenePlatte[] = welt.geschosse.flatMap((g) => welt.grundriss.map((r) => ({
    mitte: [r.x + r.breite / 2, g.yUnten, r.z + r.tiefe / 2] as [number, number, number], breite: r.breite, tiefe: r.tiefe,
  })));

  const beschriftungen: SzeneBeschriftung[] = [
    ...welt.geschosse.map((g) => {
      const n = welt.einheiten.filter((e) => e.geschossId === g.id).length;
      return { text: `${g.code} · ${n} ${n === 1 ? "Einheit" : "Einheiten"}`, position: [xMax + 3, g.yUnten + g.hoehe / 2, (zMin + zMax) / 2] as [number, number, number], groesse: 0.9 };
    }),
    ...welt.einheiten.map((e) => ({
      text: e.bezeichnung,
      position: [e.rechteck.x + e.rechteck.breite / 2, (yGeschoss.get(e.geschossId) ?? 0) + 0.4, e.rechteck.z + 0.8] as [number, number, number],
      groesse: 0.6,
    })),
  ];

  const pins: SzenePin[] = welt.symbole.map((s) => {
    const k = eintrag.get(s.katalogId);
    const basis = FARBEN[k?.bereich ?? "einheit"];
    return {
      schluessel: s.schluessel,
      position: [s.position.x, s.position.y + PIN_HOEHE, s.position.z],
      farbe: s.status === "vorgeschlagen" ? aufhellen(basis) : basis,
      name: k?.name ?? s.katalogId,
    };
  });

  const ziel: [number, number, number] = [(xMin + xMax) / 2, (yMin + yMax) / 2, (zMin + zMax) / 2];
  const radius = Math.max(Math.hypot((xMax - xMin) / 2, (yMax - yMin) / 2, (zMax - zMin) / 2), 1);
  return { platten, linien: new Float32Array(l), beschriftungen, pins, kamera: { ziel, radius } };
}
```

- [ ] **Step 3: Tests und Typen**

Run in `app/web/`: `npx vitest run`, `npm run pruefe:typen` → PASS / Exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/web/src/szene
git commit -m "M2b-1: Szene-Daten aus der Welt (Platten, Linien, Beschriftungen, Pins, Kamera)"
```

---

### Task 5: 3D-Szene, Seitenpanel, Ansicht

**Files:**
- Create: `app/web/src/szene/Szene.tsx`, `app/web/src/panel/daten.ts`, `app/web/src/panel/Panel.tsx`
- Modify: `app/web/src/seiten/Ansicht.tsx` (Platzhalter ersetzen), `app/web/src/stil.css` (Ansicht/Panel)
- Test: `app/web/src/panel/daten.test.ts`

**Interfaces:**
- Consumes: `szeneDaten`, `SzeneDaten`, `FARBEN` (Task 4); `holeJson` (Task 3); Typen.
- Produces:
  - `mengeText(summe: number, unbekannt: boolean): string`
  - `interface PanelDaten { titel: string; herstellerTyp: string | null; status: "bestaetigt" | "vorgeschlagen"; menge: string; zeilen: { menge: string; baujahr: string }[]; standort: string; versorgt: string[] }`
  - `panelDaten(welt: Welt, beschreibung: Beschreibung, katalog: KatalogEintrag[], schluessel: string): PanelDaten | null`
  - `uebersicht(welt: Welt, beschreibung: Beschreibung): { geschosse: number; einheiten: number; symbole: number; hinweise: string[] }`
  - `Szene({ daten, auswahl, onAuswahl })`, `Panel({ welt, beschreibung, katalog, auswahl })`

- [ ] **Step 1: Failing Test** – `app/web/src/panel/daten.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { mengeText, panelDaten, uebersicht } from "./daten";
import type { Beschreibung, KatalogEintrag, Welt } from "../typen";

const KATALOG: KatalogEintrag[] = [
  { id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung" },
  { id: "heizung.heizkoerper", name: "Heizkoerper", bereich: "einheit" },
  { id: "heizung.waermepumpe", name: "Waermepumpe", bereich: "zentrale" },
];
const WELT: Welt = {
  regelwerkVersion: 1, hash: "x", grundriss: [{ x: 0, z: 0, breite: 30, tiefe: 15 }],
  geschosse: [{ id: "g0", code: "EG", yUnten: 0, hoehe: 3 }, { id: "g1", code: "OG1", yUnten: 3, hoehe: 3 }],
  einheiten: [
    { id: "eR", geschossId: "g0", bezeichnung: "Restaurant", art: "gastro", rechteck: { x: 0, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
    { id: "eT", geschossId: "g0", bezeichnung: "Technik", art: "technik", rechteck: { x: 15, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
    { id: "eC", geschossId: "g1", bezeichnung: "Buero C", art: "buero", rechteck: { x: 0, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
    { id: "eD", geschossId: "g1", bezeichnung: "Buero D", art: "buero", rechteck: { x: 15, z: 0, breite: 15, tiefe: 15 }, quelle: "schematisch" },
  ],
  symbole: [
    { schluessel: "sV", katalogId: "heizung.verteiler", hersteller: null, typ: null, bauteilIds: ["bV"], mengeSumme: 1, mengeUnbekannt: false, status: "bestaetigt", position: { x: 20, y: 0, z: 5 }, versorgt: ["eR", "eC"] },
    { schluessel: "sH", katalogId: "heizung.heizkoerper", hersteller: "Zehnder", typ: "Charleston", bauteilIds: ["bH1", "bH2"], mengeSumme: 12, mengeUnbekannt: true, status: "vorgeschlagen", position: { x: 5, y: 3, z: 5 }, versorgt: [] },
    { schluessel: "sW", katalogId: "heizung.waermepumpe", hersteller: null, typ: null, bauteilIds: ["bW"], mengeSumme: 0, mengeUnbekannt: true, status: "bestaetigt", position: { x: 15, y: 0, z: 7 }, versorgt: [] },
  ],
  hinweise: [{ code: "ueberlappung", bezug: "eD" }],
};
const BESCHREIBUNG: Beschreibung = {
  gebaeudeId: "G", stand: 1,
  bauteile: [
    { id: "bV", katalogId: "heizung.verteiler", standort: { einheitId: "eT" }, menge: 1, status: "bestaetigt", baujahr: 2015 },
    { id: "bH1", katalogId: "heizung.heizkoerper", standort: { einheitId: "eC" }, menge: 12, status: "bestaetigt", hersteller: "Zehnder", typ: "Charleston", baujahr: null },
    { id: "bH2", katalogId: "heizung.heizkoerper", standort: { einheitId: "eC" }, menge: null, status: "vorgeschlagen", hersteller: "Zehnder", typ: "Charleston" },
    { id: "bW", katalogId: "heizung.waermepumpe", standort: { geschossId: "g0" }, menge: null, status: "bestaetigt" },
  ],
  hinweise: [{ code: "verteiler_vorschlag", bezug: "eD" }],
};

describe("mengeText", () => {
  it("bekannt, unbekannt, teilweise", () => {
    expect(mengeText(3, false)).toBe("3");
    expect(mengeText(0, true)).toBe("unbekannt");
    expect(mengeText(12, true)).toBe("mind. 12 (teilweise unbekannt)");
  });
});

describe("panelDaten", () => {
  it("Verteiler: Standort Technik, versorgt Restaurant und Buero C", () => {
    expect(panelDaten(WELT, BESCHREIBUNG, KATALOG, "sV")).toEqual({
      titel: "Heizungsverteiler", herstellerTyp: null, status: "bestaetigt", menge: "1",
      zeilen: [{ menge: "1", baujahr: "2015" }],
      standort: "EG · Technik", versorgt: ["Restaurant (EG)", "Buero C (OG1)"],
    });
  });
  it("Heizkoerper: zwei Zeilen, Hersteller/Typ, teilweise unbekannte Menge", () => {
    expect(panelDaten(WELT, BESCHREIBUNG, KATALOG, "sH")).toMatchObject({
      herstellerTyp: "Zehnder · Charleston", status: "vorgeschlagen", menge: "mind. 12 (teilweise unbekannt)",
      zeilen: [{ menge: "12", baujahr: "–" }, { menge: "unbekannt", baujahr: "–" }], standort: "OG1 · Buero C", versorgt: [],
    });
  });
  it("Bauteil direkt am Geschoss", () => {
    expect(panelDaten(WELT, BESCHREIBUNG, KATALOG, "sW")?.standort).toBe("EG · direkt am Geschoss");
  });
  it("unbekannter Schluessel ergibt null", () => {
    expect(panelDaten(WELT, BESCHREIBUNG, KATALOG, "gibt-es-nicht")).toBeNull();
  });
});

describe("uebersicht", () => {
  it("zaehlt und uebersetzt Hinweise", () => {
    expect(uebersicht(WELT, BESCHREIBUNG)).toEqual({
      geschosse: 2, einheiten: 4, symbole: 3,
      hinweise: ["Buero D: Verteiler noch nicht erfasst", "Buero D: Layout ueberlappt"],
    });
  });
});
```

Run in `app/web/`: `npx vitest run src/panel/daten.test.ts` → FAIL.

- [ ] **Step 2: `app/web/src/panel/daten.ts`**

```ts
import type { Beschreibung, KatalogEintrag, Welt } from "../typen";

export interface PanelDaten {
  titel: string; herstellerTyp: string | null; status: "bestaetigt" | "vorgeschlagen"; menge: string;
  zeilen: { menge: string; baujahr: string }[]; standort: string; versorgt: string[];
}

export function mengeText(summe: number, unbekannt: boolean): string {
  if (!unbekannt) return String(summe);
  return summe === 0 ? "unbekannt" : `mind. ${summe} (teilweise unbekannt)`;
}

export function panelDaten(welt: Welt, beschreibung: Beschreibung, katalog: KatalogEintrag[], schluessel: string): PanelDaten | null {
  const s = welt.symbole.find((x) => x.schluessel === schluessel);
  if (!s) return null;
  const code = new Map(welt.geschosse.map((g) => [g.id, g.code]));
  const einheit = new Map(welt.einheiten.map((e) => [e.id, e]));
  const zeilen = s.bauteilIds.flatMap((id) => beschreibung.bauteile.filter((b) => b.id === id));
  const erstes = zeilen[0];
  let standort = "–";
  if (erstes?.standort.einheitId) {
    const e = einheit.get(erstes.standort.einheitId);
    if (e) standort = `${code.get(e.geschossId) ?? "?"} · ${e.bezeichnung}`;
  } else if (erstes?.standort.geschossId) {
    standort = `${code.get(erstes.standort.geschossId) ?? "?"} · direkt am Geschoss`;
  }
  return {
    titel: katalog.find((k) => k.id === s.katalogId)?.name ?? s.katalogId,
    herstellerTyp: [s.hersteller, s.typ].filter((x): x is string => !!x).join(" · ") || null,
    status: s.status,
    menge: mengeText(s.mengeSumme, s.mengeUnbekannt),
    zeilen: zeilen.map((b) => ({ menge: b.menge === null ? "unbekannt" : String(b.menge), baujahr: b.baujahr == null ? "–" : String(b.baujahr) })),
    standort,
    versorgt: s.versorgt.map((id) => { const e = einheit.get(id); return e ? `${e.bezeichnung} (${code.get(e.geschossId) ?? "?"})` : id; }),
  };
}

export function uebersicht(welt: Welt, beschreibung: Beschreibung) {
  const name = (id: string) => welt.einheiten.find((e) => e.id === id)?.bezeichnung ?? id;
  const text = (h: { code: string; bezug: string }) => {
    if (h.code === "verteiler_vorschlag") return `${name(h.bezug)}: Verteiler noch nicht erfasst`;
    if (h.code === "ueberlappung") return `${name(h.bezug)}: Layout ueberlappt`;
    if (h.code === "position_widerspruch") return "Widerspruechliche manuelle Positionen in einer Bauteilgruppe";
    return h.code;
  };
  return {
    geschosse: welt.geschosse.length, einheiten: welt.einheiten.length, symbole: welt.symbole.length,
    hinweise: [...(beschreibung.hinweise ?? []), ...welt.hinweise].map(text),
  };
}
```

Run: `npx vitest run src/panel/daten.test.ts` → PASS.

- [ ] **Step 3: `app/web/src/szene/Szene.tsx`**

```tsx
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FARBEN, type SzeneBeschriftung, type SzeneDaten } from "./daten";

const PIN_GEOMETRIE = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 24);

interface Props { daten: SzeneDaten; auswahl: string | null; onAuswahl: (schluessel: string | null) => void }

/** 3D-Uebersicht nach ADR 0008: orthografisch, isometrisch, Zeichnen nur bei Aenderung. */
export function Szene({ daten, auswahl, onAuswahl }: Props) {
  return (
    <Canvas className="szene" orthographic frameloop="demand" dpr={[1, 1.5]} onPointerMissed={() => onAuswahl(null)}>
      <color attach="background" args={["#f4f5f7"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[30, 50, 20]} intensity={0.6} />
      <Kamera daten={daten} />
      {daten.platten.map((p, i) => (
        <mesh key={i} position={p.mitte}>
          <boxGeometry args={[p.breite, 0.08, p.tiefe]} />
          <meshStandardMaterial color="#9fb7c9" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[daten.linien, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#475569" />
      </lineSegments>
      {daten.beschriftungen.map((b, i) => <Beschriftung key={i} {...b} />)}
      <Pins daten={daten} auswahl={auswahl} onAuswahl={onAuswahl} />
    </Canvas>
  );
}

function Kamera({ daten }: { daten: SzeneDaten }) {
  const { camera, gl, size, invalidate } = useThree();
  useEffect(() => {
    const [zx, zy, zz] = daten.kamera.ziel, r = daten.kamera.radius;
    const kamera = camera as THREE.OrthographicCamera;
    kamera.position.set(zx + r * 2, zy + r * 2, zz + r * 2); // isometrisch: 45° gedreht, ca. 35° Neigung
    kamera.near = 0.1; kamera.far = r * 20;
    kamera.zoom = Math.min(size.width, size.height) / (r * 2.4);
    kamera.lookAt(zx, zy, zz);
    kamera.updateProjectionMatrix();
    const steuerung = new OrbitControls(kamera, gl.domElement);
    steuerung.target.set(zx, zy, zz);
    steuerung.maxPolarAngle = Math.PI / 2 - 0.05; // nicht unter den Boden
    steuerung.minZoom = kamera.zoom / 4; steuerung.maxZoom = kamera.zoom * 8;
    steuerung.update();
    const neu = () => invalidate();
    steuerung.addEventListener("change", neu);
    invalidate();
    return () => { steuerung.removeEventListener("change", neu); steuerung.dispose(); };
  }, [daten, camera, gl, size.width, size.height, invalidate]);
  return null;
}

function Beschriftung({ text, position, groesse }: SzeneBeschriftung) {
  const textur = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const g = c.getContext("2d")!;
    g.font = "500 44px system-ui, sans-serif"; g.fillStyle = "#1f2937"; g.textBaseline = "middle";
    g.fillText(text, 8, 48);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => textur.dispose(), [textur]);
  return (
    <sprite position={position} scale={[groesse * (512 / 96), groesse, 1]}>
      <spriteMaterial map={textur} transparent depthTest={false} />
    </sprite>
  );
}

function Pins({ daten, auswahl, onAuswahl }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { gl, invalidate } = useThree();
  const [hover, setHover] = useState<number | null>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D(), farbe = new THREE.Color();
    daten.pins.forEach((p, i) => {
      const gewaehlt = p.schluessel === auswahl;
      o.position.set(...p.position);
      o.scale.setScalar(gewaehlt ? 1.5 : 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, farbe.set(gewaehlt ? FARBEN.auswahl : p.farbe));
    });
    m.count = daten.pins.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [daten, auswahl, invalidate]);
  const ueber = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    gl.domElement.style.cursor = e.instanceId === undefined ? "" : "pointer";
    setHover(e.instanceId ?? null);
  };
  const p = hover !== null ? daten.pins[hover] : undefined;
  return (
    <>
      <instancedMesh
        ref={ref}
        args={[PIN_GEOMETRIE, undefined, Math.max(daten.pins.length, 1)]}
        onPointerMove={ueber}
        onPointerOut={() => { gl.domElement.style.cursor = ""; setHover(null); }}
        onClick={(e) => { e.stopPropagation(); if (e.instanceId !== undefined) onAuswahl(daten.pins[e.instanceId].schluessel); }}
      >
        <meshStandardMaterial />
      </instancedMesh>
      {p && <Beschriftung text={p.name} position={[p.position[0], p.position[1] + 1.2, p.position[2]]} groesse={0.7} />}
    </>
  );
}
```

Hinweis zur Kamera: Die Richtung (1, 1, 1) ergibt 45° Drehung und ca. 35° Neigung (isometrisch).

- [ ] **Step 4: `app/web/src/panel/Panel.tsx`**

```tsx
import { panelDaten, uebersicht } from "./daten";
import type { Beschreibung, KatalogEintrag, Welt } from "../typen";

interface Props { welt: Welt; beschreibung: Beschreibung; katalog: KatalogEintrag[]; auswahl: string | null }

export function Panel({ welt, beschreibung, katalog, auswahl }: Props) {
  const d = auswahl ? panelDaten(welt, beschreibung, katalog, auswahl) : null;
  if (!d) {
    const u = uebersicht(welt, beschreibung);
    return (
      <aside className="panel">
        <h2>Uebersicht</h2>
        <p>{u.geschosse} Geschosse · {u.einheiten} Einheiten · {u.symbole} Symbole</p>
        {u.hinweise.length > 0 && <><h3>Hinweise</h3><ul>{u.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
        <p className="leise">Klick auf einen Punkt zeigt das Bauteil.</p>
      </aside>
    );
  }
  return (
    <aside className="panel">
      <h2>{d.titel}</h2>
      {d.herstellerTyp && <p>{d.herstellerTyp}</p>}
      <p><span className={d.status === "vorgeschlagen" ? "marke vorschlag" : "marke"}>{d.status === "vorgeschlagen" ? "vorgeschlagen" : "bestaetigt"}</span> Menge: {d.menge}</p>
      <table>
        <thead><tr><th>Menge</th><th>Baujahr</th></tr></thead>
        <tbody>{d.zeilen.map((z, i) => <tr key={i}><td>{z.menge}</td><td>{z.baujahr}</td></tr>)}</tbody>
      </table>
      <h3>Standort</h3>
      <p>{d.standort}</p>
      <h3>Versorgt</h3>
      {d.versorgt.length ? <ul>{d.versorgt.map((v) => <li key={v}>{v}</li>)}</ul> : <p>–</p>}
      <p className="leise">Position schematisch</p>
    </aside>
  );
}
```

- [ ] **Step 5: `app/web/src/seiten/Ansicht.tsx`** (ersetzt Platzhalter)

```tsx
import { useEffect, useMemo, useState } from "react";
import { holeJson } from "../api";
import { Szene } from "../szene/Szene";
import { szeneDaten } from "../szene/daten";
import { Panel } from "../panel/Panel";
import type { Beschreibung, Katalog, Welt } from "../typen";

interface Daten { welt: Welt; beschreibung: Beschreibung; katalog: Katalog }

export function Ansicht({ gebaeudeId }: { gebaeudeId: string }) {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  useEffect(() => {
    setDaten(null); setFehler(null); setAuswahl(null);
    Promise.all([
      holeJson<Welt>(`/api/szene/gebaeude/${gebaeudeId}/welt`),
      holeJson<Beschreibung>(`/api/struktur/gebaeude/${gebaeudeId}/beschreibung`),
      holeJson<Katalog>("/api/katalog/v1"),
    ]).then(([welt, beschreibung, katalog]) => setDaten({ welt, beschreibung, katalog }), (e: Error) => setFehler(e.message));
  }, [gebaeudeId]);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setAuswahl(null); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);
  const szene = useMemo(() => (daten ? szeneDaten(daten.welt, daten.katalog.eintraege) : null), [daten]);
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>;
  if (!daten || !szene) return <p className="status">Laden …</p>;
  return (
    <main className="ansicht">
      <Szene daten={szene} auswahl={auswahl} onAuswahl={setAuswahl} />
      <Panel welt={daten.welt} beschreibung={daten.beschreibung} katalog={daten.katalog.eintraege} auswahl={auswahl} />
    </main>
  );
}
```

`app/web/src/App.tsx`: Aufruf `<Ansicht gebaeudeId={zustand.gebaeudeId} />` bleibt.

- [ ] **Step 6: Stile ergaenzen** – an `app/web/src/stil.css` anhaengen:

```css
.ansicht { display: grid; grid-template-columns: 1fr 340px; min-height: 0; }
.szene { width: 100%; height: 100%; }
.panel { background: #fff; border-left: 1px solid var(--linie); padding: 1rem 1.2rem; overflow: auto; }
.panel h2 { margin: 0 0 0.4rem; font-size: 1.15rem; }
.panel h3 { margin: 1rem 0 0.3rem; font-size: 0.85rem; text-transform: uppercase; color: #6b7280; }
.panel table { border-collapse: collapse; width: 100%; }
.panel th, .panel td { text-align: left; padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--linie); }
.panel ul { margin: 0; padding-left: 1.1rem; }
.leise { color: #6b7280; font-size: 0.85rem; margin-top: 1.2rem; }
.marke { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; background: #e5e7eb; font-size: 0.8rem; margin-right: 0.5rem; }
.marke.vorschlag { background: #fff; border: 1px dashed #6b7280; }
```

- [ ] **Step 7: Tests, Typen, Build**

Run in `app/web/`: `npx vitest run` (alle Tests PASS), `npm run pruefe:typen` (Exit 0), `npm run build` (Exit 0).

- [ ] **Step 8: Commit**

```bash
git add app/web/src
git commit -m "M2b-1: 3D-Szene mit Pins und Picking, Seitenpanel, Ansicht"
```

---

### Task 6: Docker-Build, Lizenz-Dossier, Docker-Smoke

**Files:**
- Modify: `app/Dockerfile`, `app/.dockerignore`, `app/src/betrieb/dossier.ts`, `app/test/dossier.test.ts`, `app/test-docker/paket.test.ts`

**Interfaces:**
- Produces: Laufzeit-Image enthaelt `/app/web/index.html` und `ENV PLANORA_WEB_DIR=/app/web`; `dossier` akzeptiert optional `--lockfile-web <pfad>` und schreibt `komponenten.json` mit zusaetzlichem Feld `npmWeb` (Pakete aus dem Web-Lockfile oder `null`).

- [ ] **Step 1: `app/.dockerignore`**

```
# Nur package*.json, src/ und web/ (ohne node_modules/dist) gehen in den Build-Kontext.
*
!package.json
!package-lock.json
!src
!web
web/node_modules
web/dist
```

- [ ] **Step 2: `app/Dockerfile`** – neue Stufe vor `FROM ${NODE_IMAGE} AS abh`:

```dockerfile
# --- Frontend: Vite-Build, nur das Ergebnis dist/ geht ins Laufzeit-Image (keine Build-Werkzeuge).
FROM ${NODE_IMAGE} AS web-bau
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web ./
RUN npm run build
```

In der Laufzeit-Stufe nach `COPY --from=bau /bau/dist ./dist`:

```dockerfile
COPY --from=web-bau /web/dist ./web
ENV PLANORA_WEB_DIR=/app/web
```

- [ ] **Step 3: Dossier** – `app/src/betrieb/dossier.ts`: `leseArgumente(..., ["bundle", "schluessel", "lockfile", "lockfile-web", "ausgabe"])`; Aufruf-Fehlertext um `[--lockfile-web <web/package-lock.json>]` ergaenzen; nach `const lock = …`:

```ts
const lockWeb = w["lockfile-web"] ? JSON.parse(readFileSync(w["lockfile-web"], "utf8")) : null;
```

und in `komponenten.json`: `{ release: r, npm: lock.packages, npmWeb: lockWeb?.packages ?? null, status: "UNGEPRUEFT" }`.

`app/test/dossier.test.ts`: bestehenden Test lesen und um einen Fall erweitern, der `--lockfile-web` mit einem kleinen Lockfile (`{ packages: { "node_modules/three": { version: "0.187.0", license: "MIT" } } }`) uebergibt und prueft, dass `komponenten.json` `npmWeb["node_modules/three"].license === "MIT"` enthaelt; ohne Option `npmWeb === null`. Den Aufrufstil (Prozess oder Funktion) vom bestehenden Test uebernehmen.

Run: `npx vitest run test/dossier.test.ts` → PASS.

- [ ] **Step 4: Docker-Smoke** – in `app/test-docker/paket.test.ts` nach dem Health-Test:

```ts
  it("M2b-1: Frontend wird ueber Caddy ausgeliefert, mit CSP", async () => {
    const r = await https(inst.basis, "GET", "/");
    expect(r.status).toBe(200);
    expect(r.text).toContain('<div id="app">');
    expect(String(r.headers["content-security-policy"])).toContain("default-src 'self'");
    expect((await https(inst.basis, "GET", "/api/gibt-es-nicht")).status).toBe(404);
  });
```

- [ ] **Step 5: Pruefen**

Run in `app/`: `npm test`, `npm run pruefe:typen`, dann `npm run test:docker` (Docker Desktop muss laufen, ca. 8–10 min; laeuft Docker nicht, das so berichten – nie als bestanden).
Expected: alles gruen; der bestehende Test "PP9-7: Laufzeitbaum ohne Compiler und Testwerkzeuge" bleibt gruen (Vite/Vitest existieren nur in der Stufe `web-bau`).

- [ ] **Step 6: Commit**

```bash
git add app/Dockerfile app/.dockerignore app/src/betrieb/dossier.ts app/test/dossier.test.ts app/test-docker/paket.test.ts
git commit -m "M2b-1: Frontend im Docker-Image, Web-Lockfile im Lizenz-Dossier, Docker-Smoke"
```

---

### Task 7: Lokaler Entwicklungsstart und Doku-Nachtraege

**Files:**
- Create: `app/entwicklung/start.ts`
- Modify: `app/package.json` (Script `entwicklung`), `app/.gitignore`, `app/tsconfig.docker.json`, `docs/superpowers/specs/2026-11-11-m2b1-sichtbarer-schnitt-design.md`

**Interfaces:**
- Produces: `npm run entwicklung` (in `app/`) baut `web/`, startet eine frische embedded-postgres-Instanz, migriert, legt Erstadmin und Beispielgebaeude an und startet den Server mit Frontend auf `http://localhost:3000`; gibt E-Mail und zufaelliges Passwort auf der Konsole aus. Nicht im Image (Ordner `entwicklung/` liegt ausserhalb von `src/` und ist nicht im Docker-Kontext).

- [ ] **Step 1: `app/entwicklung/start.ts`**

```ts
// Nur Entwicklung: frische Datenbank, Erstadmin, Beispielgebaeude, Server mit Frontend auf http://localhost:3000.
// Liegt bewusst ausserhalb von src/ (nicht im Docker-Image).
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migriere } from "../src/db/migrator.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { beispielAnlegen } from "../src/welt/beispiel.js";

const PORT = Number(process.env.PLANORA_PORT ?? 3000), PG_PORT = 54500;
const pfad = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const dbDir = pfad("../.pgdata-entwicklung"), ablage = pfad("../.ablage-entwicklung");
rmSync(dbDir, { recursive: true, force: true });
mkdirSync(ablage, { recursive: true });

const pgPasswort = randomBytes(18).toString("hex");
const instanz = new EmbeddedPostgres({ databaseDir: dbDir, user: "postgres", password: pgPasswort, port: PG_PORT, persistent: false, onLog: () => {}, onError: () => {} });
await instanz.initialise();
await instanz.start();
const cfg = { host: "localhost", port: PG_PORT, user: "postgres", password: pgPasswort, database: "postgres" };
await migriere(cfg);
const pool = new pg.Pool(cfg);
const passwort = randomBytes(9).toString("base64url");
await loeseSetupTokenEin(pool, await erzeugeSetupToken(pool), "admin@planora.invalid", "Admin", passwort);
await beispielAnlegen(pool);

const baseURL = `http://localhost:${PORT}`;
const app = await baueServer({ pool, stufe: 2, baseURL, secret: randomBytes(32).toString("hex"), ablageWurzel: ablage, webWurzel: pfad("../web/dist") });
await app.listen({ host: "127.0.0.1", port: PORT });
console.log(`Planora Entwicklung: ${baseURL}\nLogin: admin@planora.invalid / ${passwort}`);

const ende = async () => { await app.close(); await pool.end(); await instanz.stop(); process.exit(0); };
process.on("SIGINT", () => void ende());
process.on("SIGTERM", () => void ende());
```

- [ ] **Step 2: Script, Ignore, Typpruefung**
  - `app/package.json` → `"entwicklung": "npm --prefix web run build && tsx entwicklung/start.ts"`
  - `app/.gitignore` → Zeilen `.pgdata-entwicklung/` und `.ablage-entwicklung/`
  - `app/tsconfig.docker.json` → `"include": ["src", "test", "test-docker", "entwicklung"]`

Run: `npm run pruefe:typen` → Exit 0. Danach `npm run entwicklung` starten, warten bis "Planora Entwicklung" erscheint, `curl -s http://localhost:3000/ | head -c 200` zeigt HTML, Prozess mit Ctrl+C beenden. (Laeuft der Admin-Login mit `loeseSetupTokenEin` nicht als Admin-Rolle, die Rolle per `update rolle_zuordnung set rolle='admin'` setzen und im Bericht nennen.)

- [ ] **Step 3: Spec-Nachtraege** in `docs/superpowers/specs/2026-11-11-m2b1-sichtbarer-schnitt-design.md`:
  - §2 erster Punkt: "Paket `web/`" → "Paket `app/web/` (im Docker-Build-Kontext `app/`)".
  - §4.4 CSP: `style-src 'self'` ohne `unsafe-inline` (React setzt Stile per CSSOM); den [A]-Satz zu `unsafe-inline` entfernen.
  - §5 Pins: "`vorgeschlagen` halbtransparent" → "`vorgeschlagen` aufgehellt (55 % zu Weiss), da ein InstancedMesh keine Deckkraft je Instanz kennt".
  - §7: Satz ergaenzen "Lokaler Start: `npm run entwicklung` in `app/` (embedded-postgres, Erstadmin, Beispieldaten; nicht im Image)."

- [ ] **Step 4: Commit**

```bash
git add app/entwicklung app/package.json app/.gitignore app/tsconfig.docker.json docs/superpowers/specs/2026-11-11-m2b1-sichtbarer-schnitt-design.md
git commit -m "M2b-1: lokaler Entwicklungsstart mit Beispieldaten, Spec-Nachtraege"
```

---

## Nach Task 7 (Controller, nicht Subagent)

Sichtpruefung per `playwright-cli`: `npm run entwicklung`, Login mit ausgegebenem Passwort, Beispielgebaeude oeffnen, Screenshot der Uebersicht, Klick auf den Verteiler-Pin, Panel zeigt "Restaurant (EG)" und "Buero C (OG1)", Konsole ohne CSP-Verletzungen. Screenshots an den PO.

## Abdeckung Spec → Tasks

| Spec | Task |
|---|---|
| §2 Architektur, Abhaengigkeiten | 2, 3, 6 |
| §3 Seiten, Sitzung, Fehleranzeige | 3, 5 |
| §4.1 Gebaeudeliste, §4.2 Katalog, §4.3 Fehlerformat | 1 |
| §4.4 Auslieferung, CSP, Caching | 2 |
| §5 3D-Szene | 4, 5 |
| §6 Seitenpanel | 5 |
| §7 Build, Dossier | 6, 7 |
| §8 Tests | 1–6, Sichtpruefung |
