// S4 RLS-Spike: startet ein lokales PostgreSQL (embedded-postgres, unter spikes/s04-rls/.pgdata),
// legt das Schema an und fuehrt die Pflichttests (a)-(e) aus ADR 0010 + Audit-Last (ADR 0015) aus.
// Passwoerter werden pro Lauf zufaellig erzeugt und nirgends gespeichert.
// Aufruf: node rls_test.mjs [anzahlRequests=10000]
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const N = Number(process.argv[2] ?? 10000);
const DIR = new URL("./.pgdata", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/%20/g, " ");
const PORT = 54329; const SU_PW = randomBytes(18).toString("hex"); const APP_PW = randomBytes(18).toString("hex");
rmSync(DIR, { recursive: true, force: true });
const db = new EmbeddedPostgres({ databaseDir: DIR, user: "postgres", password: SU_PW, port: PORT, persistent: false, onLog: () => {} });
const ergebnis = { tests: [] }; const ok = (name, bestanden, detail) => { ergebnis.tests.push({ name, bestanden, detail }); console.log(bestanden ? "BESTANDEN" : "NICHT BESTANDEN", "-", name, detail ? JSON.stringify(detail) : ""); };

await db.initialise(); await db.start();
try {
  const su = new pg.Client({ host: "localhost", port: PORT, user: "postgres", password: SU_PW, database: "postgres" }); await su.connect();
  ergebnis.pg_version = (await su.query("select version()")).rows[0].version;
  await su.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8").replace(":'app_pw'", `'${APP_PW}'`));
  // Testdaten: 2 Mandanten, je 50 Raeume, je 500 Elemente
  const A = randomUUID(), B = randomUUID();
  await su.query("SET ROLE planora_owner");
  for (const m of [A, B]) {
    await su.query("BEGIN"); await su.query("SELECT set_config('app.mandant_id', $1, true)", [m]);
    await su.query("INSERT INTO app.raum (mandant_id, name) SELECT $1, 'R'||g FROM generate_series(1,50) g", [m]);
    await su.query("INSERT INTO app.element (mandant_id, raum_id, name) SELECT $1, r.id, 'E'||g FROM generate_series(1,10) g CROSS JOIN app.raum r WHERE r.mandant_id=$1", [m]);
    await su.query("INSERT INTO app.angabe (mandant_id, element_id, merkmal, wert) SELECT $1, e.id, 'lebensdauer_jahre', '20' FROM app.element e WHERE e.mandant_id=$1", [m]);
    await su.query("COMMIT");
  }
  await su.query("RESET ROLE");

  // (h) Rolle ohne BYPASSRLS, kein Owner
  const rolle = (await su.query("select rolbypassrls, rolsuper from pg_roles where rolname='planora_app'")).rows[0];
  const besitzt = (await su.query("select count(*)::int n from pg_tables where tableowner='planora_app'")).rows[0].n;
  ok("(h) planora_app: NOBYPASSRLS, kein Superuser, besitzt keine Tabelle", !rolle.rolbypassrls && !rolle.rolsuper && besitzt === 0, { ...rolle, besitzt });

  // (a) Katalogpruefung + Negativkontrolle (absichtlich fehlende Policy)
  const katalog = async () => (await su.query(`select c.relname, c.relrowsecurity rls, c.relforcerowsecurity force, (select count(*) from pg_policies p where p.schemaname='app' and p.tablename=c.relname)::int policies
      from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attname='mandant_id'
      where n.nspname='app' and c.relkind='r'`)).rows.filter((r) => !r.rls || !r.force || r.policies === 0).map((r) => r.relname);
  const vorher = await katalog();
  await su.query("CREATE TABLE app.vergessen (id uuid primary key, mandant_id uuid not null)");
  const nachher = await katalog(); await su.query("DROP TABLE app.vergessen");
  ok("(a) Katalogpruefung: alle Mandantentabellen RLS+FORCE+Policy; vergessene Tabelle wird erkannt", vorher.length === 0 && nachher.includes("vergessen"), { vorher, nachher });

  const pool = new pg.Pool({ host: "localhost", port: PORT, user: "planora_app", password: APP_PW, database: "postgres", max: 10 });
  const mitMandant = async (m, fn) => { const c = await pool.connect(); try { await c.query("BEGIN"); await c.query("SELECT set_config('app.mandant_id', $1, true)", [m]); const r = await fn(c); await c.query("COMMIT"); return r; } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); } };

  // (c) fehlender Kontext -> Fehler, nie leere Menge
  let fehler = null; try { await pool.query("select count(*) from app.element"); } catch (e) { fehler = e.message; }
  ok("(c) ohne Mandantenkontext: Abfrage wirft Fehler", fehler?.includes("kein Mandantenkontext") ?? false, { fehler });

  // (b) Fremdzugriff lesen/schreiben
  const fremdLesen = await mitMandant(A, (c) => c.query("select count(*)::int n from app.element where mandant_id=$1", [B]));
  const eigen = await mitMandant(A, (c) => c.query("select count(*)::int n from app.element"));
  let schreibFehler = null; try { await mitMandant(A, (c) => c.query("insert into app.raum (mandant_id, name) values ($1,'x')", [B])); } catch (e) { schreibFehler = e.message; }
  const upd = await mitMandant(A, (c) => c.query("update app.element set name='gekapert' where mandant_id=$1", [B]));
  ok("(b) Mandant A liest/schreibt nichts von B", fremdLesen.rows[0].n === 0 && eigen.rows[0].n === 500 && !!schreibFehler && upd.rowCount === 0, { fremd_gelesen: fremdLesen.rows[0].n, eigen: eigen.rows[0].n, insert_fremd: schreibFehler, update_fremd_zeilen: upd.rowCount });

  // (e) zusammengesetzter FK: Element von A in Raum von B unmoeglich, auch als Owner ohne RLS-Pruefung
  await su.query("SET ROLE planora_owner"); await su.query("SELECT set_config('app.mandant_id', $1, false)", [B]);
  const raumB = (await su.query("select id from app.raum limit 1")).rows[0].id;
  await su.query("SELECT set_config('app.mandant_id', $1, false)", [A]);
  let fkFehler = null; try { await su.query("insert into app.element (mandant_id, raum_id, name) values ($1,$2,'quer')", [A, raumB]); } catch (e) { fkFehler = e.code; }
  await su.query("RESET ROLE; RESET app.mandant_id");
  ok("(e) Querreferenz in fremden Mandanten scheitert am zusammengesetzten FK", fkFehler === "23503", { sqlstate: fkFehler });

  // (d) Pool-Leak-Test: N parallele Requests, Pool 10, abwechselnd A/B
  const t0 = performance.now(); let fremd = 0, fehlerN = 0;
  await Promise.all(Array.from({ length: N }, (_, i) => { const m = i % 2 ? A : B; return mitMandant(m, (c) => c.query("select mandant_id from app.element order by random() limit 5"))
    .then((r) => { fremd += r.rows.filter((x) => x.mandant_id !== m).length; }).catch(() => { fehlerN++; }); }));
  const dauer = performance.now() - t0;
  ok(`(d) Pool-Leak: ${N} parallele Requests, Pool 10 -> 0 Fremdzeilen`, fremd === 0 && fehlerN === 0, { fremdzeilen: fremd, fehler: fehlerN, dauer_s: +(dauer / 1000).toFixed(1), req_pro_s: Math.round(N / (dauer / 1000)) });

  // (d') Negativkontrolle: Session-SET statt SET LOCAL -> Kontext bleibt an der Verbindung haengen
  const pool2 = new pg.Pool({ host: "localhost", port: PORT, user: "planora_app", password: APP_PW, database: "postgres", max: 1 });
  await pool2.query("select set_config('app.mandant_id', $1, false)", [A]);
  const leck = await pool2.query("select count(*)::int n from app.element"); await pool2.end();
  ok("(d') Negativkontrolle: falsches Muster (Session-SET) leckt Kontext an den naechsten Request", leck.rows[0].n === 500, { naechster_request_sieht_zeilen_von_A_ohne_eigenen_kontext: leck.rows[0].n });

  // Audit: Sammelbestaetigung 100 Angaben in einer Transaktion <= 2 s, Hash-Kette pruefbar
  const ids = (await mitMandant(A, (c) => c.query("select id from app.angabe where status='vorgeschlagen' limit 100"))).rows.map((r) => r.id);
  const ta = performance.now();
  await mitMandant(A, (c) => c.query("update app.angabe set status='bestaetigt', version=version+1 where id = any($1)", [ids]));
  const tb = performance.now() - ta;
  // parallel: 20 gleichzeitige Sammelbestaetigungen desselben Mandanten (Advisory-Lock serialisiert)
  const rest = (await mitMandant(A, (c) => c.query("select id from app.angabe where status='vorgeschlagen' limit 2000"))).rows.map((r) => r.id);
  const tp = performance.now();
  await Promise.all(Array.from({ length: 20 }, (_, k) => mitMandant(A, (c) => c.query("update app.angabe set status='bestaetigt' where id = any($1)", [rest.slice(k * 100, k * 100 + 100)]))));
  const tpd = performance.now() - tp;
  const kette = (await mitMandant(A, (c) => c.query("select vorgaenger_hash, hash from app.audit_eintrag order by id"))).rows;
  let kettenOk = true; for (let i = 1; i < kette.length; i++) if (kette[i].vorgaenger_hash !== kette[i - 1].hash) kettenOk = false;
  ok("Audit: Sammelbestaetigung 100 Angaben <= 2 s; Hash-Kette lueckenlos (auch bei 20 parallelen Bestaetigungen)", tb <= 2000 && kettenOk, { ms_100: +tb.toFixed(0), ms_20x100_parallel: +tpd.toFixed(0), kettenlaenge_A: kette.length, kette_ok: kettenOk });
  let auditSchreiben = null; try { await mitMandant(A, (c) => c.query("delete from app.audit_eintrag")); } catch (e) { auditSchreiben = e.message; }
  ok("Audit: planora_app kann audit_eintrag nicht loeschen", !!auditSchreiben, { fehler: auditSchreiben });

  await pool.end(); await su.end();
} finally { await db.stop(); rmSync(DIR, { recursive: true, force: true }); }
writeFileSync(new URL("./ergebnis.json", import.meta.url), JSON.stringify(ergebnis, null, 1));
