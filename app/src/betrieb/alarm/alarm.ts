// M1-Abnahme Punkt 4: generischer Betriebsalarm fuer Backup-, Retention-, Update-, Reconcile- und Restore-Fehler.
// Kanaele: Webhook (HTTPS POST, HMAC-SHA256-Signatur) und optional SMTP. Nur node:-Module (Offline-Host-Werkzeug).
// Jeder Alarm wird zuerst in einen Spool geschrieben und im Alarm-Journal (JSONL) festgehalten; Zustellfehler bleiben
// offen und werden mit wachsendem Abstand wiederholt (Betriebsdienst alle 5 Minuten und jeder Host-Befehl).
// Der produktive Kanal (Zieladresse, Empfaenger) ist ein PO-/Kundenentscheid und liegt nur in externer Konfiguration.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { smtpSenden, type SmtpKonfiguration } from "./smtp.js";

export type AlarmArt = "backup" | "retention" | "update" | "start" | "reconcile" | "restore" | "zertifikat" | "journal" | "test";
export type Ereignis = { format: 1; id: string; instanz: string; host: string; art: AlarmArt; schwere: "fehler" | "warnung"; text: string; zeit: string };
export type WebhookKonfiguration = { url: string; ca?: string; timeoutMs?: number };
export type AlarmKonfiguration = { webhook?: WebhookKonfiguration; smtp?: SmtpKonfiguration };
export type AlarmSecrets = { hmac?: string; smtpPasswort?: string };
type Kanal = "webhook" | "smtp";
type SpoolEintrag = { ereignis: Ereignis; zugestellt: Kanal[]; versuche: number; naechsterVersuch: string; letzterFehler?: string };

const ARTEN: AlarmArt[] = ["backup", "retention", "update", "start", "reconcile", "restore", "zertifikat", "journal", "test"];
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

export function alarmSpool(o: AlarmOptionen) {
  const offen = join(o.spool, "offen"), journalDatei = join(o.spool, "journal.jsonl");
  const jetzt = o.jetzt ?? Date.now, protokoll = o.protokoll ?? ((t: string) => console.error(t));
  const kanaele = (): Kanal[] => [...(o.konfiguration?.webhook ? ["webhook" as const] : []), ...(o.konfiguration?.smtp ? ["smtp" as const] : [])];
  const journal = (eintrag: object) => { mkdirSync(o.spool, { recursive: true, mode: 0o700 }); appendFileSync(journalDatei, JSON.stringify({ zeit: new Date(jetzt()).toISOString(), ...eintrag }) + "\n", { mode: 0o600 }); };
  const schreibe = (datei: string, e: SpoolEintrag) => { const t = `${datei}.${randomUUID()}.tmp`; writeFileSync(t, JSON.stringify(e), { mode: 0o600, flag: "wx" }); renameSync(t, datei); };
  const sende = async (k: Kanal, e: Ereignis) => {
    if (k === "webhook") await (o.sender?.webhook ?? webhookSenden)(o.konfiguration!.webhook!, o.secrets.hmac!, e, jetzt());
    else await (o.sender?.smtp ?? smtpSenden)(o.konfiguration!.smtp!, o.secrets.smtpPasswort, `[Planora ${e.instanz}] ${e.schwere}: ${e.art}`,
      `${e.text}\n\nInstanz: ${e.instanz}\nHost: ${e.host}\nZeit: ${e.zeit}\nEreignis: ${e.id}\n`);
  };

  /** Offene Alarme zustellen, deren Wartezeit abgelaufen ist (oder alle mit sofort=true). */
  async function zustellen(sofort = false) {
    if (!existsSync(offen)) return { zugestellt: 0, offen: 0 };
    let zugestellt = 0, offenAnzahl = 0;
    for (const name of readdirSync(offen).filter((n) => n.endsWith(".json")).sort()) {
      const datei = join(offen, name);
      let e: SpoolEintrag;
      try { e = JSON.parse(readFileSync(datei, "utf8")); } catch { journal({ art: "spool_defekt", datei: name }); continue; }
      if (!sofort && Date.parse(e.naechsterVersuch) > jetzt()) { offenAnzahl++; continue; }
      const fehler: string[] = [];
      for (const k of kanaele().filter((x) => !e.zugestellt.includes(x))) {
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
    return { zugestellt, offen: offenAnzahl };
  }

  /** Alarm erzeugen: Spool + Journal zuerst, dann sofortiger Zustellversuch. Wirft nie (Alarm darf Fehler nicht verdecken). */
  async function alarmieren(art: AlarmArt, text: string, schwere: Ereignis["schwere"] = "fehler") {
    if (!ARTEN.includes(art)) throw new Error("Unbekannte Alarmart");
    const ereignis: Ereignis = { format: 1, id: randomUUID(), instanz: o.instanz, host: hostname(), art, schwere, text: text.slice(0, 1000), zeit: new Date(jetzt()).toISOString() };
    protokoll(`Betriebsalarm ${art} (${schwere}): ${ereignis.text}`);
    try {
      journal({ art: "erzeugt", ereignis });
      if (!kanaele().length) { journal({ art: "kein_kanal", ereignis: ereignis.id }); return ereignis; }
      mkdirSync(offen, { recursive: true, mode: 0o700 });
      schreibe(join(offen, `${ereignis.zeit.replace(/[:.]/g, "-")}-${ereignis.id}.json`), { ereignis, zugestellt: [], versuche: 0, naechsterVersuch: ereignis.zeit });
      await zustellen();
    } catch (e) { protokoll(`Alarm-Spool fehlerhaft: ${(e as Error).message}`); }
    return ereignis;
  }
  return { alarmieren, zustellen };
}

/** Fuehrt arbeit aus; bei Fehler wird alarmiert und der Fehler weitergereicht. Erfolg erzeugt keinen Alarm. */
/** Minimale Alarm-Schnittstelle (alarmSpool oder Test-Fake). */
export type Alarmierer = { alarmieren(art: AlarmArt, text: string, schwere?: Ereignis["schwere"]): Promise<unknown> };
export async function mitAlarm<T>(alarm: Alarmierer, art: AlarmArt, beschreibung: string, arbeit: () => Promise<T>): Promise<T> {
  try { return await arbeit(); } catch (e) {
    // Nur die erste Zeile der Fehlermeldung, gekuerzt: Docker-/Werkzeugmeldungen enthalten keine Secrets, aber Ausgaben bleiben kurz.
    await alarm.alarmieren(art, `${beschreibung}: ${String((e as Error)?.message ?? e).split("\n")[0].slice(0, 300)}`);
    throw e;
  }
}
