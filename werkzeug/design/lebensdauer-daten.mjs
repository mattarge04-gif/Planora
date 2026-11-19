// Testdaten Lebensdauer/Ampel fuer Design-Screenshots (nur Entwicklung, Wegwerf-Instanz mit --muster).
// node werkzeug/design/lebensdauer-daten.mjs [--port 3100] [--gebaeude "Muster 6 L-Form viele Gruppen"]
// Setzt: Typpreise Heizkoerper 800 / Waermepumpe 35000, Baujahr 2008 je Bauteil (statt Gebaeudestandard, damit
// Grau sichtbar bleibt: Bauteile im obersten Geschoss bleiben ohne Baujahr), einen Verteiler "schlecht" und Abweichungen
// (Heizkoerper 2021 gruen, Heizkoerper 1985 mit eigenem Preis rot, Speicher 2020). Ziel: alle vier Ampelfarben, einige ohne Preis.
const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : s; };
const basis = `http://localhost:${arg("port", "3100")}`;
const name = arg("gebaeude", "Muster 6 L-Form viele Gruppen");

const anmeldung = await fetch(`${basis}/entwicklung/anmelden`, { redirect: "manual" });
const cookie = (anmeldung.headers.getSetCookie?.() ?? [anmeldung.headers.get("set-cookie")]).filter(Boolean).map((c) => c.split(";")[0]).join("; ");
if (!cookie) throw new Error(`Anmeldung fehlgeschlagen (${anmeldung.status})`);
const api = async (methode, pfad, body) => {
  const r = await fetch(basis + pfad, { method: methode, headers: { cookie, ...(body ? { "content-type": "application/json", "x-planora-request": "1", origin: basis } : {}) }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(`${methode} ${pfad}: ${r.status} ${await r.text()}`);
  return r.json();
};

const liste = await api("GET", "/api/struktur/gebaeude");
const g = liste.find((x) => x.name === name);
if (!g) throw new Error(`Gebaeude "${name}" nicht gefunden: ${liste.map((x) => x.name).join(", ")}`);
const url = `/api/lebensdauer/gebaeude/${g.id}`;
let s = await api("GET", url);

// 1. Typpreise (nur Typen, die im Gebaeude vorkommen)
const preise = { "heizung.heizkoerper": 800, "heizung.waermepumpe": 35000 };
s = await api("PUT", url, { stand: s.stand, heizungBaujahr: null,
  typen: s.typen.filter((t) => preise[t.katalogId] !== undefined).map((t) => ({ katalogId: t.katalogId, stueckpreis: preise[t.katalogId] })) });

// 2. Baujahr 2008 je Bauteil, ausser im obersten Geschoss (bleibt grau); dazu Zustand und Abweichungen
const geschoss = (b) => b.ort.split(" ")[0];
const codes = [...new Set(s.bauteile.map(geschoss))];
const oben = codes.filter((c) => /^OG\d+$/.test(c)).sort((x, y) => Number(y.slice(2)) - Number(x.slice(2)))[0];
const je = new Map(s.bauteile.filter((b) => geschoss(b) !== oben).map((b) => [b.id, { id: b.id, baujahr: 2008 }]));
const erstes = (id) => s.bauteile.find((b) => b.katalogId === id && je.has(b.id));
const v = erstes("heizung.verteiler"); if (v) je.get(v.id).zustand = "schlecht";
const hk = s.bauteile.filter((b) => b.katalogId === "heizung.heizkoerper" && je.has(b.id));
if (hk[0]) je.get(hk[0].id).baujahr = 2021;
if (hk[1]) Object.assign(je.get(hk[1].id), { baujahr: 1985, stueckpreis: 650 });
const sp = erstes("heizung.speicher"); if (sp) je.get(sp.id).baujahr = 2020;
s = await api("PUT", url, { stand: s.stand, bauteile: [...je.values()] });
console.log(`Geschosse ${codes.join(", ")}; ohne Baujahr: ${oben ?? "-"}`);

const z = s.ergebnis.zaehler;
console.log(`${name}: rot ${z.rot}, gelb ${z.gelb}, gruen ${z.gruen}, grau ${z.grau}; 5 J. CHF ${s.ergebnis.summe5.betrag}, ohne Preis ${s.ergebnis.summe5.ohnePreis}`);
