// Kunden-Zertifikat (M1-Abnahme Punkt 2): Pruefung, Ablage und Rotation. Nur node:-Module (Offline-Werkzeug).
// Caddy liest Zertifikat und Schluessel beim Start aus /zertifikat (Bind-Mount, read-only); die Admin-API ist aus,
// deshalb wird nach einer Rotation der Proxy neu gestartet.
import { X509Certificate, createPrivateKey } from "node:crypto";
import { chmodSync, chownSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dateiSperre } from "../update/zustand.js";
import { join } from "node:path";
import { schreibeAtomar } from "./plan.js";
/** Wert fuer PLANORA_TLS: Pfade im Proxy-Container (siehe compose.yaml, Volume /zertifikat). */
export { KUNDENZERTIFIKAT_TLS } from "./plan.js";
/** Unprivilegierte Proxy-UID (compose.yaml, PP9-8). */
const PROXY_UID = 1001;
/** [A] Ab dieser Restlaufzeit warnt Planora bei Installation und Rotation. */
export const WARNTAGE = 30;

export type Zertifikatsinfo = { subjekt: string; aussteller: string; gueltigBis: string; restTage: number; fingerprint256: string; kette: number; warnungen: string[] };

const PEM_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

/**
 * Prueft eine Kunden-Zertifikatskette (Blatt zuerst, danach optionale Zwischenzertifikate) und den unverschluesselten
 * privaten Schluessel. Die Kunden-Root-CA gehoert NICHT in die Datei; Clients vertrauen ihr ueber die Kunden-IT.
 */
export function pruefeKundenzertifikat(zertifikatPem: string, schluesselPem: string, domain: string, jetzt = new Date()): Zertifikatsinfo {
  const bloecke = zertifikatPem.match(PEM_BLOCK) ?? [];
  if (!bloecke.length) throw new Error("Zertifikatsdatei enthaelt kein PEM-Zertifikat");
  if (/PRIVATE KEY/.test(zertifikatPem)) throw new Error("Zertifikatsdatei enthaelt einen privaten Schluessel; Schluessel getrennt uebergeben");
  let kette: X509Certificate[];
  try { kette = bloecke.map((b) => new X509Certificate(b)); } catch { throw new Error("Zertifikat nicht lesbar (PEM/X.509 erwartet)"); }
  const blatt = kette[0];
  if (blatt.ca) throw new Error("Erstes Zertifikat ist ein CA-Zertifikat; das Serverzertifikat muss zuerst stehen");
  let schluessel;
  try { schluessel = createPrivateKey(schluesselPem); } catch { throw new Error("Privater Schluessel nicht lesbar oder passwortgeschuetzt (Caddy braucht einen unverschluesselten PEM-Schluessel)"); }
  if (!blatt.checkPrivateKey(schluessel)) throw new Error("Privater Schluessel passt nicht zum Zertifikat");
  if (!blatt.checkHost(domain.toLowerCase())) throw new Error(`Zertifikat gilt nicht fuer ${domain} (subjectAltName pruefen)`);
  const von = new Date(blatt.validFrom), bis = new Date(blatt.validTo);
  if (!(von <= jetzt)) throw new Error(`Zertifikat noch nicht gueltig (ab ${von.toISOString()})`);
  if (!(bis > jetzt)) throw new Error(`Zertifikat abgelaufen (${bis.toISOString()})`);
  for (let i = 0; i + 1 < kette.length; i++) {
    if (!kette[i + 1].ca || !kette[i].checkIssued(kette[i + 1]) || !kette[i].verify(kette[i + 1].publicKey)) throw new Error(`Zertifikatskette unterbrochen nach Eintrag ${i + 1}`);
    if (new Date(kette[i + 1].validTo) <= jetzt) throw new Error(`Zwischenzertifikat ${i + 1} abgelaufen`);
  }
  const restTage = Math.floor((bis.getTime() - jetzt.getTime()) / 86_400_000);
  const warnungen = restTage < WARNTAGE ? [`Zertifikat laeuft in ${restTage} Tagen ab (${bis.toISOString().slice(0, 10)})`] : [];
  return { subjekt: blatt.subject, aussteller: blatt.issuer, gueltigBis: bis.toISOString(), restTage, fingerprint256: blatt.fingerprint256, kette: kette.length, warnungen };
}

/** SHA-256 des DER-Blattzertifikats im Format von X509Certificate.fingerprint256 (fuer Vergleiche im Betrieb). */
export const fingerprint = (pem: string) => new X509Certificate((pem.match(PEM_BLOCK) ?? [""])[0]).fingerprint256;

function lesbarFuerProxy(pfad: string, modus: number) {
  chmodSync(pfad, modus);
  if (process.getuid?.() === 0) chownSync(pfad, PROXY_UID, PROXY_UID);
}

/** Zertifikatskette und Schluessel liegen als EIN Paar in paar.pem: ein Wechsel ist ein einziges atomares rename und
 *  kann nie ein gemischtes Paar hinterlassen (PP11a-5). Caddy liest Kette und Schluessel aus derselben Datei. */
export const PAAR = "paar.pem";
const paarInhalt = (cert: string, key: string) => [key.trim(), cert.trim(), ""].join("\n");
function schreibePaar(datei: string, inhalt: string) { schreibeAtomar(datei, inhalt, 0o600); lesbarFuerProxy(datei, 0o600); }

/** Legt das geprueft zusammengefuehrte Paar atomar im Instanzverzeichnis ab (tls/, 0700, Eigentuemer Proxy-UID). */
export function legeKundenzertifikatAb(verzeichnis: string, zertifikatDatei: string, schluesselDatei: string, domain: string, jetzt = new Date()) {
  const cert = readFileSync(zertifikatDatei, "utf8"), key = readFileSync(schluesselDatei, "utf8");
  const info = pruefeKundenzertifikat(cert, key, domain, jetzt);
  if (!existsSync(verzeichnis)) mkdirSync(verzeichnis, { recursive: true, mode: 0o700 });
  lesbarFuerProxy(verzeichnis, 0o700);
  schreibePaar(join(verzeichnis, PAAR), paarInhalt(cert, key));
  return info;
}

export type RotationsOptionen = {
  verzeichnis: string; domain: string; zertifikatDatei: string; schluesselDatei: string;
  /** Proxy neu starten (Caddy liest die Datei nur beim Start). */
  neustart: () => Promise<void>;
  /** Prueft nach dem Neustart, ob der Proxy gesund ist und das erwartete Zertifikat ausliefert. */
  pruefe: (fingerprint256: string) => Promise<boolean>;
  jetzt?: Date;
};

/**
 * Rotation: neues Paar pruefen, Wechsel per Dateisperre serialisieren, bisheriges Paar als paar.pem.vorher sichern,
 * atomar ersetzen, Proxy neu starten, Auslieferung pruefen. JEDER Fehler nach der Sicherung (Ersatz, Neustart,
 * Pruefung) legt das bisherige Paar atomar zurueck und startet den Proxy erneut (PP11a-5).
 */
export async function rotiereKundenzertifikat(o: RotationsOptionen) {
  const paar = join(o.verzeichnis, PAAR), vorher = `${paar}.vorher`;
  if (!existsSync(paar)) throw new Error("Kein Kunden-Zertifikat installiert (Instanz verwendet internal/ACME)");
  // Vor jeder Aenderung pruefen: ungueltige Eingaben lassen den laufenden Stand unberuehrt.
  const cert = readFileSync(o.zertifikatDatei, "utf8"), key = readFileSync(o.schluesselDatei, "utf8");
  const info = pruefeKundenzertifikat(cert, key, o.domain, o.jetzt);
  const frei = dateiSperre(join(o.verzeichnis, "wechsel.lock"), true, "Zertifikatswechsel");
  try {
    const bisher = readFileSync(paar, "utf8");
    schreibePaar(vorher, bisher);
    try {
      schreibePaar(paar, paarInhalt(cert, key));
      await o.neustart();
      if (!(await o.pruefe(info.fingerprint256).catch(() => false))) throw new Error("Proxy lieferte das neue Zertifikat nicht aus");
      return { ...info, zurueckgerollt: false };
    } catch (e) {
      schreibePaar(paar, bisher);
      try { await o.neustart(); } catch (x) { throw new Error(`${(e as Error).message}; bisheriges Zertifikat zurueckgelegt, Proxy-Neustart fehlgeschlagen: ${(x as Error).message}`); }
      throw new Error(`${(e as Error).message}; bisheriges Zertifikat wiederhergestellt`);
    }
  } finally { frei(true); }
}

/** Fingerprint des Zertifikats, das der Proxy fuer servername ausliefert (ohne Vertrauenspruefung, nur Vergleich). */
export async function ausgeliefertesZertifikat(port: number, servername: string, host = "127.0.0.1", versuche = 30): Promise<string> {
  const { connect } = await import("node:tls");
  for (let i = 1; ; i++) {
    try {
      return await new Promise<string>((ok, fehler) => {
        const s = connect({ host, port, servername, rejectUnauthorized: false, timeout: 5_000 }, () => { const fp = s.getPeerCertificate().fingerprint256; s.end(); ok(fp); });
        s.on("error", fehler); s.on("timeout", () => s.destroy(new Error("TLS-Zeitueberschreitung")));
      });
    } catch (e) {
      if (i >= versuche) throw e;
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
}
