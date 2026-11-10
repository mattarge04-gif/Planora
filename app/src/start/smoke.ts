// Schritt 6: fluechtiges Testkonto, Test-Session und Entzug bei gesetzter Wartung; keine HTTP-Ausnahme fuer Login.
import pg from "pg";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Readable } from "node:stream";
import { baueAuth, CLIENT_IP_HEADER, hashPasswort } from "../auth/auth.js";
import { baueServer } from "../server.js";
import { MANIFEST_VERSION, geliefert, type Stufe } from "../module/manifest.js";
import { dateiAblage } from "../ablage/ablage.js";
import { dbKonfig, env, geheimnis, release, starte } from "./konfig.js";

starte(async () => {
  let eingabe = ""; for await (const t of process.stdin) eingabe += t;
  const erwartet = JSON.parse(eingabe);
  if (erwartet.modulmanifestVersion !== MANIFEST_VERSION) throw new Error("Modulmanifest-Version weicht vom Release ab");
  const pool = new pg.Pool({ ...dbKonfig("planora_app"), max: 3 });
  const id = randomUUID(), audit = randomUUID(), email = `smoke-${id}@planora.invalid`, passwort = randomBytes(32).toString("base64url");
  const baseURL = env("PLANORA_BASE_URL"), secret = geheimnis("auth_secret");
  const auth = baueAuth(pool, { baseURL, secret });
  const app = await baueServer({ pool, stufe: Number(env("PLANORA_STUFE", "1")) as Stufe, baseURL, secret, ablageWurzel: env("PLANORA_ABLAGE", "/daten/dokumente"), release: release() });
  let datei: string | undefined;
  const ablage = dateiAblage(env("PLANORA_ABLAGE", "/daten/dokumente"));
  try {
    const h = await app.inject({ method: "GET", url: "/api/health" });
    if (h.statusCode !== 200 || !h.json().wartung) throw new Error("Smoke braucht gesetzte Wartung");
    await pool.query(`insert into "user"(id,name,email,email_verified,created_at,updated_at) values($1,'Update-Smoke',$2,true,now(),now())`, [id, email]);
    await pool.query("insert into konto_status(benutzer_id,status,audit_id) values($1,'aktiv',$2)", [id, audit]);
    await pool.query("insert into rolle_zuordnung(benutzer_id,rolle) values($1,'betreiber')", [id]);
    await pool.query("insert into account(id,account_id,provider_id,user_id,password,created_at,updated_at) values($1,$1,'credential',$1,$2,now(),now())", [id, await hashPasswort(passwort)]);
    // Better Auth signiert den Cookie. Die echte Set-Cookie-Antwort statt des rohen Tokens verwenden.
    const antwort = await auth.api.signInEmail({ body: { email, password: passwort }, headers: new Headers({ origin: baseURL, [CLIENT_IP_HEADER]: `smoke-${id}` }), asResponse: true });
    const cookies = antwort.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    if (!antwort.ok || !cookies) throw new Error("Smoke-Login fehlgeschlagen");
    const ich = await app.inject({ method: "GET", url: "/api/ich", headers: { cookie: cookies } });
    if (ich.statusCode !== 200 || ich.json().id !== id) throw new Error("Smoke-Testsession ungueltig");
    const module = await app.inject({ method: "GET", url: "/api/admin/module", headers: { cookie: cookies } });
    const ids = geliefert(Number(env("PLANORA_STUFE", "1")) as Stufe).map((m) => m.id);
    if (module.statusCode !== 200 || JSON.stringify(module.json().map((m: { id: string }) => m.id)) !== JSON.stringify(ids)) throw new Error("Modulmanifest-Smoke fehlgeschlagen");
    await pool.query("delete from session where user_id=$1", [id]);
    if ((await app.inject({ method: "GET", url: "/api/ich", headers: { cookie: cookies } })).statusCode !== 401) throw new Error("Session-Entzug wirkt nicht");
    const vorhanden = (await pool.query("select schluessel,sha256 from datei order by schluessel limit 1")).rows[0];
    if (vorhanden) {
      const hash = createHash("sha256"); for await (const teil of ablage.lese(vorhanden.schluessel)) hash.update(teil);
      if (hash.digest("hex") !== vorhanden.sha256) throw new Error("Datei-Smoke: Hash weicht ab");
    } else {
      const daten = randomBytes(32), d = await ablage.schreibeNeu(Readable.from(daten)); datei = d.schluessel;
      const hash = createHash("sha256"); for await (const teil of ablage.lese(datei)) hash.update(teil);
      if (hash.digest("hex") !== d.sha256) throw new Error("Datei-Smoke fehlgeschlagen");
    }
    console.log(JSON.stringify({ smoke: "ok", health: true, login: true, sessionEntzug: true, modulmanifest: true, datei: true }));
  } finally {
    // Delete user kaskadiert Sessions, Credentials, Status. Auch bei fehlgeschlagenem Smoke keine Test-Session behalten.
    try {
      await pool.query('delete from "user" where id=$1', [id]);
      await pool.query("delete from anmelde_fehlversuch where schluessel = any($1)", [[`konto:${email}`, `ip:smoke-${id}`]]);
      if (datei) await ablage.entferne(datei);
    } finally { await app.close(); await pool.end(); }
  }
});
