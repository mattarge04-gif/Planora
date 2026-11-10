import { createHash } from "node:crypto";
import { promises as fs, createReadStream } from "node:fs";
import { join } from "node:path";
export type Datei = { schluessel: string; sha256: string; groesse: number };
export type Manifest = {
  format: 1; backupId: string; instanzId: string; release: string; modulVersion: string;
  schema: { name: string; pruefsumme: string }[]; journalSeq: string; anlass: string;
  satzPfad: string; dateien: Datei[]; bestandteile: Datei[];
};
export const sha = (daten: Buffer | string) => createHash("sha256").update(daten).digest("hex");
export async function dateiHash(pfad: string) {
  const h = createHash("sha256"); let groesse = 0;
  for await (const d of createReadStream(pfad)) { h.update(d); groesse += d.length; }
  return { sha256: h.digest("hex"), groesse };
}
export function pruefeDateischluessel(d: Datei) {
  if (!/^[0-9a-f]{64}$/.test(d.sha256) || d.schluessel !== `sha256/${d.sha256.slice(0,2)}/${d.sha256.slice(2,4)}/${d.sha256}` || !Number.isSafeInteger(d.groesse) || d.groesse < 0) throw new Error("Ungueltiger Dateischluessel im Manifest");
}
export async function pruefeDatei(pfad: string, d: Pick<Datei,"sha256"|"groesse">) {
  const stat = await fs.lstat(pfad);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Keine regulaere Datei");
  const gelesen = await dateiHash(pfad);
  if (gelesen.sha256 !== d.sha256 || gelesen.groesse !== d.groesse) throw new Error("Hash-/Groessenabweichung");
}
export function snapshotAbgleichen(json: string, manifest: Manifest) {
  const erwartet = new Map([
    ...manifest.dateien.map((d) => [`${manifest.satzPfad}/dokumente/${d.schluessel}`, d.groesse] as const),
    ...manifest.bestandteile.map((d) => [`${manifest.satzPfad}/${d.schluessel}`, d.groesse] as const),
    [`${manifest.satzPfad}/manifest.json`, undefined] as const,
  ]);
  const gesehen = new Set<string>();
  for (const zeile of json.trim().split("\n")) {
    const n = JSON.parse(zeile);
    if(n.type && n.type!=="file" && n.type!=="dir")throw new Error("Unerlaubter Dateityp im Snapshot");
    if (n.type !== "file") continue;
    if (!erwartet.has(n.path) || gesehen.has(n.path) || (erwartet.get(n.path) !== undefined && n.size !== erwartet.get(n.path))) throw new Error("Snapshot passt nicht zum Manifest");
    gesehen.add(n.path);
  }
  if (gesehen.size !== erwartet.size) throw new Error("Snapshot unvollstaendig");
}
/** Verhindert auch Symlinks in Vorfahren der referenzierten Dateien. */
export async function quelldatei(wurzel: string, d: Datei) {
  pruefeDateischluessel(d);
  const echt = await fs.realpath(wurzel);
  let pfad = echt;
  for (const teil of d.schluessel.split("/")) {
    pfad = join(pfad, teil);
    if ((await fs.lstat(pfad)).isSymbolicLink()) throw new Error("Verlinkte Dokumentdatei");
  }
  return pfad;
}
