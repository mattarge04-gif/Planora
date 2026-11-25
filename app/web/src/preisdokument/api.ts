import { ApiFehler, fehlerCodes, fehlerMeldungen, holeJson, loescheJson, sendeJson } from "../api";
import type { DokumentZeile, UebernehmenEingabe, Uebersicht } from "./typen";

const BASIS = "/api/preisdokument";

export const ladeUebersicht = (gebaeudeId: string) => holeJson<Uebersicht>(`${BASIS}/gebaeude/${gebaeudeId}`);

/** Datei roh ablegen (Modul dokumente, kein Multipart); gleiche Schutz-Header wie die uebrigen Schreibaufrufe. */
export async function ladeHoch(gebaeudeId: string, datei: File): Promise<{ id: string; dateiname: string }> {
  const r = await fetch(`/api/dokumente/gebaeude/${gebaeudeId}`, {
    method: "POST", credentials: "same-origin",
    headers: { "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(datei.name), "x-planora-request": "1" },
    body: datei,
  });
  if (!r.ok) {
    let j: unknown = null;
    try { j = await r.json(); } catch { /* kein JSON */ }
    throw new ApiFehler(r.status, fehlerMeldungen(j), fehlerCodes(j));
  }
  return (await r.json()) as { id: string; dateiname: string };
}

export const loescheDokument = (id: string) => loescheJson<void>(`/api/dokumente/${id}`);
export const liesNeu = (id: string) => sendeJson<DokumentZeile>(`${BASIS}/dokumente/${id}/neu-lesen`, {});
export const uebernimm = (id: string, b: UebernehmenEingabe) => sendeJson<Uebersicht>(`${BASIS}/vorschlaege/${id}/uebernehmen`, b);
export const verwirf = (id: string) => sendeJson<Uebersicht>(`${BASIS}/vorschlaege/${id}/verwerfen`, {});
export const alleSicheren = (gebaeudeId: string, stand: number) => sendeJson<Uebersicht>(`${BASIS}/gebaeude/${gebaeudeId}/alle-sicheren`, { stand });

export { fehlerCode } from "../api";
