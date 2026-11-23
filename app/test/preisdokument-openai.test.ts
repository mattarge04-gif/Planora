import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { openaiAdapter } from "../src/preisdokument/openai.js";
import { LeseFehler } from "../src/preisdokument/adapter.js";

// Lokaler Stub statt echtem Dienst: liefert je Anfrage die naechste vorbereitete Antwort.
let server: Server; let basis = ""; const antworten: unknown[] = [];
beforeAll(async () => {
  server = createServer((req, res) => {
    req.resume();
    req.on("end", () => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(antworten.shift())); });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(async () => { await new Promise((r) => server.close(r)); });

const antwort = (x: Record<string, unknown>) => ({ id: "resp_1", object: "response", model: "stub-modell", output: [], usage: { input_tokens: 1000, output_tokens: 128000 }, ...x });
const lies = async () => {
  const a = openaiAdapter({ apiKey: "test-schluessel", modell: "konfig", basisUrl: basis });
  return a.lies(Buffer.from("%PDF-1.7"), "a.pdf", { bauteile: [], katalog: [] }).then(() => null, (e) => e as LeseFehler);
};

describe("openaiAdapter: Verbrauch auch bei gescheiterter Antwort", () => {
  for (const [name, x, grund] of [
    ["abgeschnitten", { status: "incomplete" }, "abgeschnitten"],
    ["fehlgeschlagen", { status: "failed" }, "api"],
    ["abgelehnt", { status: "completed", output: [{ type: "message", id: "m", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "nein" }] }] }, "ablehnung"],
    ["kein JSON", { status: "completed", output: [{ type: "message", id: "m", role: "assistant", status: "completed", content: [{ type: "output_text", text: "kein json", annotations: [] }] }] }, "schema"],
  ] as const) it(name, async () => {
    antworten.push(antwort(x));
    const e = await lies();
    expect(e).toBeInstanceOf(LeseFehler);
    expect(e!.grund).toBe(grund);
    expect(e!.verbrauch).toEqual({ modell: "stub-modell", tokensEin: 1000, tokensAus: 128000 });
  });
  it("ohne usage-Block kein Verbrauch", async () => {
    antworten.push({ ...antwort({ status: "incomplete" }), usage: null });
    const e = await lies();
    expect(e!.grund).toBe("abgeschnitten");
    expect(e!.verbrauch).toBeUndefined();
  });
});
