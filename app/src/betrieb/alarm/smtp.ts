// Minimaler SMTP-Versand fuer Betriebsalarme (optionaler Kanal). Nur node:-Module.
// STARTTLS (Port 587) oder implizites TLS (Port 465); unverschluesselt nur mit starttls=false auf einem anderen Port [A]
// (z.B. lokales Relay auf dem Host). AUTH PLAIN nur ueber TLS.
import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

export type SmtpKonfiguration = { host: string; port: number; absender: string; empfaenger: string[]; starttls: boolean; benutzer?: string; ca?: string };

class Leser {
  private puffer = ""; private wartend?: (z: string) => void; private fehler?: Error;
  constructor(private s: Socket | TLSSocket) { this.anschliessen(s); }
  anschliessen(s: Socket | TLSSocket) {
    this.s = s;
    s.setEncoding("utf8");
    s.on("data", (d: string) => { this.puffer += d; this.pruefe(); });
    s.on("error", (e) => { this.fehler = e; this.pruefe(); });
    s.on("close", () => { this.fehler ??= new Error("SMTP-Verbindung geschlossen"); this.pruefe(); });
  }
  private pruefe() {
    if (!this.wartend) return;
    // Antwort komplett, wenn eine Zeile "ddd " (ohne Bindestrich) erreicht ist.
    const zeilen = this.puffer.split("\r\n");
    const ende = zeilen.findIndex((z) => /^\d{3} /.test(z) || /^\d{3}$/.test(z));
    if (ende >= 0 && zeilen.length > ende + 1) {
      const antwort = zeilen.slice(0, ende + 1).join("\n");
      this.puffer = zeilen.slice(ende + 1).join("\r\n");
      const w = this.wartend; this.wartend = undefined; w(antwort);
    } else if (this.fehler) { const w = this.wartend; this.wartend = undefined; w(`FEHLER ${this.fehler.message}`); }
  }
  antwort(): Promise<string> { return new Promise((ok) => { this.wartend = ok; this.pruefe(); }); }
  get socket() { return this.s; }
}

async function erwarte(l: Leser, code: number, schritt: string) {
  const a = await l.antwort();
  if (!a.startsWith(String(code))) throw new Error(`SMTP ${schritt}: ${a.split("\n")[0].slice(0, 120)}`);
  return a;
}

export async function smtpSenden(k: SmtpKonfiguration, passwort: string | undefined, betreff: string, text: string, timeoutMs = 20_000) {
  const ca = k.ca ? readFileSync(k.ca, "utf8") : undefined;
  const implizit = k.port === 465;
  const roh = implizit ? tlsConnect({ host: k.host, port: k.port, servername: k.host, ca }) : netConnect({ host: k.host, port: k.port });
  roh.setTimeout(timeoutMs, () => roh.destroy(new Error("SMTP-Zeitueberschreitung")));
  const l = new Leser(roh);
  let tls = implizit;
  const sende = async (zeile: string, code: number, schritt: string) => { l.socket.write(zeile + "\r\n"); return erwarte(l, code, schritt); };
  try {
    await erwarte(l, 220, "Begruessung");
    const ehlo = await sende("EHLO planora-alarm", 250, "EHLO");
    if (k.starttls && !implizit) {
      if (!/STARTTLS/i.test(ehlo)) throw new Error("SMTP-Server bietet kein STARTTLS an");
      await sende("STARTTLS", 220, "STARTTLS");
      const sicher = tlsConnect({ socket: roh as Socket, servername: k.host, ca });
      roh.removeAllListeners("data"); roh.removeAllListeners("error"); roh.removeAllListeners("close");
      await new Promise<void>((ok, f) => { sicher.once("secureConnect", ok); sicher.once("error", f); });
      l.anschliessen(sicher); tls = true;
      await sende("EHLO planora-alarm", 250, "EHLO nach STARTTLS");
    }
    if (k.benutzer) {
      if (!tls) throw new Error("SMTP-Anmeldung nur ueber TLS");
      await sende(`AUTH PLAIN ${Buffer.from(`\0${k.benutzer}\0${passwort ?? ""}`).toString("base64")}`, 235, "AUTH");
    }
    await sende(`MAIL FROM:<${k.absender}>`, 250, "MAIL FROM");
    for (const e of k.empfaenger) await sende(`RCPT TO:<${e}>`, 250, "RCPT TO");
    await sende("DATA", 354, "DATA");
    const kopf = [`From: <${k.absender}>`, `To: ${k.empfaenger.map((e) => `<${e}>`).join(", ")}`, `Subject: ${betreff.replace(/[\r\n]/g, " ")}`,
      `Date: ${new Date().toUTCString()}`, `Message-ID: <${randomUUID()}@planora-alarm>`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit"];
    // Dot-Stuffing (RFC 5321 4.5.2)
    const rumpf = text.replace(/\r?\n/g, "\r\n").split("\r\n").map((z) => (z.startsWith(".") ? "." + z : z)).join("\r\n");
    await sende(`${kopf.join("\r\n")}\r\n\r\n${rumpf}\r\n.`, 250, "Nachricht");
    l.socket.write("QUIT\r\n");
  } finally { l.socket.end(); }
}
