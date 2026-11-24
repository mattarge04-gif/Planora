import { ApiFehler, ersetzeJson, fehlerCodes, fehlerMeldungen, holeJson, loescheJson, sendeJson } from "../api";
import type { AblageAntwort, AblageZeile, Kategorie } from "./typen";
const BASIS = "/api/dokumente";
export const ladeAblage = (gebaeudeId: string) => holeJson<AblageAntwort>(`${BASIS}/gebaeude/${gebaeudeId}`);
/** Datei roh ablegen (ein Request, kein Multipart); 201 = neu, 200 = gleicher Inhalt schon abgelegt. */
export async function legeAb(gebaeudeId: string, datei: File, o: { kategorie?: Kategorie; bauteilIds?: string[] } = {}): Promise<{ zeile: AblageZeile; neu: boolean }> {
  const q = new URLSearchParams();
  if (o.kategorie) q.set("kategorie", o.kategorie);
  if (o.bauteilIds?.length) q.set("bauteile", o.bauteilIds.join(","));
  const qs = q.toString();
  const r = await fetch(`${BASIS}/gebaeude/${gebaeudeId}${qs ? `?${qs}` : ""}`, {
    method: "POST", credentials: "same-origin",
    headers: { "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(datei.name), "x-planora-request": "1" },
    body: datei,
  });
  if (!r.ok) {
    let j: unknown = null;
    try { j = await r.json(); } catch { /* kein JSON, z. B. 413 */ }
    throw new ApiFehler(r.status, fehlerMeldungen(j), fehlerCodes(j));
  }
  return { zeile: (await r.json()) as AblageZeile, neu: r.status === 201 };
}
export const loesche = (id: string) => loescheJson<void>(`${BASIS}/${id}`);
export const setzeKategorie = (id: string, kategorie: Kategorie) => ersetzeJson<AblageZeile>(`${BASIS}/${id}/kategorie`, { kategorie });
export const verknuepfe = (id: string, bauteilIds: string[]) => ersetzeJson<AblageZeile>(`${BASIS}/${id}/bauteile`, { bauteilIds });
export const pruefeErneut = (id: string) => sendeJson<AblageZeile>(`${BASIS}/${id}/erneut-pruefen`, {});
export const dateiUrl = (id: string, download = false) => `${BASIS}/${id}/datei${download ? "?download=1" : ""}`;
/** Bytes fuer den Viewer (PDF.js laedt aus dem Speicher, nicht ueber eine URL). */
export async function ladeBytes(id: string): Promise<ArrayBuffer> {
  const r = await fetch(dateiUrl(id), { credentials: "same-origin" });
  if (!r.ok) throw new ApiFehler(r.status, [], []);
  return r.arrayBuffer();
}
