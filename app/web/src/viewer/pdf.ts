import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Worker aus eigener Domain (gebuendeltes Asset), kein CDN; CSP default-src 'self' deckt ihn ab.
GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * PDF aus Bytes oeffnen: keine Skripte (ADR 0022: Skripting gibt es nur im Viewer-Paket, quickjs wird nicht ausgeliefert), kein XFA,
 * kein eval (pdfjs-dist 6 nutzt keins mehr; isEvalSupported entfiel), kein wasm (CSP ohne wasm-unsafe-eval; JS-Ersatzdecoder aus /pdfjs/wasm/),
 * Hilfsdaten aus /pdfjs/ (eigene Domain).
 */
export function oeffnePdf(daten: ArrayBuffer): Promise<PDFDocumentProxy> {
  return getDocument({
    data: new Uint8Array(daten), enableXfa: false, useWasm: false,
    cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/",
  }).promise;
}

/** Dokument freigeben (Worker-Speicher); PDFDocumentProxy hat in v6 kein eigenes destroy(). */
export function schliessePdf(doc: PDFDocumentProxy): void { void doc.loadingTask.destroy(); }

/** Zeichnet Seite nr in den Canvas (Geraetepixel scharf); abbrechen() beim Seitenwechsel. */
export function zeichneSeite(doc: PDFDocumentProxy, nr: number, canvas: HTMLCanvasElement, massstab: number): { fertig: Promise<void>; abbrechen(): void } {
  let aufgabe: { cancel(): void; promise: Promise<void> } | null = null;
  let abgebrochen = false;
  const fertig = (async () => {
    const seite = await doc.getPage(nr);
    if (abgebrochen) return;
    const dpr = window.devicePixelRatio || 1;
    const vp = seite.getViewport({ scale: massstab * dpr });
    // Erst in einen Puffer zeichnen, dann umkopieren: kein weisses Aufblitzen beim Zoomen und Blaettern.
    const puffer = document.createElement("canvas");
    puffer.width = Math.floor(vp.width); puffer.height = Math.floor(vp.height);
    aufgabe = seite.render({ canvas: puffer, viewport: vp });
    try { await aufgabe.promise; }
    catch (e) { if ((e as { name?: string })?.name === "RenderingCancelledException") return; throw e; }
    if (abgebrochen) return;
    canvas.width = puffer.width; canvas.height = puffer.height;
    canvas.style.width = `${Math.floor(vp.width / dpr)}px`; canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
    canvas.getContext("2d")?.drawImage(puffer, 0, 0);
  })();
  return { fertig, abbrechen: () => { abgebrochen = true; aufgabe?.cancel(); } };
}

/** Breite der ersten Seite bei Massstab 1 (CSS-Pixel), fuer "an Breite anpassen". */
export async function seitenBreite(doc: PDFDocumentProxy, nr = 1): Promise<number> {
  return (await doc.getPage(nr)).getViewport({ scale: 1 }).width;
}

/** Textstuecke je Seite in der Reihenfolge der Textebene (Grundlage fuer Suche und Markierung). */
export async function seitenTexte(doc: PDFDocumentProxy): Promise<string[][]> {
  const texte: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const t = await (await doc.getPage(i)).getTextContent();
    texte.push(t.items.flatMap((x) => ("str" in x ? [x.str] : [])));
  }
  return texte;
}

/** Seitengroesse bei Massstab 1 (CSS-Pixel), fuer "Einpassen". */
export async function seitenMass(doc: PDFDocumentProxy, nr: number): Promise<{ b: number; h: number }> {
  const vp = (await doc.getPage(nr)).getViewport({ scale: 1 });
  return { b: vp.width, h: vp.height };
}

/**
 * Textebene ueber dem Canvas (markier- und kopierbar, Grundlage der Treffer-Markierung). PDF.js setzt Groessen nur ueber
 * CSSOM (style.setProperty), keine style-Attribute oder <style>-Elemente: CSP style-src 'self' bleibt eingehalten.
 * `fertig` liefert die Textstuecke (Elemente und Texte, gleiche Indizes wie seitenTexte).
 */
export function zeichneText(doc: PDFDocumentProxy, nr: number, container: HTMLElement, massstab: number): { fertig: Promise<{ elemente: HTMLElement[]; texte: string[] } | null>; abbrechen(): void } {
  let ebene: TextLayer | null = null;
  let abgebrochen = false;
  const fertig = (async () => {
    const seite = await doc.getPage(nr);
    if (abgebrochen) return null;
    const inhalt = await seite.getTextContent();
    if (abgebrochen) return null;
    container.replaceChildren();
    container.style.setProperty("--total-scale-factor", String(massstab));
    ebene = new TextLayer({ textContentSource: inhalt, container, viewport: seite.getViewport({ scale: massstab }) });
    try { await ebene.render(); } catch { return null; }
    if (abgebrochen) return null;
    return { elemente: ebene.textDivs, texte: ebene.textContentItemsStr };
  })();
  return { fertig, abbrechen: () => { abgebrochen = true; ebene?.cancel(); } };
}
