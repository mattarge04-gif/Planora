import { Worker } from "node:worker_threads";
import { MIME, zipLies, zipVerzeichnis, type ZipEintrag } from "../dokumente/typ.js";

/** Text auslesen fuer die Suche (Spec 3 "Auslesen"). Fehler werfen AuslesenFehler; in die DB kommt nur ein fester Text (indexierer.ts). */
export type OrtArt = "name" | "seite" | "blatt" | "absatz";
export interface Teil { ortArt: OrtArt; ort: number; text: string }
export interface Gelesen { status: "fertig" | "ohne_text"; teile: Teil[]; /** true: nur die ersten MAX_PDF_SEITEN gelesen */ gekuerzt?: true }
export const ABSCHNITT_ZEICHEN = 1500; // [A] Spec 3, nach Messung anpassen
const UEBERLAPPUNG = 150;              // [A]
export const MAX_ABSCHNITTE = 2000;    // [A] je Dokument, darueber fail closed
export const MAX_PDF_SEITEN = 500;     // [A] bewusst hoeher als Preis aus Dokument (100): Auslesen kostet nichts
const MAX_TEIL = 16 * 1024 * 1024, MAX_GESAMT = 64 * 1024 * 1024, MAX_BLAETTER = 100;
export class AuslesenFehler extends Error {}

/** Steuerzeichen weg (ausser Zeilenumbruch; \u0002/\u0003 sind die Markierung der Suche), Leerraum zusammenfassen. */
export const bereinigeText = (s: string) => s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ").replace(/[  ]+/g, " ")
  .replace(/ ?\n\s*/g, "\n").trim();

/** Dateiname ohne Endung, Trennzeichen als Leerzeichen (Abschnitt nr 0). */
export const nameText = (dateiname: string) => bereinigeText(dateiname.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_\-.]+/g, " ")).slice(0, 255) || dateiname.slice(0, 255) || "Dokument";

/** Lange Texte in Stuecke zu hoechstens ABSCHNITT_ZEICHEN mit Ueberlappung, Schnitt am letzten Leerzeichen; leere Teile entfallen. */
export function teileAbschnitte(teile: Teil[]): Teil[] {
  const aus: Teil[] = [];
  for (const t of teile) {
    const text = bereinigeText(t.text);
    for (let p = 0; p < text.length;) {
      let ende = Math.min(text.length, p + ABSCHNITT_ZEICHEN);
      if (ende < text.length) { const l = text.lastIndexOf(" ", ende); if (l > p + ABSCHNITT_ZEICHEN / 2) ende = l; }
      const stueck = text.slice(p, ende).trim();
      if (stueck) aus.push({ ortArt: t.ortArt, ort: t.ort, text: stueck });
      if (ende >= text.length) break;
      const weiter = text.indexOf(" ", Math.max(p + 1, ende - UEBERLAPPUNG));
      p = weiter < 0 || weiter >= ende ? ende : weiter + 1;
    }
  }
  return aus;
}

// Alle Muster ohne Rueckgriff ueber Elementgrenzen ([^<>] / [^<]): jede Suche endet am naechsten Tag, Laufzeit linear.
const ENT: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const xmlText = (s: string) => s.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|(lt|gt|amp|quot|apos));/gi, (_m, d: string, h: string, n: string) => {
  if (n) return ENT[n.toLowerCase()];
  const cp = d ? Number(d) : parseInt(h, 16);
  return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
});
const tTexte = (s: string) => [...s.matchAll(/<t\b[^<>]*?(?:\/>|>([^<]*)<\/t>)/g)].map((m) => m[1] ?? "").join("");
const attribut = (tag: string, name: string) => xmlText(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? "");

/** Eintraege einer Office-Datei lesen, mit Grenzen je Teil und gesamt. */
function office(d: Buffer) {
  const v = zipVerzeichnis(d);
  if (!v) throw new AuslesenFehler("zip");
  let gesamt = 0;
  const lies = (e: ZipEintrag) => {
    const x = zipLies(d, e, MAX_TEIL);
    if (!x || (gesamt += x.length) > MAX_GESAMT) throw new AuslesenFehler("zip_grenze");
    return x.toString("utf8");
  };
  return { v, lies };
}

/** docx: Absaetze aus word/document.xml (Text, Tabulator, Umbruch), zu Gruppen bis ABSCHNITT_ZEICHEN zusammengefasst. */
export function docxTeile(d: Buffer): Teil[] {
  const { v, lies } = office(d);
  const e = v.find((x) => x.name === "word/document.xml");
  if (!e) throw new AuslesenFehler("docx");
  const absaetze = lies(e).split("</w:p>").map((p) => bereinigeText(xmlText([...p.matchAll(/<w:(t|tab|br)\b[^<>]*?(?:\/>|>([^<]*)<\/w:t>)/g)]
    .map((m) => (m[1] === "t" ? m[2] ?? "" : " ")).join("")))).filter(Boolean);
  const gruppen: string[] = [];
  for (const a of absaetze) {
    const letzte = gruppen.length - 1;
    if (letzte >= 0 && gruppen[letzte].length + a.length + 1 <= ABSCHNITT_ZEICHEN) gruppen[letzte] += "\n" + a; else gruppen.push(a);
  }
  return gruppen.map((text, i) => ({ ortArt: "absatz", ort: i + 1, text }));
}

/** Zellen einer Zeile; Schnitt an "<c", damit keine Suche ueber fehlende "</c>" hinweg laeuft. */
const zellen = (zeile: string, geteilt: string[]) => zeile.split(/<c(?=[\s>/])/).slice(1).map((stueck) => {
  const gt = stueck.indexOf(">");
  if (gt < 0 || stueck[gt - 1] === "/") return "";
  const kopf = stueck.slice(0, gt), ende = stueck.indexOf("</c>"), inhalt = stueck.slice(gt + 1, ende < 0 ? undefined : ende);
  const typ = /\st="(\w+)"/.exec(kopf)?.[1];
  if (typ === "s") return geteilt[Number(/<v>(\d{1,9})<\/v>/.exec(inhalt)?.[1])] ?? "";
  if (typ === "inlineStr") return xmlText(tTexte(inhalt));
  return xmlText(/<v>([^<]*)<\/v>/.exec(inhalt)?.[1] ?? "");
}).map((x) => x.trim()).filter(Boolean).join(" | ");

/** xlsx: je Blatt in der Reihenfolge von xl/workbook.xml, erste Zeile = Blattname, dann Zeilen mit " | " zwischen Zellen.
 *  Ohne lesbares Workbook: sheetN.xml in Nummernfolge ohne Namen. */
export function xlsxTeile(d: Buffer): Teil[] {
  const { v, lies } = office(d);
  const eintrag = (name: string) => v.find((x) => x.name === name);
  const ss = eintrag("xl/sharedStrings.xml");
  const geteilt = ss ? lies(ss).split("</si>").slice(0, -1).map((si) => xmlText(tTexte(si))) : [];
  const wb = eintrag("xl/workbook.xml"), rels = eintrag("xl/_rels/workbook.xml.rels");
  const ziel = new Map<string, string>();
  if (rels) for (const [tag] of lies(rels).matchAll(/<Relationship\b[^<>]*>/g)) {
    const t = attribut(tag, "Target");
    ziel.set(attribut(tag, "Id"), t.startsWith("/") ? t.slice(1) : "xl/" + t);
  }
  let blaetter: { name: string; e: ZipEintrag | undefined }[] = wb && rels
    ? [...lies(wb).matchAll(/<sheet\b[^<>]*>/g)].map(([tag]) => ({ name: attribut(tag, "name"), e: eintrag(ziel.get(attribut(tag, "(?:\\w+:)?id")) ?? "") }))
    : [];
  if (!blaetter.length) {
    const nr = (e: ZipEintrag) => Number(/^xl\/worksheets\/sheet(\d{1,4})\.xml$/.exec(e.name)?.[1] ?? NaN);
    blaetter = v.filter((e) => Number.isFinite(nr(e))).sort((a, b) => nr(a) - nr(b)).map((e) => ({ name: "", e }));
  }
  if (blaetter.length > MAX_BLAETTER) throw new AuslesenFehler("blaetter");
  return blaetter.map(({ name, e }, i) => {
    const zeilen = e ? lies(e).split("</row>").map((z) => zellen(z, geteilt)).filter(Boolean).join("\n") : "";
    return { ortArt: "blatt" as const, ort: i + 1, text: zeilen && (name ? `${name}\n${zeilen}` : zeilen) };
  }).filter((t) => t.text);
}

// pdf.js einmal je Thread laden: Worker im selben Thread (setzt globalThis.pdfjsWorker), kein Netz.
const WORKER = "pdfjs-dist/legacy/build/pdf.worker.mjs";
let pdfjs: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;
const ladePdfjs = () => (pdfjs ??= (async () => { await import(WORKER); return import("pdfjs-dist/legacy/build/pdf.mjs"); })());

/** PDF Seite fuer Seite, hoechstens MAX_PDF_SEITEN: ohne XFA, ohne wasm, ohne Schriften laden (ADR 0022: pdf.js fuehrt im Kernpaket keine PDF-Skripte aus). */
async function pdfLesen(d: Buffer): Promise<{ teile: Teil[]; gekuerzt: boolean }> {
  const { getDocument } = await ladePdfjs();
  let doc: Awaited<ReturnType<typeof getDocument>["promise"]>;
  try {
    doc = await getDocument({ data: new Uint8Array(d), enableXfa: false, useWasm: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  } catch { throw new AuslesenFehler("pdf"); }
  try {
    const teile: Teil[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PDF_SEITEN); i++) {
      const t = await (await doc.getPage(i)).getTextContent();
      teile.push({ ortArt: "seite", ort: i, text: t.items.map((x) => ("str" in x ? x.str + (x.hasEOL ? "\n" : " ") : "")).join("") });
    }
    return { teile, gekuerzt: doc.numPages > MAX_PDF_SEITEN };
  } catch { throw new AuslesenFehler("pdf_seite"); }
  finally { await doc.loadingTask.destroy(); }
}
export const pdfTeile = async (d: Buffer) => (await pdfLesen(d)).teile;

/** Text je Teil im aktuellen Thread; nur PDF, docx, xlsx werden gelesen, alles andere ist "ohne_text" (nur Dateiname). */
export async function liesText(d: Buffer, mime: string): Promise<Gelesen> {
  const roh = mime === "application/pdf" ? await pdfLesen(d) : { teile: mime === MIME.docx ? docxTeile(d) : mime === MIME.xlsx ? xlsxTeile(d) : [], gekuerzt: false };
  const teile = roh.teile.filter((t) => bereinigeText(t.text));
  return { status: teile.length ? "fertig" : "ohne_text", teile, ...(roh.gekuerzt && teile.length ? { gekuerzt: true as const } : {}) };
}

/** liesText in einem eigenen Worker-Thread mit Zeit- und Speichergrenze: eine boesartige Datei haelt den API-Prozess nicht an.
 *  Ueberschreitung -> terminate() und AuslesenFehler("zeit" | "speicher"). Unter tsx (Entwicklung, Tests) laedt der Worker die .ts-Datei. */
export function liesTextBegrenzt(d: Buffer, mime: string, o: { zeitMs?: number; speicherMb?: number } = {}): Promise<Gelesen> {
  if (mime !== "application/pdf" && mime !== MIME.docx && mime !== MIME.xlsx) return Promise.resolve({ status: "ohne_text", teile: [] }); // kein Thread fuer Bilder & Co.
  const ts = import.meta.url.endsWith(".ts");
  const w = new Worker(new URL(`./auslesen-worker.${ts ? "ts" : "js"}`, import.meta.url), {
    workerData: { d, mime }, execArgv: ts ? ["--import", "tsx"] : [],
    resourceLimits: { maxOldGenerationSizeMb: o.speicherMb ?? 512, maxYoungGenerationSizeMb: 64 },
  });
  let zeit: NodeJS.Timeout | undefined;
  return new Promise<Gelesen>((ok, nein) => {
    zeit = setTimeout(() => nein(new AuslesenFehler("zeit")), o.zeitMs ?? 60_000);
    w.once("message", (m: { ergebnis?: Gelesen; fehler?: string; eigen?: boolean }) =>
      m.ergebnis ? ok(m.ergebnis) : nein(m.eigen ? new AuslesenFehler(m.fehler) : new Error(m.fehler)));
    w.once("error", (e: Error & { code?: string }) => nein(e.code === "ERR_WORKER_OUT_OF_MEMORY" ? new AuslesenFehler("speicher") : e));
    w.once("exit", () => nein(new Error("Auslese-Worker ohne Ergebnis beendet")));
  }).finally(() => { clearTimeout(zeit); void w.terminate(); }); // erste Meldung entscheidet; Worker in jedem Fall beenden
}
