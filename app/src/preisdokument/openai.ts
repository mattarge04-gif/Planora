import OpenAI from "openai";
import { LeseFehler, bereinigeFehler, type LeseAdapter, type LeseKontext } from "./adapter.js";
import { ANTWORT_SCHEMA } from "./schema.js";
import { baueAnweisung, baueKontextText } from "./prompt.js";
export function openaiAdapter(o: { apiKey: string; modell: string; basisUrl?: string }): LeseAdapter {
  const client = new OpenAI({ apiKey: o.apiKey, ...(o.basisUrl ? { baseURL: o.basisUrl } : {}), maxRetries: 2, timeout: 180_000 });
  return { async lies(pdf: Buffer, dateiname: string, k: LeseKontext) {
    let r;
    try {
      r = await client.responses.create({
        model: o.modell, store: false,
        instructions: baueAnweisung(),
        input: [{ role: "user", content: [
          { type: "input_file", filename: dateiname, file_data: `data:application/pdf;base64,${pdf.toString("base64")}` },
          { type: "input_text", text: baueKontextText(k) },
        ] }],
        text: { format: { type: "json_schema", name: "preis_vorschlaege", strict: true, schema: ANTWORT_SCHEMA as unknown as Record<string, unknown> } },
      });
    } catch (e) {
      // nur bereinigte Meldung (Schluessel entfernt), nie Header oder Konfiguration
      const status = (e as { status?: unknown })?.status;
      throw new LeseFehler("api", e instanceof Error ? bereinigeFehler(e.message, o.apiKey, typeof status === "number" ? status : undefined) : "API-Fehler");
    }
    if (r.status === "failed" || r.status === "cancelled") throw new LeseFehler("api", `API-Fehler (Antwortstatus ${r.status})`);
    if (r.status === "incomplete") throw new LeseFehler("abgeschnitten", "Antwort unvollstaendig");
    const ablehnung = r.output?.some((m) => m.type === "message" && m.content?.some((c) => c.type === "refusal"));
    if (ablehnung) throw new LeseFehler("ablehnung", "Modell hat abgelehnt");
    let roh: unknown;
    try { roh = JSON.parse(r.output_text); } catch { throw new LeseFehler("schema", "Antwort ist kein JSON"); }
    return { roh, modell: r.model ?? o.modell, tokensEin: r.usage?.input_tokens ?? 0, tokensAus: r.usage?.output_tokens ?? 0 };
  } };
}
