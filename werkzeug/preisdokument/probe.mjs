// Einmaliger Probeaufruf: o1-pumpen.pdf an gpt-6.2-sol (Responses API). Kosten < $0.05.
// Aufruf (nur mit PO-OK): OPENAI_API_KEY=... node werkzeug/preisdokument/probe.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY fehlt – PO legt ihn lokal an");
  process.exit(1);
}
const require = createRequire(join(hier, "..", "..", "app", "package.json"));
const { default: OpenAI } = await import(pathToFileURL(require.resolve("openai")).href);
const client = new OpenAI();

const pdf = readFileSync(join(hier, "pdf", "o1-pumpen.pdf")).toString("base64");
const schema = {
  type: "object",
  properties: {
    positionen: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, seite: { type: "integer" }, preis: { type: ["number", "null"] } },
        required: ["text", "seite", "preis"],
        additionalProperties: false,
      },
    },
  },
  required: ["positionen"],
  additionalProperties: false,
};

const response = await client.responses.create({
  model: "gpt-6.2-sol",
  store: false,
  input: [{
    role: "user",
    content: [
      { type: "input_file", filename: "o1-pumpen.pdf", file_data: `data:application/pdf;base64,${pdf}` },
      { type: "input_text", text: "Lies alle Positionen dieser Offerte. Gib je Position Text, Seite und Einzelpreis (Zahl, null wenn unklar) zurück." },
    ],
  }],
  text: { format: { type: "json_schema", name: "positionen", schema, strict: true } },
});
console.log(response.output_text);
console.log("usage:", JSON.stringify({ input_tokens: response.usage?.input_tokens, output_tokens: response.usage?.output_tokens }));
