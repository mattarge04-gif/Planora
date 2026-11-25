// Legt eine PDF-Huelle mit EICAR-Zeichenkette ueber die API ab (nur im Speicher, nie auf Platte). Nur Entwicklung.
// node werkzeug/anlagenakte/eicar-ablegen.mjs [--port 3100] [--gebaeude "Muster 6 L-Form viele Gruppen"]
// Erwartet: 201/200 mit Scan-Befund "abgelehnt" (Fake-Scanner bzw. clamd: Eicar-Test-Signature).
const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : s; };
const basis = `http://localhost:${arg("port", "3100")}`;
const name = arg("gebaeude", "Muster 6 L-Form viele Gruppen");

const anmeldung = await fetch(`${basis}/entwicklung/anmelden`, { redirect: "manual" });
const cookie = (anmeldung.headers.getSetCookie?.() ?? [anmeldung.headers.get("set-cookie")]).filter(Boolean).map((c) => c.split(";")[0]).join("; ");
if (!cookie) throw new Error(`Anmeldung fehlgeschlagen (${anmeldung.status})`);

const liste = await (await fetch(`${basis}/api/struktur/gebaeude`, { headers: { cookie } })).json();
const g = liste.find((x) => x.name === name);
if (!g) throw new Error(`Gebaeude "${name}" nicht gefunden: ${liste.map((x) => x.name).join(", ")}`);

// In zwei Teilen, damit diese Datei selbst keine EICAR-Signatur enthaelt
const eicar = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join("");
const r = await fetch(`${basis}/api/dokumente/gebaeude/${g.id}`, {
  method: "POST", body: Buffer.from(`%PDF-1.7\n${eicar}`),
  headers: { cookie, "content-type": "application/octet-stream", "x-dateiname": "eicar-test.pdf", "x-planora-request": "1", origin: basis },
});
const text = await r.text();
let j; try { j = JSON.parse(text); } catch { j = null; }
console.log(`Status ${r.status}${j?.id ? `, ID ${j.id}, Scan ${j.scanStatus}` : ""}`);
if (!j?.id) { console.log(text); process.exit(1); }
// Pruefung laeuft im Hintergrund: Ergebnis bis 10 s nachladen
for (let i = 0; i < 20 && j.scanStatus === "quarantaene"; i++) {
  await new Promise((x) => setTimeout(x, 500));
  const a = await (await fetch(`${basis}/api/dokumente/gebaeude/${g.id}`, { headers: { cookie } })).json();
  j = a.dokumente.find((d) => d.id === j.id) ?? j;
}
console.log(`Ergebnis: ${j.scanStatus}${j.scanGrund ? ` (${j.scanGrund})` : ""}`);
