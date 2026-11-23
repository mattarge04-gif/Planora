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
const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword", xls: "application/vnd.ms-excel", ppt: "application/vnd.ms-powerpoint",
} as const;
const u16 = (s: string) => Buffer.from(s, "utf16le");
type Erkannt = { ok: true; typ: Typ } | { ok: false; grund: TypGrund };
const ja = (art: Art, mime: string): Erkannt => ({ ok: true, typ: { art, mime } });
const nein = (grund: TypGrund): Erkannt => ({ ok: false, grund });

/** Namen aus dem zentralen Verzeichnis einer ZIP-Datei (nur Kopfdaten, nichts wird entpackt); null, wenn kein gueltiges ZIP. */
export function zipNamen(d: Buffer): string[] | null {
  if (d.length < 22) return null;
  const min = Math.max(0, d.length - 22 - 0xffff);
  for (let i = d.length - 22; i >= min; i--) {
    if (d.readUInt32LE(i) !== 0x06054b50) continue;
    const anzahl = d.readUInt16LE(i + 10), groesse = d.readUInt32LE(i + 12), start = d.readUInt32LE(i + 16);
    if (start + groesse > i) return null;
    const namen: string[] = [];
    let p = start;
    for (let n = 0; n < anzahl && n < MAX_ZIP_EINTRAEGE; n++) {
      if (p + 46 > i || d.readUInt32LE(p) !== 0x02014b50) return null;
      const nl = d.readUInt16LE(p + 28), xl = d.readUInt16LE(p + 30), kl = d.readUInt16LE(p + 32);
      namen.push(d.subarray(p + 46, p + 46 + nl).toString("utf8"));
      p += 46 + nl + xl + kl;
    }
    return namen;
  }
  return null;
}

function ooxml(d: Buffer): Erkannt {
  const namen = zipNamen(d);
  if (!namen || !namen.includes("[Content_Types].xml")) return nein("typ_unbekannt");
  if (namen.some((n) => /(^|\/)vbaProject\.bin$/i.test(n))) return nein("makro");
  const hat = (p: string) => namen.some((n) => n.startsWith(p));
  if (hat("word/")) return ja("office", MIME.docx);
  if (hat("xl/")) return ja("office", MIME.xlsx);
  if (hat("ppt/")) return ja("office", MIME.pptx);
  return nein("typ_unbekannt");
}

function ole2(d: Buffer): Erkannt {
  if (d.includes(u16("_VBA_PROJECT"))) return nein("makro");
  if (d.includes(u16("WordDocument"))) return ja("office", MIME.doc);
  if (d.includes(u16("Workbook")) || d.includes(u16("Book"))) return ja("office", MIME.xls);
  if (d.includes(u16("PowerPoint Document"))) return ja("office", MIME.ppt);
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
