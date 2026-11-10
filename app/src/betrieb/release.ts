// Versionsmanifest release.json (Spec §3) mit Kompatibilitaetsmatrix (§8.1), signiert mit Ed25519.
// Bewusst nur node:-Module: die Datei laeuft auch im Betriebswerkzeug auf dem Host (ohne node_modules).
import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ImageEintrag = {
  dienst: "app" | "db" | "proxy" | "clamav" | "backup";
  /** Unveraenderliche Referenz, die compose.yaml startet (name:tag@sha256:...); nie latest */
  referenz: string;
  /** Registry-Digest, falls das Image aus einer Registry stammt; lokal gebaute Images haben keinen */
  digest: string | null;
  /** Image-ID (sha256:...) wie `docker image inspect --format {{.Id}}`; wird nach `docker load` geprueft (§8 Schritt 4) */
  imageId: string;
  architektur: string;
  /** Datei im Bundle (relativ, z.B. images/app.tar) fuer die Offline-Installation; fehlt = Image muss vorhanden sein */
  archiv?: string;
};

export type Matrix = {
  /** unterstuetzte Ausgangs-Releases (N-1 → N) */
  vonVersionen: string[];
  /** Schema-Version vorher (je Ausgangs-Release) und nachher */
  schemaVorher: string[];
  schemaNachher: string;
  pgBossSchema: string | null;
  /** Job-Typ → verarbeitete payloadVersion(en); Worker verarbeiten N und N-1 */
  jobPayloadVersionen: Record<string, number[]>;
  /** Migrationen, die nicht in einer Transaktion laufen (einzeln protokolliert, wiederaufnehmbar) */
  nichttransaktionaleSchritte: string[];
  /** Ausgangs-Releases, deren altes Image mit dem neuen Schema lauffaehig ist (§8.2 Rueckweg ohne Restore) */
  rueckwegAltesImage: string[];
};

export type Release = {
  format: 1;
  version: string;
  erzeugt: string;
  architektur: string;
  images: ImageEintrag[];
  schemaVersion: string;
  migrationen: { name: string; sha256: string }[];
  pgBossSchema: string | null;
  jobPayloadVersionen: Record<string, number>;
  modulmanifestVersion: string;
  katalogVersion: string | null;
  mindestvorgaenger: string | null;
  matrix: Matrix;
};

export type SignierterRelease = { release: Release; schluesselId: string; signatur: string };

export class ReleaseFehler extends Error {}

/** Stabile Serialisierung (Schluessel sortiert, keine Leerzeichen): Grundlage der Signatur. */
export function kanonisch(wert: unknown): string {
  if (wert === null || typeof wert !== "object") {
    if (wert === undefined || (typeof wert === "number" && !Number.isFinite(wert))) throw new ReleaseFehler("nicht serialisierbarer Wert im Manifest");
    return JSON.stringify(wert);
  }
  if (Array.isArray(wert)) return `[${wert.map(kanonisch).join(",")}]`;
  const o = wert as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${kanonisch(o[k])}`).join(",")}}`;
}

/** Pruefsummen wie der Migrator (sha256 ueber den Dateiinhalt als UTF-8), sortiert nach Name. */
export function migrationsPruefsummen(verzeichnis: string): { name: string; sha256: string }[] {
  return readdirSync(verzeichnis).filter((f) => f.endsWith(".sql")).sort()
    .map((name) => ({ name, sha256: createHash("sha256").update(readFileSync(join(verzeichnis, name), "utf8")).digest("hex") }));
}

export type ReleaseEingabe = {
  version: string; architektur: string; images: ImageEintrag[]; migrationsVerzeichnis: string; modulmanifestVersion: string;
  jobTypen?: string[]; vonVersionen: string[]; schemaVorher: string[]; rueckwegAltesImage?: string[];
  nichttransaktionaleSchritte?: string[]; mindestvorgaenger?: string | null; katalogVersion?: string | null; erzeugt?: Date;
};

export function erzeugeRelease(e: ReleaseEingabe): Release {
  const migrationen = migrationsPruefsummen(e.migrationsVerzeichnis);
  if (!migrationen.length) throw new ReleaseFehler("keine Migrationen gefunden");
  const jobs = Object.fromEntries((e.jobTypen ?? []).sort().map((j) => [j, 1]));
  const schemaVersion = migrationen[migrationen.length - 1].name;
  const release: Release = {
    format: 1, version: e.version, erzeugt: (e.erzeugt ?? new Date()).toISOString(), architektur: e.architektur, images: e.images,
    schemaVersion, migrationen,
    pgBossSchema: null, // [A] pg-boss ist in M1 nicht eingebaut (Worker-Platzhalter)
    jobPayloadVersionen: jobs, modulmanifestVersion: e.modulmanifestVersion, katalogVersion: e.katalogVersion ?? null,
    mindestvorgaenger: e.mindestvorgaenger ?? e.vonVersionen[0] ?? null,
    matrix: {
      vonVersionen: e.vonVersionen, schemaVorher: e.schemaVorher, schemaNachher: schemaVersion, pgBossSchema: null,
      jobPayloadVersionen: Object.fromEntries(Object.keys(jobs).map((j) => [j, [1]])),
      nichttransaktionaleSchritte: e.nichttransaktionaleSchritte ?? [], rueckwegAltesImage: e.rueckwegAltesImage ?? [],
    },
  };
  pruefeForm(release);
  return release;
}

const istText = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const istTextListe = (x: unknown): x is string[] => Array.isArray(x) && x.every(istText);
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SHA = /^sha256:[0-9a-f]{64}$/;

/** Formpruefung des Manifests; wirft ReleaseFehler mit der ersten Abweichung. */
export function pruefeForm(r: unknown): asserts r is Release {
  const f = (m: string): never => { throw new ReleaseFehler(`release.json ungueltig: ${m}`); };
  if (!r || typeof r !== "object") f("kein Objekt");
  const x = r as Record<string, any>;
  if (x.format !== 1) f("unbekanntes Format");
  if (!istText(x.version) || !VERSION.test(x.version)) f("version");
  if (!istText(x.erzeugt) || Number.isNaN(Date.parse(x.erzeugt))) f("erzeugt");
  if (!istText(x.architektur)) f("architektur");
  if (!Array.isArray(x.images) || !x.images.length) f("images fehlen");
  const dienste = new Set<string>();
  for (const i of x.images) {
    if (!i || !istText(i.dienst) || !istText(i.referenz) || !istText(i.architektur)) f("image unvollstaendig");
    if (!["app", "db", "proxy", "backup", "clamav"].includes(i.dienst) || dienste.has(i.dienst)) f("image-Dienst unbekannt oder doppelt");
    dienste.add(i.dienst);
    if (/:latest(@|$)/.test(i.referenz) || !/^[^\s@]+:[^\s/:@]+@sha256:[0-9a-f]{64}$/.test(i.referenz)) f(`image ${i.dienst}: Referenz braucht festen Tag und Digest (latest verboten)`);
    if (!SHA.test(i.imageId)) f(`image ${i.dienst}: imageId`);
    if (i.digest !== null && !SHA.test(i.digest)) f(`image ${i.dienst}: digest`);
    if (i.digest !== null && !i.referenz.endsWith(`@${i.digest}`)) f(`image ${i.dienst}: digest passt nicht zur Referenz`);
    if (i.archiv !== undefined && (!istText(i.archiv) || i.archiv.includes("..") || /^([/\\]|[A-Za-z]:)/.test(i.archiv))) f(`image ${i.dienst}: archiv muss relativ im Bundle liegen`);
    if (i.architektur !== x.architektur) f(`image ${i.dienst}: Architektur weicht ab`);
  }
  for (const dienst of ["app", "db", "proxy", "backup"]) if (!dienste.has(dienst)) f(`${dienst}-Image fehlt`);
  if (!Array.isArray(x.migrationen) || !x.migrationen.length || !x.migrationen.every((m: any) => m && istText(m.name) && /^[0-9a-f]{64}$/.test(m.sha256))) f("migrationen");
  if (x.schemaVersion !== x.migrationen[x.migrationen.length - 1].name) f("schemaVersion passt nicht zur letzten Migration");
  if (!istText(x.modulmanifestVersion)) f("modulmanifestVersion");
  if (!x.jobPayloadVersionen || typeof x.jobPayloadVersionen !== "object") f("jobPayloadVersionen");
  const m = x.matrix;
  if (!m || !istTextListe(m.vonVersionen) || !Array.isArray(m.schemaVorher) || !istTextListe(m.schemaVorher) || !istText(m.schemaNachher)
    || !Array.isArray(m.nichttransaktionaleSchritte) || !Array.isArray(m.rueckwegAltesImage)) f("matrix");
  if (m.schemaNachher !== x.schemaVersion) f("matrix.schemaNachher");
  if (m.rueckwegAltesImage.some((v: string) => !m.vonVersionen.includes(v))) f("matrix.rueckwegAltesImage enthaelt Release ausserhalb von vonVersionen");
}

const schluesselId = (oeffentlich: KeyObject) =>
  createHash("sha256").update(oeffentlich.export({ type: "spki", format: "der" })).digest("hex").slice(0, 16);

function alsEd25519(k: KeyObject) { if (k.asymmetricKeyType !== "ed25519") throw new ReleaseFehler("Schluessel ist kein Ed25519-Schluessel"); return k; }

/** Signiert das Manifest. Der private Schluessel liegt ausserhalb des Repos (Release-Bau), nie im Bundle. */
export function signiereRelease(release: Release, privaterSchluesselPem: string): SignierterRelease {
  pruefeForm(release);
  const privat = alsEd25519(createPrivateKey(privaterSchluesselPem));
  return { release, schluesselId: schluesselId(createPublicKey(privat)), signatur: sign(null, Buffer.from(kanonisch(release)), privat).toString("base64") };
}

/**
 * Prueft Signatur und Form. `inhalt` ist der Text von release.json. Der oeffentliche Schluessel ist der Vertrauensanker
 * auf dem Host (/etc/planora/<instanz>/release.pub), nie eine Datei aus dem Bundle selbst.
 */
export function pruefeRelease(inhalt: string, oeffentlicherSchluesselPem: string): Release {
  let s: SignierterRelease;
  try { s = JSON.parse(inhalt); } catch { throw new ReleaseFehler("release.json ist kein JSON"); }
  if (!s || typeof s !== "object" || !istText(s.signatur) || !s.release) throw new ReleaseFehler("release.json ohne Signatur");
  let oeffentlich: KeyObject;
  try { oeffentlich = alsEd25519(createPublicKey(oeffentlicherSchluesselPem)); } catch (e) { throw new ReleaseFehler(`oeffentlicher Schluessel unbrauchbar: ${(e as Error).message}`); }
  let gueltig = false;
  try { gueltig = verify(null, Buffer.from(kanonisch(s.release)), oeffentlich, Buffer.from(s.signatur, "base64")); } catch { gueltig = false; }
  if (!gueltig) throw new ReleaseFehler("Signatur von release.json ungueltig");
  pruefeForm(s.release);
  return s.release;
}

export type IstStand = { version: string; schemaVersion: string; architektur: string; migrationen: { name: string; sha256: string }[] };

/** §8 Schritt 0 / §8.1: darf dieses Release auf den vorgefundenen Stand angewendet werden? Leere Liste = ja. */
export function pruefeKompatibilitaet(r: Release, ist: IstStand): string[] {
  const fehler: string[] = [];
  if (r.architektur !== ist.architektur) fehler.push(`Architektur ${r.architektur} passt nicht zum Host (${ist.architektur})`);
  if (ist.version === r.version) fehler.push(`Release ${r.version} ist bereits installiert`);
  else if (!r.matrix.vonVersionen.includes(ist.version)) fehler.push(`Ausgangs-Release ${ist.version} wird nicht unterstuetzt (erlaubt: ${r.matrix.vonVersionen.join(", ") || "keines"})`);
  if (!r.matrix.schemaVorher.includes(ist.schemaVersion)) fehler.push(`Schema-Version ${ist.schemaVersion} wird nicht unterstuetzt (erlaubt: ${r.matrix.schemaVorher.join(", ") || "keine"})`);
  // Jede bereits angewendete Migration muss unveraendert im neuen Release enthalten sein (sonst bricht der Migrator ab).
  const neu = new Map(r.migrationen.map((m) => [m.name, m.sha256]));
  for (const m of ist.migrationen) {
    if (!neu.has(m.name)) fehler.push(`angewendete Migration ${m.name} fehlt im neuen Release`);
    else if (neu.get(m.name) !== m.sha256) fehler.push(`Pruefsumme der Migration ${m.name} weicht ab`);
  }
  return fehler;
}

/** Rueckweg §8.2: altes Image nur, wenn die Matrix das neue Schema als kompatibel fuer das alte Release ausweist. */
export const rueckwegMitAltemImage = (r: Release, von: string) => r.matrix.rueckwegAltesImage.includes(von);
