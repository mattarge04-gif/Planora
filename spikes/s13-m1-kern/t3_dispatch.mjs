// T3: Dispatch-Race (Spec §4.1). 20 Jobs (max. 5 gleichzeitig) senden ueber ExternDispatch an einen Fake-Provider
// (eigener Prozess, 500 ms Antwortzeit). Waehrend sie laufen, wird das Modul 'ki' abgeschaltet.
// Varianten:
//   v1_spec       Spec V1 woertlich: modulAktiv pruefen, 'laufend' committen, dann senden; Abschalten = UPDATE+NOTIFY.
//   v1_sperre_bis_gesendet  wie v1, aber Pruefung FOR SHARE und Sperre nur bis die Anfrage auf dem Socket liegt.
//   v2            Spec V2 (Commit d5e18e9): FOR SHARE ueber den ganzen fetch, Ergebnis in derselben Transaktion;
//                 Abschalten = (a) abschaltung_angefordert committen (+NOTIFY), (b) Abbruch per NOTIFY und 1-s-Polling,
//                 (c) UPDATE modul_schalter SET aktiv=false (wartet auf Share-Sperren) + Commit.
//   v2_pause      v2 + kuenstliche Pause 300 ms zwischen DB-Pruefung und fetch (A5)
//   v2_ohne_listener        v2 ohne LISTEN (toter Listener) -> nur Polling (A5)
//   v2_pause_ohne_listener  beides
// Verstoss = Anfrage beim Provider nach dem Abschalt-Commit bzw. Ergebnis-Commit nach dem Abschalt-Commit.
// Aufruf: node t3_dispatch.mjs [wiederholungen=50] [jobs=20] [parallel=5]
import http from "node:http";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startePg, speichereErgebnis, perzentil } from "./db.mjs";

const W = Number(process.argv[2] ?? 50), J = Number(process.argv[3] ?? 20), PAR = Number(process.argv[4] ?? 5);
const jetzt = () => performance.timeOrigin + performance.now();
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const prov = fork(fileURLToPath(new URL("./fake_provider.mjs", import.meta.url)));
const { port: PPORT } = await new Promise((r) => prov.once("message", r));
const providerLog = () => new Promise((r) => { prov.once("message", (m) => r(m.log)); prov.send("log"); });

const pgi = await startePg("t3", 54333);
const pool = new pgi.pg.Pool({ ...pgi.cfg, max: PAR + 10 });
const tests = [];
const ok = (name, bestanden, detail) => { tests.push({ name, bestanden, detail }); console.log(bestanden ? "BESTANDEN" : "NICHT BESTANDEN", "-", name, JSON.stringify(detail ?? {})); };

// Semaphore: max. PAR gleichzeitige externe Aufrufe
let frei = PAR; const warteschlange = [];
const belege = () => (frei > 0 ? (frei--, Promise.resolve()) : new Promise((r) => warteschlange.push(r)));
const gibFrei = () => { const n = warteschlange.shift(); if (n) n(); else frei++; };

const sende = (job, signal, nachGesendet = () => {}) => new Promise((res, rej) => {
  if (signal.aborted) return rej(signal.reason);
  const req = http.request({ host: "127.0.0.1", port: PPORT, path: "/v1/messages", method: "POST", headers: { "x-job": String(job), "content-type": "application/json" }, signal, agent: false },
    (r) => { let b = ""; r.on("data", (d) => (b += d)); r.on("end", () => res(b)); r.on("error", rej); });
  req.on("error", rej); req.on("finish", nachGesendet); req.end("{}");
});

try {
  await pool.query(`create table modul_schalter (modul_id text primary key, aktiv boolean not null);
    create table abschaltung_angefordert (modul_id text primary key, zeit timestamptz not null default clock_timestamp());
    create table extern_aufruf (id bigserial primary key, job int not null, modul_id text not null, ziel text not null,
      status text not null check (status in ('laufend','erledigt','abgebrochen_modul_aus','verworfen_modul_aus','nicht_gesendet_modul_aus','fehler')),
      ergebnis text, gestartet timestamptz not null default clock_timestamp(), beendet timestamptz);`);

  // --- Worker-Listener: haelt AbortController der laufenden Aufrufe ---
  const laufende = new Set();
  const listener = new pgi.pg.Client(pgi.cfg); await listener.connect();
  let listenAktiv = false, notifyEmpfangen = null;
  listener.on("notification", (n) => { if (!listenAktiv || n.payload !== "ki") return; notifyEmpfangen = jetzt(); for (const ac of laufende) ac.abort(new Error("modul_aus")); });
  await listener.query("listen modul_aus");

  let ergebnisCommits = []; // Zeitpunkte, zu denen ein Ergebnis-Commit begann (v2)

  // ---------- V1 ----------
  async function dispatchV1(sperre, job) {
    const c = await pool.connect();
    let abschluss = null;
    const schliesse = () => (abschluss ??= c.query("commit").finally(() => c.release()));
    try {
      await c.query("begin");
      const aktiv = (await c.query(`select aktiv from modul_schalter where modul_id='ki'${sperre ? " for share" : ""}`)).rows[0]?.aktiv === true;
      if (!aktiv) { await c.query("insert into extern_aufruf(job, modul_id, ziel, status, beendet) values ($1,'ki','claude','nicht_gesendet_modul_aus', clock_timestamp())", [job]); await schliesse(); return; }
      const id = (await c.query("insert into extern_aufruf(job, modul_id, ziel, status) values ($1,'ki','claude','laufend') returning id", [job])).rows[0].id;
      const ac = new AbortController(); laufende.add(ac);
      if (!sperre) await schliesse();
      let fehler; try { await sende(job, ac.signal, () => { schliesse(); }); } catch (e) { fehler = e; }
      laufende.delete(ac); await schliesse();
      const nochAktiv = (await pool.query("select aktiv from modul_schalter where modul_id='ki'")).rows[0].aktiv;
      const status = fehler ? (ac.signal.aborted ? "abgebrochen_modul_aus" : "fehler") : nochAktiv ? "erledigt" : "verworfen_modul_aus";
      if (status === "erledigt") ergebnisCommits.push(jetzt());
      await pool.query("update extern_aufruf set status=$2, beendet=clock_timestamp() where id=$1", [id, status]);
    } catch (e) { if (!abschluss) { await c.query("rollback").catch(() => {}); c.release(); } throw e; }
  }

  // ---------- V2 (Spec V2 §4.1) ----------
  async function dispatchV2(pauseMs, job) {
    const c = await pool.connect();
    const ac = new AbortController();
    let poll;
    try {
      await c.query("begin");
      const aktiv = (await c.query("select aktiv from modul_schalter where modul_id='ki' for share")).rows[0]?.aktiv === true;
      const angefordert = (await c.query("select 1 from abschaltung_angefordert where modul_id='ki'")).rowCount > 0;
      if (!aktiv || angefordert) {
        await c.query("rollback");
        await pool.query("insert into extern_aufruf(job, modul_id, ziel, status, beendet) values ($1,'ki','claude','nicht_gesendet_modul_aus', clock_timestamp())", [job]);
        return;
      }
      laufende.add(ac);
      // Polling alle 1 s ueber eine zweite Verbindung (die Transaktionsverbindung ist durch die Sperre belegt, aber frei nutzbar;
      // eigene Verbindung haelt das Beispiel einfach und entspricht einem Worker-Timer)
      poll = setInterval(async () => {
        try { if ((await pool.query("select 1 from abschaltung_angefordert where modul_id='ki'")).rowCount > 0) ac.abort(new Error("modul_aus_poll")); } catch {}
      }, 1000);
      if (pauseMs) await warte(pauseMs); // A5: Aufruf direkt nach der DB-Pruefung angehalten
      const antwort = await sende(job, ac.signal); // wirft bei Abbruch; Timeout <= 120 s waere hier zu setzen
      ergebnisCommits.push(jetzt());
      await c.query("insert into extern_aufruf(job, modul_id, ziel, status, ergebnis, beendet) values ($1,'ki','claude','erledigt',$2, clock_timestamp())", [job, antwort]);
      await c.query("commit");
    } catch (e) {
      await c.query("rollback").catch(() => {});
      if (ac.signal.aborted) await pool.query("insert into extern_aufruf(job, modul_id, ziel, status, beendet) values ($1,'ki','claude','abgebrochen_modul_aus', clock_timestamp())", [job]);
      else throw e;
    } finally { clearInterval(poll); laufende.delete(ac); c.release(); }
  }

  async function lauf(variante) {
    await pool.query("truncate extern_aufruf; delete from abschaltung_angefordert; delete from modul_schalter; insert into modul_schalter values ('ki', true)");
    await providerLog(); notifyEmpfangen = null; ergebnisCommits = [];
    listenAktiv = !variante.includes("ohne_listener");
    const pause = variante.includes("pause") ? 300 : 0;
    const dispatch = variante === "v1_spec" ? (j) => dispatchV1(false, j) : variante === "v1_sperre_bis_gesendet" ? (j) => dispatchV1(true, j) : (j) => dispatchV2(pause, j);
    const jobs = Array.from({ length: J }, (_, i) => warte(Math.random() * 300).then(async () => { await belege(); try { await dispatch(i); } finally { gibFrei(); } }));
    await warte(50 + Math.random() * 200);
    const t = {};
    t.start = jetzt();
    if (variante.startsWith("v1")) {
      const sw = await pool.connect();
      try { await sw.query("begin"); await sw.query("update modul_schalter set aktiv=false where modul_id='ki'"); await sw.query("select pg_notify('modul_aus','ki')"); t.cStart = jetzt(); await sw.query("commit"); t.cEnde = jetzt(); } finally { sw.release(); }
    } else {
      // (a) Anforderung committen + NOTIFY (nur Tempo)
      await pool.query("begin; insert into abschaltung_angefordert(modul_id) values ('ki'); select pg_notify('modul_aus','ki'); commit;");
      t.aEnde = jetzt();
      // (c) UPDATE wartet auf alle Share-Sperren
      const sw = await pool.connect();
      try { await sw.query("begin"); await sw.query("update modul_schalter set aktiv=false where modul_id='ki'"); t.cStart = jetzt(); await sw.query("commit"); t.cEnde = jetzt(); } finally { sw.release(); }
    }
    await Promise.all(jobs);
    await warte(50);
    const log = await providerLog();
    const db = (await pool.query("select status, count(*)::int n from extern_aufruf group by 1")).rows;
    return {
      requests_nach_abschaltcommit: log.filter((e) => e.ts > t.cEnde).length,
      requests_nach_commitbeginn: log.filter((e) => e.ts > t.cStart).length,
      requests_nach_anforderung: t.aEnde ? log.filter((e) => e.ts > t.aEnde).length : null,
      ergebnisse_nach_abschaltcommit: ergebnisCommits.filter((x) => x > t.cEnde).length,
      requests_gesamt: log.length,
      provider_abgebrochen: log.filter((e) => e.abgebrochen).length,
      status: Object.fromEntries(db.map((r) => [r.status, r.n])),
      dauer_bis_abschaltcommit_ms: +(t.cEnde - t.start).toFixed(1),
      notify_latenz_ms: notifyEmpfangen ? +(notifyEmpfangen - (t.aEnde ?? t.cEnde)).toFixed(2) : null,
    };
  }

  const VARIANTEN = ["v1_spec", "v1_sperre_bis_gesendet", "v2", "v2_pause", "v2_ohne_listener", "v2_pause_ohne_listener"];
  const auswertung = {};
  for (const v of VARIANTEN) {
    const laeufe = []; for (let i = 0; i < W; i++) laeufe.push(await lauf(v));
    const summe = (k) => laeufe.reduce((s, l) => s + (l[k] ?? 0), 0);
    const dauer = laeufe.map((l) => l.dauer_bis_abschaltcommit_ms);
    const status = {}; for (const l of laeufe) for (const [k, n] of Object.entries(l.status)) status[k] = (status[k] ?? 0) + n;
    auswertung[v] = {
      wiederholungen: W, jobs_je_lauf: J, parallel_max: PAR,
      laeufe_mit_verstoss: laeufe.filter((l) => l.requests_nach_abschaltcommit > 0 || l.ergebnisse_nach_abschaltcommit > 0).length,
      requests_nach_abschaltcommit: summe("requests_nach_abschaltcommit"),
      requests_nach_commitbeginn: summe("requests_nach_commitbeginn"),
      requests_nach_anforderung: v.startsWith("v2") ? summe("requests_nach_anforderung") : null,
      ergebnisse_nach_abschaltcommit: summe("ergebnisse_nach_abschaltcommit"),
      requests_gesamt: summe("requests_gesamt"), provider_abgebrochen: summe("provider_abgebrochen"), status,
      dauer_bis_abschaltcommit_ms: { p50: perzentil(dauer, 50), p95: perzentil(dauer, 95), max: Math.max(...dauer) },
      laeufe,
    };
    console.log(v, JSON.stringify({ ...auswertung[v], laeufe: undefined }));
  }
  for (const v of VARIANTEN) {
    const a = auswertung[v];
    ok(`T3 [${v}] 0 Requests und 0 uebernommene Ergebnisse nach Abschalt-Commit (${W} x ${J} Jobs, max. ${PAR} parallel)`,
      a.requests_nach_abschaltcommit === 0 && a.ergebnisse_nach_abschaltcommit === 0 && !a.status.laufend,
      { requests_nach_abschaltcommit: a.requests_nach_abschaltcommit, ergebnisse_nach_abschaltcommit: a.ergebnisse_nach_abschaltcommit, laeufe_mit_verstoss: a.laeufe_mit_verstoss, dauer_bis_abschaltcommit_ms: a.dauer_bis_abschaltcommit_ms });
  }
  await listener.end();
  speichereErgebnis(PAR === 5 ? "t3" : `t3_parallel${PAR}`, { pg: pgi.version, auswertung, tests });
} finally {
  await pool.end(); await pgi.stop(); prov.send("ende");
}
