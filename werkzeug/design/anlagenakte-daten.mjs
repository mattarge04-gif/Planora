// Testdaten Anlagenakte T9 fuer Design-Screenshots (nur Entwicklung, Wegwerf-Instanz mit --muster).
// node werkzeug/design/anlagenakte-daten.mjs [--port 3100] [--gebaeude "Muster 6 L-Form viele Gruppen"]
// Fuegt in die erste Technik-Einheit je ein Ausdehnungsgefaess und ein "Sonstiges" ein (bestaetigt, Menge 1, ohne Versorgung)
// sowie einen Waermezaehler in Gruppe 1 (Stilpruefung WMZ, Muster 6 hat sonst keinen) und gibt die neuen Bauteil-IDs aus. Wiederholter Aufruf fuegt nichts doppelt ein.
const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : s; };
const basis = `http://localhost:${arg("port", "3100")}`;
const name = arg("gebaeude", "Muster 6 L-Form viele Gruppen");
const NEU = ["heizung.ausdehnungsgefaess", "heizung.sonstiges"];

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
const url = `/api/struktur/gebaeude/${g.id}/beschreibung`;
const b = await api("GET", url);

const technik = b.einheiten.find((e) => e.art === "technik");
if (!technik?.id) throw new Error(`${name}: keine Einheit mit art "technik"`);
const gruppe1 = b.gruppen?.find((gr) => gr.nummer === 1)?.id;
const neuTeile = [...NEU.map((katalogId) => ({ katalogId })), ...(gruppe1 ? [{ katalogId: "heizung.wmz", ort: { gruppe: { gruppeId: gruppe1 } } }] : [])];
// E48 (Datenblatt je Typ): Umwaelzpumpen der Zentrale ohne Angabe erhalten Hersteller und Typ, damit ein Datenblatt fuer beide gilt.
const ohneTyp = b.bauteile.filter((t) => t.katalogId === "heizung.umwaelzpumpe" && t.standort?.einheitId === technik.id && !t.hersteller && !t.typ);
if (ohneTyp.length) {
  await api("PUT", url, { ...b, bauteile: b.bauteile.map((t) => (ohneTyp.includes(t) ? { ...t, hersteller: "Grundfos", typ: "Magna3 32-80" } : t)) });
  console.log(`${name}: ${ohneTyp.length} Umwälzpumpe(n) mit Grundfos Magna3 32-80`);
  Object.assign(b, await api("GET", url));
}
const fehlend = neuTeile.filter((n) => !b.bauteile.some((t) => t.katalogId === n.katalogId && t.standort?.einheitId === technik.id));
if (!fehlend.length) {
  console.log(`${name}: bereits vorhanden in "${technik.bezeichnung}"`);
} else {
  const vorher = new Set(b.bauteile.map((t) => t.id));
  const neu = await api("PUT", url, { ...b, bauteile: [...b.bauteile,
    ...fehlend.map((n) => ({ ...n, standort: { einheitId: technik.id }, menge: 1, status: "bestaetigt", versorgt: [] }))] });
  for (const t of neu.bauteile.filter((x) => !vorher.has(x.id))) console.log(`${t.katalogId}: ${t.id}`);
  console.log(`${name}: ${fehlend.length} Bauteil(e) in "${technik.bezeichnung}" ergaenzt`);
}
