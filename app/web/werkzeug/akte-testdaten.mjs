// Testdaten Anlagenakte fuer Design-Screenshots (nur Entwicklung, Wegwerf-Instanz mit --muster, Fake-Scanner).
// node app/web/werkzeug/akte-testdaten.mjs [--port 3100] [--gebaeude "Muster 6 L-Form viele Gruppen"] [--ohne-eicar]
// Erzeugt im Speicher: Datenblatt-PDF (3 Seiten, mit 2 Umwaelzpumpen verknuepft), Plan-PDF, Protokoll-PDF (2 Seiten), Foto (PNG),
// Excel (xlsx, nur Herunterladen), Offerte o1-pumpen.pdf (falls erzeugt) und eine PDF mit EICAR-Testzeichenkette (wird abgelehnt).
// Setzt Datenblattwerte der Pumpen. Die EICAR-Zeichenkette steht nie am Stueck in dieser Datei.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : s; };
const basis = `http://localhost:${arg("port", "3100")}`;
const name = arg("gebaeude", "Muster 6 L-Form viele Gruppen");

const anmeldung = await fetch(`${basis}/entwicklung/anmelden`, { redirect: "manual" });
const cookie = (anmeldung.headers.getSetCookie?.() ?? [anmeldung.headers.get("set-cookie")]).filter(Boolean).map((c) => c.split(";")[0]).join("; ");
if (!cookie) throw new Error(`Anmeldung fehlgeschlagen (${anmeldung.status})`);
const kopf = { cookie, "x-planora-request": "1", origin: basis };
const api = async (methode, pfad, body) => {
  const r = await fetch(basis + pfad, { method: methode, headers: { ...kopf, ...(body ? { "content-type": "application/json" } : {}) }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(`${methode} ${pfad}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};
const ablegen = async (gebaeudeId, dateiname, daten, q = {}) => {
  const qs = new URLSearchParams(q).toString();
  const r = await fetch(`${basis}/api/dokumente/gebaeude/${gebaeudeId}${qs ? `?${qs}` : ""}`, {
    method: "POST", headers: { ...kopf, "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(dateiname) }, body: daten });
  if (!r.ok) throw new Error(`Ablegen ${dateiname}: ${r.status} ${await r.text()}`);
  return r.json();
};

// ---------- PDF (Helvetica, nicht eingebettet: prueft die Standardschriften aus /pdfjs/) ----------
function pdf(seiten, vorspann = "") {
  const obj = [];
  const add = (s) => { obj.push(s); return obj.length; };
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fett = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pagesNr = obj.length + 1; obj.push(null);
  const kids = [];
  for (const inhalt of seiten) {
    const strom = Buffer.from(inhalt, "latin1");
    const c = add(`<< /Length ${strom.length} >>\nstream\n${inhalt}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesNr} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${fett} 0 R >> >> /Contents ${c} 0 R >>`));
  }
  obj[pagesNr - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const katalog = add(`<< /Type /Catalog /Pages ${pagesNr} 0 R >>`);
  let s = `%PDF-1.4\n%\xe2\xe3\xcf\xd3\n${vorspann}`;
  const off = [];
  obj.forEach((o, i) => { off.push(Buffer.byteLength(s, "latin1")); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(s, "latin1");
  s += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n${off.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  s += `trailer\n<< /Size ${obj.length + 1} /Root ${katalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(s, "latin1");
}
const esc = (t) => t.replace(/[\\()]/g, (m) => `\\${m}`);
const text = (x, y, t, gr = 10, f = "F1") => `BT /${f} ${gr} Tf ${x} ${y} Td (${esc(t)}) Tj ET\n`;
const linie = (x1, y1, x2, y2, w = 0.6) => `${w} w ${x1} ${y1} m ${x2} ${y2} l S\n`;
const kasten = (x, y, b, h, grau = 0.93) => `${grau} g ${x} ${y} ${b} ${h} re f 0 g\n`;

function datenblattSeiten() {
  const s1 = kasten(0, 772, 595, 70, 0.9) + text(48, 806, "Umwälzpumpe Hocheffizienz 25-60", 20, "F2") + text(48, 786, "Technisches Datenblatt · Ausgabe 2024", 10)
    + text(48, 730, "Leistungsdaten", 13, "F2") + [["Nennweite", "DN 25"], ["Förderhöhe max.", "6 m"], ["Leistungsaufnahme", "4 - 45 W"], ["Fördermenge max.", "3.4 m³/h"], ["Energieeffizienzindex", "EEI <= 0.20"], ["Schutzart", "IPX4D"]]
      .map(([a, b], i) => text(48, 704 - i * 22, a, 10) + text(300, 704 - i * 22, b, 10, "F2") + linie(48, 698 - i * 22, 547, 698 - i * 22, 0.3)).join("")
    + text(48, 540, "Kennlinie", 13, "F2") + linie(70, 300, 70, 520, 0.8) + linie(70, 300, 520, 300, 0.8)
    + `0.2 0.45 0.7 RG 1.6 w 70 500 m 200 470 l 320 420 l 420 360 l 500 305 l S 0 G\n` + text(76, 506, "H [m]", 8) + text(490, 288, "Q [m³/h]", 8)
    + text(48, 80, "Seite 1 von 3", 8);
  const s2 = text(48, 790, "Einbau und Anschluss", 16, "F2") + [
    "Die Pumpe wird mit waagrechter Motorwelle eingebaut. Absperrarmaturen vor und nach der Pumpe vorsehen.",
    "Elektrischer Anschluss 1 x 230 V, 50 Hz. Kein Motorschutz erforderlich (blockierstromfest).",
    "Regelungsarten: Proportionaldruck, Konstantdruck, Konstantdrehzahl, externes PWM-Signal.",
    "Medientemperatur: +2 °C bis +110 °C bei Umgebungstemperatur bis 40 °C.",
    "Wartung: wartungsfrei. Bei längerem Stillstand Pumpenkick der Regelung aktivieren."].map((z, i) => text(48, 756 - i * 20, z, 10)).join("")
    + kasten(48, 520, 499, 90) + text(60, 590, "Hinweis", 10, "F2") + text(60, 572, "Ersatzteil-Nr. 99 15 33 12 · Lebensdauer laut Hersteller 12 bis 15 Jahre.", 10)
    + text(48, 80, "Seite 2 von 3", 8);
  const s3 = text(48, 790, "Abmessungen", 16, "F2") + `0.5 w 120 420 260 260 re S 180 480 140 140 re S\n` + text(48, 380, "Baulänge 180 mm · Anschluss G 1 1/2 · Gewicht 2.1 kg", 10)
    + text(48, 80, "Seite 3 von 3", 8);
  return [s1, s2, s3];
}
function planSeiten() {
  let s = text(40, 800, "Grundriss UG · Technikzentrale", 16, "F2") + text(40, 782, "Massstab 1:50 · Stand Ausführung", 9);
  s += "1.6 w 60 120 475 620 re S\n0.8 w 60 420 m 300 420 l S 300 420 m 300 740 l S 300 300 m 535 300 l S\n";
  s += kasten(330, 560, 140, 120, 0.88) + text(345, 620, "Wärmepumpe", 10, "F2") + kasten(90, 600, 80, 80, 0.9) + text(98, 636, "Speicher", 9);
  s += "0.85 0.2 0.18 RG 2 w 170 640 m 330 640 l S 170 620 m 330 620 l S 0 G\n" + text(40, 80, "Plan H-01 · Index B", 8);
  return [s];
}
function protokollSeiten() {
  return [text(48, 790, "Inbetriebnahmeprotokoll Heizung", 18, "F2") + text(48, 768, "Objekt Muster 6 · 14.03.2024", 10)
    + [["Anlagendruck kalt", "1.4 bar"], ["Vorlauf Auslegung", "35 °C"], ["Hydraulischer Abgleich", "durchgeführt"], ["Pumpen eingestellt", "Proportionaldruck 4 m"]]
      .map(([a, b], i) => text(48, 720 - i * 24, a, 11) + text(320, 720 - i * 24, b, 11, "F2")).join("") + text(48, 80, "Seite 1 von 2", 8),
  text(48, 790, "Unterschriften", 16, "F2") + linie(48, 700, 250, 700) + linie(320, 700, 547, 700) + text(48, 684, "Installateur", 9) + text(320, 684, "Bauherrschaft", 9) + text(48, 80, "Seite 2 von 2", 8)];
}

// ---------- PNG (Foto-Ersatz: Technikraum als ruhiger Verlauf mit Formen) ----------
function crc32(b) { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function png(b, h) {
  const roh = Buffer.alloc((b * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    roh[y * (b * 3 + 1)] = 0;
    for (let x = 0; x < b; x++) {
      const i = y * (b * 3 + 1) + 1 + x * 3;
      let r = 214 - y * 0.08, g = 220 - y * 0.07, bl = 228 - y * 0.05;
      if (y > h * 0.72) { r -= 40; g -= 40; bl -= 38; } // Boden
      if (x > b * 0.18 && x < b * 0.42 && y > h * 0.2 && y < h * 0.72) { r = 238; g = 240; bl = 243; } // Speicher
      if (x > b * 0.55 && x < b * 0.85 && y > h * 0.32 && y < h * 0.72) { r = 245; g = 246; bl = 248; } // Waermepumpe
      if (y > h * 0.44 && y < h * 0.47 && x > b * 0.42 && x < b * 0.55) { r = 229; g = 50; bl = 45; } // Leitung
      if (y > h * 0.52 && y < h * 0.55 && x > b * 0.42 && x < b * 0.55) { r = 70; g = 110; bl = 170; }
      roh[i] = Math.max(0, Math.min(255, r)); roh[i + 1] = Math.max(0, Math.min(255, g)); roh[i + 2] = Math.max(0, Math.min(255, bl));
    }
  }
  const chunk = (typ, daten) => { const l = Buffer.alloc(4); l.writeUInt32BE(daten.length); const t = Buffer.from(typ); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, daten]))); return Buffer.concat([l, t, daten, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(b, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(roh)), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- XLSX (ZIP ohne Kompression, minimal gueltig) ----------
function zip(dateien) {
  const teile = []; const zentral = []; let off = 0;
  for (const [n, inhalt] of dateien) {
    const name = Buffer.from(n); const d = Buffer.from(inhalt); const crc = crc32(d);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(d.length, 18); lh.writeUInt32LE(d.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(d.length, 20); ch.writeUInt32LE(d.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    teile.push(lh, name, d); zentral.push(ch, name); off += 30 + name.length + d.length;
  }
  const z = Buffer.concat(zentral);
  const ende = Buffer.alloc(22); ende.writeUInt32LE(0x06054b50, 0); ende.writeUInt16LE(dateien.length, 8); ende.writeUInt16LE(dateien.length, 10); ende.writeUInt32LE(z.length, 12); ende.writeUInt32LE(off, 16);
  return Buffer.concat([...teile, z, ende]);
}
const xlsx = () => zip([
  ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
  ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Wartung" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
  ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Wartung 2025</t></is></c></row></sheetData></worksheet>`],
]);

// ---------- Ablegen ----------
const liste = await api("GET", "/api/struktur/gebaeude");
const g = liste.find((x) => x.name === name);
if (!g) throw new Error(`Gebaeude "${name}" nicht gefunden`);
const ablage = await api("GET", `/api/dokumente/gebaeude/${g.id}`);
const pumpen = ablage.bauteile.filter((b) => b.katalogId === "heizung.umwaelzpumpe").slice(0, 2).map((b) => b.id);
const wp = ablage.bauteile.find((b) => b.katalogId === "heizung.waermepumpe")?.id;

const o1 = join(import.meta.dirname, "..", "..", "..", "werkzeug", "preisdokument", "pdf", "o1-pumpen.pdf");
const plan = [
  ["Datenblatt Umwälzpumpe 25-60.pdf", pdf(datenblattSeiten()), { kategorie: "datenblatt", ...(pumpen.length ? { bauteile: pumpen.join(",") } : {}) }],
  ["Grundriss UG Technik H-01.pdf", pdf(planSeiten()), { kategorie: "plan", ...(wp ? { bauteile: wp } : {}) }],
  ["Inbetriebnahme Heizung 2024.pdf", pdf(protokollSeiten()), { kategorie: "protokoll", ...(wp ? { bauteile: wp } : {}) }],
  ["Technikraum Ostwand.png", png(1200, 800), { ...(wp ? { bauteile: wp } : {}) }],
  ["Wartungsplan 2025.xlsx", xlsx(), { ...(pumpen[0] ? { bauteile: pumpen[0] } : {}) }],
];
if (existsSync(o1)) plan.push(["o1-pumpen.pdf", readFileSync(o1), { kategorie: "offerte" }]);
if (!process.argv.includes("--ohne-eicar")) {
  const teil = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"];
  plan.push(["Rechnung Service unbekannt.pdf", pdf([text(48, 790, "Testdatei", 14)], `%${teil.join("")}\n`), {}]);
}
for (const [n, d, q] of plan) { const z = await ablegen(g.id, n, d, q); console.log(`abgelegt: ${n} (${z.scanStatus})`); }

// Datenblattwerte der Pumpen (gleicher Typ, ein PUT)
if (pumpen.length) {
  await api("PUT", "/api/bestand/datenblatt", { bauteilIds: pumpen, werte: { dn: 25, foerderhoehe_m: 6, leistung_w: 45 } }).catch(async (e) => {
    const f = await api("GET", `/api/bestand/bauteile/${pumpen[0]}/datenblatt`);
    console.log("Datenblatt-Felder:", f.felder.map((x) => x.schluessel).join(", "), "-", e.message);
  });
}
console.log(`fertig: ${plan.length} Dateien fuer "${name}", Pumpen verknuepft: ${pumpen.length}`);
