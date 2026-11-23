import { inflateSync } from "node:zlib";
/** Obergrenzen gegen Zip-Bomben beim Entpacken von FlateDecode-Streams. */
export const MAX_ENTPACKT_JE_STREAM = 8 * 1024 * 1024;
export const MAX_ENTPACKT_TOTAL = 64 * 1024 * 1024;

// /Count eines /Pages-Knotens, Reihenfolge der Schluessel im Dictionary beliebig.
const COUNT_NACH_TYPE = /\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g;
const COUNT_VOR_TYPE = /\/Count\s+(\d+)[^<>]*?\/Type\s*\/Pages\b/g;
function hoechsterCount(text: string): number {
  let max = 0;
  for (const re of [COUNT_NACH_TYPE, COUNT_VOR_TYPE]) for (const m of text.matchAll(re)) max = Math.max(max, Number(m[1]));
  return max;
}

/**
 * Entpackt FlateDecode-Streams (u. a. Objekt-Streams /ObjStm ab PDF 1.5) mit Obergrenzen je Stream
 * und gesamt; defekte oder zu grosse Streams werden uebersprungen. Liefert die entpackten Texte.
 */
function* entpackteStreams(daten: Buffer, text: string): Generator<string> {
  let total = 0;
  const re = /\/FlateDecode\b[^]*?>>\s*stream\r?\n/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const start = m.index + m[0].length;
    const ende = text.indexOf("endstream", start);
    if (ende < 0) return;
    re.lastIndex = ende;
    // Dictionary vor "stream" darf kein weiteres "stream" enthalten (sonst falscher Treffer ueber Objektgrenzen).
    const dict = m[0];
    if (dict.indexOf("endobj") >= 0) continue;
    const rest = MAX_ENTPACKT_TOTAL - total;
    if (rest <= 0) return;
    try {
      const roh = inflateSync(daten.subarray(start, ende), { maxOutputLength: Math.min(MAX_ENTPACKT_JE_STREAM, rest), finishFlush: 2 /* Z_SYNC_FLUSH: toleriert fehlendes Ende */ });
      total += roh.length;
      yield roh.toString("latin1");
    } catch { /* defekt oder ueber der Grenze: ueberspringen */ }
  }
}

/**
 * Seitenzahl [A]: hoechster /Count eines /Pages-Knotens im Klartext und in entpackten Streams,
 * sonst Anzahl /Type /Page; mindestens 1. Erwartet ein PDF (Signatur vorher pruefen).
 */
export function zaehleSeiten(daten: Buffer): number {
  const text = daten.toString("latin1");
  let count = hoechsterCount(text);
  let einzelseiten = (text.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
  if (/\/ObjStm\b/.test(text) || count === 0) {
    for (const s of entpackteStreams(daten, text)) {
      count = Math.max(count, hoechsterCount(s));
      einzelseiten += (s.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
    }
  }
  return Math.max(1, count || einzelseiten);
}
