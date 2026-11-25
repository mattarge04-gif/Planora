import { ApiFehler, ersetzeJson, fehlerCode, fehlerCodes, fehlerMeldungen, holeJson, loescheJson, sendeJson } from "../api";
import type { AblageAntwort, AblageMeldung, AblageZeile, Kategorie } from "./typen";
import { ablageFehlerText, ablegenFehlerText, duplikatText, vorpruefen } from "./ansicht";
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
/** Legt Dateien nacheinander ab (Vorpruefung 100 MB, Duplikat- und Fehlertexte je Datei); bricht bei 401 ab. */
export async function legeAlleAb(gebaeudeId: string, dateien: File[], o: { kategorie?: Kategorie; bauteilIds?: string[] } = {}, nachDatei?: (name: string) => void) {
  const { ok, zuGross } = vorpruefen(dateien);
  const meldungen: AblageMeldung[] = zuGross.map((f) => ({ datei: f.name, text: ablageFehlerText("zu_gross"), art: "fehler" }));
  const zeilen: AblageZeile[] = [];
  for (const f of ok) {
    try {
      const r = await legeAb(gebaeudeId, f, o);
      if (!r.neu) meldungen.push({ datei: f.name, text: duplikatText(r.zeile, f.name), art: "hinweis" });
      zeilen.push(r.zeile);
    } catch (e) {
      if (e instanceof ApiFehler && e.status === 401) return { meldungen, zeilen, abgelaufen: true };
      meldungen.push({ datei: f.name, text: ablegenFehlerText(fehlerCode(e), e instanceof ApiFehler ? e.status : undefined, f.name), art: "fehler" });
    }
    nachDatei?.(f.name);
  }
  return { meldungen, zeilen, abgelaufen: false };
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
