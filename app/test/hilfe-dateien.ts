// Testdateien als Buffer (nie auf Platte). Inhalt per `zusatz` eindeutig machen: gleicher sha256 im Gebaeude = Duplikat.
const NL = String.fromCharCode(10);
export const pdf = (seiten = 1, zusatz = "") => Buffer.from(["%PDF-1.7",
  ...Array.from({ length: seiten }, (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R >> endobj`),
  `2 0 obj << /Type /Pages /Count ${seiten} >> endobj`, zusatz + "%%EOF"].join(NL));
/** Minimales ZIP (nur gespeicherte Eintraege, CRC 0) mit den angegebenen Namen; reicht fuer die Typerkennung. */
export function zip(namen: string[]): Buffer {
  const lokal: Buffer[] = [], zentral: Buffer[] = [];
  let offset = 0;
  for (const n of namen) {
    const name = Buffer.from(n, "utf8"), inhalt = Buffer.from("x");
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(inhalt.length, 18); h.writeUInt32LE(inhalt.length, 22); h.writeUInt16LE(name.length, 26);
    const z = Buffer.alloc(46); z.writeUInt32LE(0x02014b50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt32LE(inhalt.length, 20); z.writeUInt32LE(inhalt.length, 24); z.writeUInt16LE(name.length, 28); z.writeUInt32LE(offset, 42);
    lokal.push(h, name, inhalt); zentral.push(z, name);
    offset += 30 + name.length + inhalt.length;
  }
  const cd = Buffer.concat(zentral);
  const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(namen.length, 8); e.writeUInt16LE(namen.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, cd, e]);
}
export const docx = (zusatz = "") => zip(["[Content_Types].xml", "_rels/.rels", "word/document.xml", ...(zusatz ? [zusatz] : [])]);
export const xlsx = (zusatz = "") => zip(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", ...(zusatz ? [zusatz] : [])]);
export const pptx = () => zip(["[Content_Types].xml", "ppt/presentation.xml"]);
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** Echt aufgebaute OLE2-Datei (512-Byte-Sektoren): Header, ein FAT-Sektor, Verzeichnis-Sektoren mit "Root Entry" und den Namen.
 *  `inhalt` wird als Daten-Sektor angehaengt (nicht im Verzeichnis); `schleife` laesst die Verzeichniskette auf sich selbst zeigen. */
export function ole(streams: string[], opt: { inhalt?: string; schleife?: boolean } = {}): Buffer {
  const namen = ["Root Entry", ...streams];
  const nDir = Math.ceil(namen.length / 4);
  const kopf = Buffer.alloc(512, 0);
  OLE2.copy(kopf, 0);
  kopf.writeUInt16LE(0x3e, 0x18); kopf.writeUInt16LE(3, 0x1a); kopf.writeUInt16LE(0xfffe, 0x1c);
  kopf.writeUInt16LE(9, 0x1e); kopf.writeUInt16LE(6, 0x20);
  kopf.writeUInt32LE(1, 0x2c); kopf.writeUInt32LE(1, 0x30);
  for (let i = 0; i < 109; i++) kopf.writeUInt32LE(i === 0 ? 0 : 0xffffffff, 0x4c + i * 4);
  const fat = Buffer.alloc(512, 0xff);
  fat.writeUInt32LE(0xfffffffd, 0);
  for (let i = 1; i <= nDir; i++) fat.writeUInt32LE(i === nDir ? (opt.schleife ? 1 : 0xfffffffe) : i + 1, i * 4);
  const dir = Buffer.alloc(nDir * 512, 0);
  namen.forEach((n, i) => {
    const o = i * 128, nm = Buffer.from(n, "utf16le");
    nm.copy(dir, o); dir.writeUInt16LE(nm.length + 2, o + 64); dir[o + 66] = i === 0 ? 5 : 2;
  });
  const daten = opt.inhalt ? [Buffer.concat([Buffer.from(opt.inhalt, "utf16le"), Buffer.alloc(512)]).subarray(0, 512)] : [];
  return Buffer.concat([kopf, fat, dir, ...daten]);
}
export const png = (zusatz = "") => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("IHDR" + zusatz)]);
export const jpg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("JFIF")]);
export const heic = (marke = "heic") => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftyp" + marke + "0000mif1heic")]);
export const exe = () => Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);
