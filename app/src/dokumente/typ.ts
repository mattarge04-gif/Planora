/** Grenzen und Typen der Ablage (Spec Anlagenakte 2026-11-23 Abschnitt 3/4.2). Typ nur aus Magic Bytes, nie aus Endung. */
export const MAX_BYTES = 100 * 1024 * 1024; // [A]
export type Art = "pdf" | "bild" | "office";
export const KATEGORIEN = ["datenblatt", "plan", "offerte", "foto", "protokoll", "sonstiges"] as const;
export type Kategorie = (typeof KATEGORIEN)[number];
export type TypGrund = "leer" | "zu_gross" | "typ_unbekannt" | "makro";
export interface Typ { art: Art; mime: string }

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const HEIC_MARKEN = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]); // [A] ohne avif
const MAX_ZIP_EINTRAEGE = 20_000;
const MAX_ZIP_NAME = 1024;
const MAX_ZIP_NAMEN_BYTES = 4 * 1024 * 1024;
const MAX_OLE_SEKTOREN = 4096;
const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword", xls: "application/vnd.ms-excel", ppt: "application/vnd.ms-powerpoint",
} as const;
type Erkannt = { ok: true; typ: Typ } | { ok: false; grund: TypGrund };
const ja = (art: Art, mime: string): Erkannt => ({ ok: true, typ: { art, mime } });
const nein = (grund: TypGrund): Erkannt => ({ ok: false, grund });

/** Namen aus dem zentralen Verzeichnis einer ZIP-Datei (nur Kopfdaten, nichts wird entpackt); null, wenn kein gueltiges, vollstaendig lesbares ZIP (fail closed). */
export function zipNamen(d: Buffer): string[] | null {
  if (d.length < 22) return null;
  const min = Math.max(0, d.length - 22 - 0xffff);
  for (let i = d.length - 22; i >= min; i--) {
    if (d.readUInt32LE(i) !== 0x06054b50) continue;
    const anzahl = d.readUInt16LE(i + 10), groesse = d.readUInt32LE(i + 12), start = d.readUInt32LE(i + 16);
    if (anzahl > MAX_ZIP_EINTRAEGE || start + groesse > i) return null; // inkl. zip64-Marker (0xFFFF / 0xFFFFFFFF)
    const namen: string[] = [];
    let p = start, bytes = 0;
    for (let n = 0; n < anzahl; n++) {
      if (p + 46 > i || d.readUInt32LE(p) !== 0x02014b50) return null;
      const nl = d.readUInt16LE(p + 28), xl = d.readUInt16LE(p + 30), kl = d.readUInt16LE(p + 32);
      bytes += nl;
      if (nl > MAX_ZIP_NAME || bytes > MAX_ZIP_NAMEN_BYTES || p + 46 + nl > i) return null;
      namen.push(d.subarray(p + 46, p + 46 + nl).toString("utf8"));
      p += 46 + nl + xl + kl;
    }
    return p === start + groesse ? namen : null; // Verzeichnis muss genau die angegebene Laenge haben
  }
  return null;
}

function ooxml(d: Buffer): Erkannt {
  const roh = zipNamen(d);
  if (!roh || !roh.includes("[Content_Types].xml")) return nein("typ_unbekannt");
  const namen = roh.map((n) => n.replace(/\\/g, "/"));
  if (namen.some((n) => /(^|\/)vbaProject\.bin$/i.test(n) || /^xl\/macrosheets\//i.test(n))) return nein("makro");
  const hat = (p: string) => namen.some((n) => n.startsWith(p));
  if (hat("word/")) return ja("office", MIME.docx);
  if (hat("xl/")) return ja("office", MIME.xlsx);
  if (hat("ppt/")) return ja("office", MIME.pptx);
  return nein("typ_unbekannt");
}

const OLE_FREI = 0xfffffffc; // ab hier: Spezialwerte (DIFSECT, FATSECT, ENDOFCHAIN, FREESECT)
const ENDOFCHAIN = 0xfffffffe;
/** Eintragsnamen aus dem OLE2-Verzeichnis (Header, FAT-Kette, 128-Byte-Eintraege); null bei jedem Formfehler. Nur beschraenkte Schleifen. */
export function oleNamen(d: Buffer): string[] | null {
  if (d.length < 512) return null;
  const shift = d.readUInt16LE(0x1e);
  if (shift !== 9 && shift !== 12) return null;
  const ss = 1 << shift, proSektor = ss / 4;
  const nFat = d.readUInt32LE(0x2c), erster = d.readUInt32LE(0x30);
  if (nFat === 0 || nFat > 109) return null; // [A] nur Header-DIFAT; groessere Dateien (> 109 FAT-Sektoren) -> unbekannt
  const sektor = (sid: number) => ((sid + 1) * ss + ss <= d.length ? (sid + 1) * ss : -1);
  const naechster = (sid: number): number => {
    const fi = Math.floor(sid / proSektor);
    if (fi >= nFat) return -1;
    const fatSid = d.readUInt32LE(0x4c + fi * 4);
    if (fatSid >= OLE_FREI) return -1;
    const o = sektor(fatSid);
    return o < 0 ? -1 : d.readUInt32LE(o + (sid % proSektor) * 4);
  };
  const namen: string[] = [];
  let sid = erster;
  for (let n = 0; ; n++) {
    if (n >= MAX_OLE_SEKTOREN) return null; // Schleife oder absurd lange Kette
    if (sid >= OLE_FREI) return null;
    const o = sektor(sid);
    if (o < 0) return null;
    for (let e = o; e < o + ss; e += 128) {
      const typ = d[e + 66], len = d.readUInt16LE(e + 64);
      if (typ === 0) continue;
      if (typ > 5 || len < 2 || len > 64) return null;
      namen.push(d.toString("utf16le", e, e + len - 2));
    }
    const nx = naechster(sid);
    if (nx === ENDOFCHAIN) break;
    if (nx < 0) return null;
    sid = nx;
  }
  return namen.includes("Root Entry") ? namen : null;
}

function ole2(d: Buffer): Erkannt {
  const namen = oleNamen(d);
  if (!namen) return nein("typ_unbekannt");
  const hat = (...k: string[]) => namen.some((n) => k.includes(n));
  if (hat("_VBA_PROJECT_CUR", "VBA", "Macros")) return nein("makro");
  if (hat("WordDocument")) return ja("office", MIME.doc);
  if (hat("Workbook", "Book")) return ja("office", MIME.xls);
  if (hat("PowerPoint Document")) return ja("office", MIME.ppt);
  return nein("typ_unbekannt");
}

export function erkenneTyp(d: Buffer): Erkannt {
  if (!d.length) return nein("leer");
  if (d.length > MAX_BYTES) return nein("zu_gross");
  if (d.subarray(0, 5).toString("latin1") === "%PDF-") return ja("pdf", "application/pdf");
  if (d.length >= 3 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff) return ja("bild", "image/jpeg");
  if (d.subarray(0, 8).equals(PNG)) return ja("bild", "image/png");
  if (d.length >= 12 && d.toString("latin1", 4, 8) === "ftyp" && HEIC_MARKEN.has(d.toString("latin1", 8, 12))) return ja("bild", "image/heic");
  if (d.length >= 4 && d.readUInt32LE(0) === 0x04034b50) return ooxml(d);
  if (d.subarray(0, 8).equals(OLE2)) return ole2(d);
  return nein("typ_unbekannt");
}

/** Vorbelegung [A]: Bild -> foto, sonst sonstiges. */
export const startKategorie = (art: Art): Kategorie => (art === "bild" ? "foto" : "sonstiges");
