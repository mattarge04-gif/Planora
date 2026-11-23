import { LeseFehler, type LeseKontext, type RohVorschlag } from "./adapter.js";
const SICHER = new Set(["hoch", "mittel", "tief"]);
const istText = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const istZahlOderNull = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));
export function pruefeVorschlaege(roh: unknown, k: LeseKontext, seiten: number): RohVorschlag[] {
  const liste = (roh as { vorschlaege?: unknown } | null)?.vorschlaege;
  if (!Array.isArray(liste)) throw new LeseFehler("schema", "Schema: vorschlaege fehlt");
  const katalog = new Set(k.katalog.map((e) => e.id));
  const bauteilKat = new Map(k.bauteile.map((b) => [b.id.toLowerCase(), b.katalogId]));
  // Eingabe stammt aus der KI-Antwort (unbekannte Form), daher feldweise geprueft
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return liste.map((x: any, i: number): RohVorschlag => {
    if (!istText(x?.position, 500) || !istText(x?.zitat, 1000) || !istText(x?.rechenweg, 300) || typeof x?.seite !== "number"
      || typeof x?.ersatzpreis !== "number" || !Number.isFinite(x.ersatzpreis) || x.ersatzpreis < 0 || !SICHER.has(x?.sicherheit)
      || !istZahlOderNull(x?.materialNetto) || !istZahlOderNull(x?.montageAnteil) || !(x?.rabattText === null || istText(x?.rabattText, 200))
      || !Array.isArray(x?.bauteilIds) || !(x?.katalogId === null || typeof x?.katalogId === "string"))
      throw new LeseFehler("schema", `Schema: Vorschlag ${i} ungueltig`);
    const katalogId: string | null = x.katalogId && katalog.has(x.katalogId) ? x.katalogId : null;
    const bauteilIds = katalogId ? [...new Set((x.bauteilIds as unknown[]).map((b) => String(b).toLowerCase()))].filter((b) => bauteilKat.get(b) === katalogId) : [];
    const seiteOk = Number.isInteger(x.seite) && x.seite >= 1 && x.seite <= seiten;
    return { position: x.position, seite: seiteOk ? x.seite : 1, zitat: x.zitat, materialNetto: x.materialNetto, rabattText: x.rabattText,
      montageAnteil: x.montageAnteil, ersatzpreis: Math.round(x.ersatzpreis * 100) / 100, rechenweg: x.rechenweg, katalogId, bauteilIds,
      sicherheit: seiteOk ? x.sicherheit : "tief" };
  });
}
