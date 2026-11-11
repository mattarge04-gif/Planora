// M1-Abnahme Punkt 4: generischer Betriebsalarm fuer Backup-, Retention-, Update-, Reconcile- und Restore-Fehler.
// Kanaele: Webhook (HTTPS POST, HMAC-SHA256-Signatur) und optional SMTP. Nur node:-Module (Offline-Host-Werkzeug).
// Jeder Alarm wird zuerst in einen Spool geschrieben und im Alarm-Journal (JSONL) festgehalten; Zustellfehler bleiben
// offen und werden mit wachsendem Abstand wiederholt (Betriebsdienst alle 5 Minuten und jeder Host-Befehl).
// Der produktive Kanal (Zieladresse, Empfaenger) ist ein PO-/Kundenentscheid und liegt nur in externer Konfiguration.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { smtpSenden, type SmtpKonfiguration } from "./smtp.js";

export type AlarmArt = "backup" | "retention" | "update" | "start" | "reconcile" | "restore" | "zertifikat" | "journal" | "alarm" | "test";
export type Ereignis = { format: 1; id: string; instanz: string; host: string; art: AlarmArt; schwere: "fehler" | "warnung"; text: string; zeit: string };
export type WebhookKonfiguration = { url: string; ca?: string; timeoutMs?: number };
export type AlarmKonfiguration = { webhook?: WebhookKonfiguration; smtp?: SmtpKonfiguration };
export type AlarmSecrets = { hmac?: string; smtpPasswort?: string };
type Kanal = "webhook" | "smtp";
/** kanaele: beim Erzeugen festgelegte, erforderliche Kanaele (leer = noch offen wegen ungueltiger Konfiguration). */
type SpoolEintrag = { ereignis: Ereignis; kanaele: Kanal[]; zugestellt: Kanal[]; versuche: number; naechsterVersuch: string; letzterFehler?: string };

const ARTEN: AlarmArt[] = ["backup", "retention", "update", "start", "reconcile", "restore", "zertifikat", "journal", "alarm", "test"];
/** [A] Wiederholungsabstand: 1, 2, 4 ... Minuten, hoechstens 60 Minuten. */
export const abstandMs = (versuche: number) => Math.min(2 ** Math.max(0, versuche - 1) * 60_000, 3_600_000);

/** Nicht geheime Konfiguration aus alarm.json; unbekannte Felder (z.B. Secrets) werden abgelehnt. */
export function pruefeAlarmKonfiguration(o: unknown): asserts o is AlarmKonfiguration {
  const k = o as AlarmKonfiguration;
  if (!k || typeof k !== "object" || Array.isArray(k) || Object.keys(k).some((s) => !["webhook", "smtp"].includes(s))) throw new Error("alarm.json: nur webhook und smtp erlaubt");
  if (!k.webhook && !k.smtp) throw new Error("alarm.json: mindestens ein Kanal (webhook oder smtp)");
  if (k.webhook) {
    const w = k.webhook;
    if (Object.keys(w).some((s) => !["url", "ca", "timeoutMs"].includes(s))) throw new Error("alarm.json webhook: nur url, ca, timeoutMs");
    let u: URL;
    try { u = new URL(w.url); } catch { throw new Error("alarm.json webhook.url ungueltig"); }
    if (u.protocol !== "https:" || u.username || u.password) throw new Error("alarm.json webhook.url: HTTPS ohne Zugangsdaten in der URL");
    if (w.ca !== undefined && (typeof w.ca !== "string" || !w.ca.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(w.ca))) throw new Error("alarm.json webhook.ca: absoluter Pfad zu einer PEM-Datei");
    if (w.timeoutMs !== undefined && (!Number.isInteger(w.timeoutMs) || w.timeoutMs < 1000 || w.timeoutMs > 60_000)) throw new Error("alarm.json webhook.timeoutMs: 1000 bis 60000");
  }
  if (k.smtp) {
    const s = k.smtp;
    if (Object.keys(s).some((x) => !["host", "port", "absender", "empfaenger", "starttls", "benutzer", "ca"].includes(x))) throw new Error("alarm.json smtp: unbekanntes Feld (Passwort gehoert in secrets/alarm_smtp_passwort)");
    if (!s.host || !Number.isInteger(s.port) || s.port < 1 || s.port > 65535 || typeof s.starttls !== "boolean" || !/^[^\s@<>]+@[^\s@<>]+$/.test(s.absender ?? "")
      || !Array.isArray(s.empfaenger) || !s.empfaenger.length || s.empfaenger.some((e) => !/^[^\s@<>]+@[^\s@<>]+$/.test(e))) throw new Error("alarm.json smtp: host, port, absender, empfaenger[], starttls pruefen");
  }
}

export function signiere(schluessel: string, zeit: string, body: string) {
  return "v1=" + createHmac("sha256", schluessel).update(`${zeit}.${body}`).digest("hex");
}
/** Fuer Empfaenger: Signatur und Zeitfenster (Replay-Schutz) pruefen. */
export function pruefeSignatur(schluessel: string, zeit: string, body: string, signatur: string, jetzt = Date.now(), toleranzS = 300) {
  if (!/^\d{9,12}$/.test(zeit) || Math.abs(jetzt / 1000 - Number(zeit)) > toleranzS) return false;
  const a = Buffer.from(signiere(schluessel, zeit, body)), b = Buffer.from(signatur);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** HTTPS-POST; nur 2xx gilt als zugestellt. Keine Umleitungen. */
export async function webhookSenden(w: WebhookKonfiguration, schluessel: string, ereignis: Ereignis, jetzt = Date.now()) {
  const { request } = await import("node:https");
  const body = JSON.stringify(ereignis), zeit = String(Math.floor(jetzt / 1000));
  const ca = w.ca ? readFileSync(w.ca, "utf8") : undefined;
  await new Promise<void>((ok, fehler) => {
    const req = request(w.url, {
      method: "POST", ca, timeout: w.timeoutMs ?? 10_000,
      headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "user-agent": "planora-alarm/1",
        "x-planora-ereignis": ereignis.id, "x-planora-zeit": zeit, "x-planora-signatur": signiere(schluessel, zeit, body) },
    }, (res) => {
      res.resume();
      res.on("end", () => (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 ? ok() : fehler(new Error(`Webhook antwortet ${res.statusCode}`))));
    });
    req.on("timeout", () => req.destroy(new Error("Webhook-Zeitueberschreitung")));
    req.on("error", (e) => fehler(new Error(`Webhook nicht erreichbar: ${(e as NodeJS.ErrnoException).code ?? e.message}`)));
    req.end(body);
  });
}

export type AlarmOptionen = {
  instanz: string; spool: string; konfiguration?: AlarmKonfiguration; secrets: AlarmSecrets;
  /** Fuer Tests austauschbar. */
  sender?: { webhook?: typeof webhookSenden; smtp?: typeof smtpSenden };
  jetzt?: () => number; protokoll?: (text: string) => void;
  /** Gesetzt, wenn alarm.json/Secrets ungueltig sind: dann wird nichts zugestellt oder geloescht (PP11a-4). */
  konfigurationFehler?: string;
};

/** Kanal-Konfiguration einer Instanz: /etc/planora/<instanz>/alarm.json und Secrets unter secrets/. */
export function ladeAlarmKonfiguration(etc: string): { konfiguration?: AlarmKonfiguration; secrets: AlarmSecrets } {
  const datei = join(etc, "alarm.json");
  if (!existsSync(datei)) return { secrets: {} };
  const konfiguration = JSON.parse(readFileSync(datei, "utf8")); pruefeAlarmKonfiguration(konfiguration);
  const lies = (n: string) => existsSync(join(etc, "secrets", n)) ? readFileSync(join(etc, "secrets", n), "utf8").trim() : undefined;
  const secrets = { hmac: lies("alarm_hmac"), smtpPasswort: lies("alarm_smtp_passwort") };
  if (konfiguration.webhook && (!secrets.hmac || secrets.hmac.length < 32)) throw new Error("Webhook verlangt secrets/alarm_hmac (mindestens 32 Zeichen)");
  if (konfiguration.smtp?.benutzer && !secrets.smtpPasswort) throw new Error("SMTP-Benutzer verlangt secrets/alarm_smtp_passwort");
  return { konfiguration, secrets };
}

/** [A] Hoechstens so viele offene Alarme im Spool; aeltere werden verworfen und journalisiert (PP11a-8). */
export const MAX_OFFEN = 200;
/** [A] Eine andauernde gleiche Stoerung wird hoechstens einmal je 20 h erneut gemeldet (PP11a-8). 20 statt 24 h, damit
 *  ein naechtlicher Fehler trotz RandomizedDelaySec des Timers in der Folgenacht wieder gemeldet wird (PP11a-N-5). */
export const ERINNERUNG_MS = 20 * 3_600_000;
/** [A] Ab dieser Groesse wird journal.jsonl nach journal.1.jsonl rotiert (eine Generation, PP11a-N-6). */
export const JOURNAL_MAX_BYTES = 5 * 1024 * 1024;
type Stoerungen = Record<string, { seit: string; gemeldet: string; anzahl: number; art: AlarmArt; text?: string }>;

/** Kurze Dateisperre fuer stoerungen.json (mehrere Host-Prozesse, PP11a-N-7). Verwaist nach 30 s. */
function mitDateisperre<T>(datei: string, arbeit: () => T): T {
  const sperre = `${datei}.lock`, warte = new Int32Array(new SharedArrayBuffer(4));
  for (let n = 0; ; n++) {
    try { closeSync(openSync(sperre, "wx", 0o600)); break; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try { if (Date.now() - statSync(sperre).mtimeMs > 30_000) { rmSync(sperre, { force: true }); continue; } } catch { continue; }
      if (n > 250) throw new Error("stoerungen.json gesperrt");
      Atomics.wait(warte, 0, 0, 20);
    }
  }
  try { return arbeit(); } finally { rmSync(sperre, { force: true }); }
}

export function alarmSpool(o: AlarmOptionen) {
  const offen = join(o.spool, "offen"), journalDatei = join(o.spool, "journal.jsonl"), stoerungDatei = join(o.spool, "stoerungen.json");
  const jetzt = o.jetzt ?? Date.now, protokoll = o.protokoll ?? ((t: string) => console.error(t));
  const konfiguriert = (): Kanal[] => [...(o.konfiguration?.webhook ? ["webhook" as const] : []), ...(o.konfiguration?.smtp ? ["smtp" as const] : [])];
  const journal = (eintrag: object) => {
    mkdirSync(o.spool, { recursive: true, mode: 0o700 });
    try { if (statSync(journalDatei).size > JOURNAL_MAX_BYTES) renameSync(journalDatei, join(o.spool, "journal.1.jsonl")); } catch { /* noch kein Journal */ }
    appendFileSync(journalDatei, JSON.stringify({ zeit: new Date(jetzt()).toISOString(), ...eintrag }) + "\n", { mode: 0o600 });
  };
  const verworfenDatei = join(o.spool, "verworfen.json");
  const schreibe = (datei: string, e: unknown) => { mkdirSync(join(datei, ".."), { recursive: true, mode: 0o700 }); const t = `${datei}.${randomUUID()}.tmp`; writeFileSync(t, JSON.stringify(e), { mode: 0o600, flag: "wx" }); renameSync(t, datei); };
  const sende = async (k: Kanal, e: Ereignis) => {
    if (k === "webhook") await (o.sender?.webhook ?? webhookSenden)(o.konfiguration!.webhook!, o.secrets.hmac!, e, jetzt());
    else await (o.sender?.smtp ?? smtpSenden)(o.konfiguration!.smtp!, o.secrets.smtpPasswort, `[Planora ${e.instanz}] ${e.schwere}: ${e.art}`,
      [e.text, "", `Instanz: ${e.instanz}`, `Host: ${e.host}`, `Zeit: ${e.zeit}`, `Ereignis: ${e.id}`, ""].join("\n"));
  };
  const leseStoerungen = (): Stoerungen => { try { return JSON.parse(readFileSync(stoerungDatei, "utf8")); } catch { return {}; } };

  /**
   * Offene Alarme zustellen, deren Wartezeit abgelaufen ist (oder alle mit sofort=true).
   * PP11a-4: Ohne gueltige Konfiguration wird nichts zugestellt, quittiert oder geloescht. Jeder Eintrag traegt die
   * erforderlichen Kanaele; ein nicht mehr konfigurierter Kanal gilt als Zustellfehler, nicht als erledigt.
   */
  async function zustellen(sofort = false) {
    if (!existsSync(offen)) return { zugestellt: 0, offen: 0 };
    const namen = readdirSync(offen).filter((n) => n.endsWith(".json")).sort();
    if (o.konfigurationFehler) {
      if (namen.length) journal({ art: "zustellung_ausgesetzt", grund: o.konfigurationFehler.slice(0, 300), offen: namen.length });
      return { zugestellt: 0, offen: namen.length };
    }
    let zugestellt = 0, offenAnzahl = 0;
    for (const name of namen) {
      const datei = join(offen, name);
      let e: SpoolEintrag;
      try { e = JSON.parse(readFileSync(datei, "utf8")); } catch { journal({ art: "spool_defekt", datei: name }); offenAnzahl++; continue; }
      if (!sofort && Date.parse(e.naechsterVersuch) > jetzt()) { offenAnzahl++; continue; }
      // Eintraege aus der Zeit einer ungueltigen Konfiguration erhalten jetzt ihre Kanaele; danach bleiben sie fest.
      if (!e.kanaele?.length) e.kanaele = konfiguriert();
      const fehler: string[] = [];
      if (!e.kanaele.length) fehler.push("kein Alarmkanal konfiguriert");
      for (const k of e.kanaele.filter((x) => !e.zugestellt.includes(x))) {
        if (!konfiguriert().includes(k)) { fehler.push(`${k}: Kanal nicht mehr konfiguriert`); continue; }
        try { await sende(k, e.ereignis); e.zugestellt.push(k); journal({ art: "zugestellt", ereignis: e.ereignis.id, kanal: k, versuch: e.versuche + 1 }); }
        catch (x) { fehler.push(`${k}: ${(x as Error).message}`); }
      }
      e.versuche++;
      if (!fehler.length) { rmSync(datei, { force: true }); zugestellt++; continue; }
      e.letzterFehler = fehler.join("; ").slice(0, 500);
      e.naechsterVersuch = new Date(jetzt() + abstandMs(e.versuche)).toISOString();
      schreibe(datei, e); offenAnzahl++;
      journal({ art: "zustellfehler", ereignis: e.ereignis.id, versuch: e.versuche, fehler: e.letzterFehler, naechsterVersuch: e.naechsterVersuch });
      protokoll(`Alarm ${e.ereignis.id} nicht zugestellt (Versuch ${e.versuche}): ${e.letzterFehler}`);
    }
    // PP11a-N-6: nach Ueberlauf verworfene Alarme beim ersten erfolgreichen Versand als Sammelmeldung nachreichen.
    if (zugestellt > 0 && existsSync(verworfenDatei)) {
      let v: { anzahl: number; seit: string } | undefined;
      try { v = JSON.parse(readFileSync(verworfenDatei, "utf8")); } catch { /* defekt: trotzdem melden */ }
      rmSync(verworfenDatei, { force: true });
      await alarmieren("alarm", `${v?.anzahl ?? "Unbekannt viele"} Alarme wurden wegen Spool-Ueberlauf (> ${MAX_OFFEN}) verworfen${v ? ` seit ${v.seit}` : ""}; Details in alarm/journal.jsonl`, "warnung");
    }
    return { zugestellt, offen: offenAnzahl };
  }

  /** Spool begrenzen: aelteste offene Eintraege verwerfen (journalisiert). */
  function begrenzen() {
    const namen = readdirSync(offen).filter((n) => n.endsWith(".json")).sort();
    for (const name of namen.slice(0, Math.max(0, namen.length - MAX_OFFEN + 1))) {
      rmSync(join(offen, name), { force: true });
      journal({ art: "verworfen", datei: name, grund: `mehr als ${MAX_OFFEN} offene Alarme` });
      let v = { anzahl: 0, seit: new Date(jetzt()).toISOString() };
      try { v = JSON.parse(readFileSync(verworfenDatei, "utf8")); } catch { /* erster Ueberlauf */ }
      v.anzahl++; schreibe(verworfenDatei, v);
    }
  }

  /**
   * Alarm erzeugen: Spool + Journal zuerst, dann sofortiger Zustellversuch. Wirft nie (Alarm darf Fehler nicht verdecken).
   * Mit `stoerung` werden Wiederholungen derselben andauernden Stoerung zusammengefasst (Erinnerung nach 24 h).
   */
  async function alarmieren(art: AlarmArt, text: string, schwere: Ereignis["schwere"] = "fehler", stoerung?: string) {
    if (!ARTEN.includes(art)) throw new Error("Unbekannte Alarmart");
    const ereignis: Ereignis = { format: 1, id: randomUUID(), instanz: o.instanz, host: hostname(), art, schwere, text: text.slice(0, 1000), zeit: new Date(jetzt()).toISOString() };
    try {
      if (stoerung) {
        mkdirSync(o.spool, { recursive: true, mode: 0o700 });
        const aggregiert = mitDateisperre(stoerungDatei, () => {
          const s = leseStoerungen(), alt = s[stoerung], kern = ereignis.text.slice(0, 200);
          // Gleiche Meldung innerhalb der Erinnerungsfrist: nur zaehlen. Eine geaenderte Meldung wird neu gemeldet (PP11a-N-5).
          if (alt && jetzt() - Date.parse(alt.gemeldet) < ERINNERUNG_MS && (alt.text === undefined || alt.text === kern)) {
            alt.anzahl++; schreibe(stoerungDatei, s);
            journal({ art: "aggregiert", stoerung, anzahl: alt.anzahl, text: kern });
            protokoll(`Betriebsalarm ${art} (${schwere}, wiederholt ${alt.anzahl}x seit ${alt.seit}): ${ereignis.text}`);
            return true;
          }
          if (alt) ereignis.text = `${ereignis.text} (andauernd seit ${alt.seit}, ${alt.anzahl + 1} Vorkommen)`.slice(0, 1000);
          s[stoerung] = { seit: alt?.seit ?? ereignis.zeit, gemeldet: ereignis.zeit, anzahl: (alt?.anzahl ?? 0) + 1, art, text: kern };
          schreibe(stoerungDatei, s);
          return false;
        });
        if (aggregiert) return ereignis;
      }
      protokoll(`Betriebsalarm ${art} (${schwere}): ${ereignis.text}`);
      journal({ art: "erzeugt", ereignis, ...(stoerung ? { stoerung } : {}) });
      if (!konfiguriert().length && !o.konfigurationFehler) { journal({ art: "kein_kanal", ereignis: ereignis.id }); return ereignis; }
      mkdirSync(offen, { recursive: true, mode: 0o700 });
      begrenzen();
      // Bei ungueltiger Konfiguration bleiben die Kanaele offen und werden bei der ersten gueltigen Zustellung festgelegt.
      schreibe(join(offen, `${ereignis.zeit.replace(/[:.]/g, "-")}-${ereignis.id}.json`), { ereignis, kanaele: o.konfigurationFehler ? [] : konfiguriert(), zugestellt: [], versuche: 0, naechsterVersuch: ereignis.zeit } satisfies SpoolEintrag);
      await zustellen();
    } catch (e) { protokoll(`Alarm-Spool fehlerhaft: ${(e as Error).message}`); }
    return ereignis;
  }

  /** Stoerung beendet: Zustand loeschen und einmalig als behoben melden, falls sie gemeldet war. */
  async function behoben(stoerung: string, text: string) {
    if (!existsSync(stoerungDatei)) return;
    let alt: Stoerungen[string] | undefined;
    try {
      alt = mitDateisperre(stoerungDatei, () => { const s = leseStoerungen(), a = s[stoerung]; if (a) { delete s[stoerung]; schreibe(stoerungDatei, s); } return a; });
    } catch (e) { protokoll(`Alarm-Spool fehlerhaft: ${(e as Error).message}`); return; }
    if (!alt) return;
    await alarmieren(alt.art, `Behoben: ${text} (gestoert seit ${alt.seit}, ${alt.anzahl} Vorkommen)`, "warnung");
  }
  return { alarmieren, zustellen, behoben };
}

/** Alarm einer Instanz laden. Eine ungueltige alarm.json verhindert keinen Betriebsbefehl, haelt aber die Zustellung an. */
export function instanzAlarm(instanz: string, etc: string, varVerzeichnis: string, protokoll?: (t: string) => void) {
  let kanal: ReturnType<typeof ladeAlarmKonfiguration> = { secrets: {} }, konfigurationFehler: string | undefined;
  try { kanal = ladeAlarmKonfiguration(etc); } catch (e) {
    konfigurationFehler = (e as Error).message;
    (protokoll ?? console.error)(`Alarmkonfiguration ungueltig; Alarme bleiben im Spool, bis sie korrigiert ist: ${konfigurationFehler}`);
  }
  return alarmSpool({ instanz, spool: join(varVerzeichnis, "alarm"), ...kanal, konfigurationFehler, protokoll });
}

/** Minimale Alarm-Schnittstelle (alarmSpool oder Test-Fake). */
export type Alarmierer = { alarmieren(art: AlarmArt, text: string, schwere?: Ereignis["schwere"], stoerung?: string): Promise<unknown>; behoben?(stoerung: string, text: string): Promise<void> };

/** Erste Zeile der Fehlermeldung, gekuerzt: Docker-/Werkzeugmeldungen enthalten keine Secrets, Ausgaben bleiben kurz. */
export const kurz = (e: unknown) => String((e as Error)?.message ?? e).split("\n")[0].slice(0, 300);

/** Fuehrt arbeit aus; bei Fehler wird alarmiert und der Fehler weitergereicht. Erfolg erzeugt keinen Alarm. */
export async function mitAlarm<T>(alarm: Alarmierer, art: AlarmArt, beschreibung: string, arbeit: () => Promise<T>, stoerung?: string): Promise<T> {
  try {
    const r = await arbeit();
    if (stoerung) await alarm.behoben?.(stoerung, beschreibung);
    return r;
  } catch (e) {
    await alarm.alarmieren(art, `${beschreibung}: ${kurz(e)}`, "fehler", stoerung);
    throw e;
  }
}
