// S10 Tests: node --test s10-rechenkern/kern.test.ts   (Node >= 23.6, Typ-Stripping)
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { berechne, kanonisch, zustand, aequivalenzalter, dez, rundGanz, type Element } from "./kern.ts";

const HIER = new URL(".", import.meta.url);
import { PARAM, typ, eingabe, ang, zufallsEingabe, gesamtHash, N_ZUFALL } from "./zufall.ts";

// ---------- 1. Testtabelle FA-22 gegen unabhaengiges Orakel ----------
test("FA-22 Testtabelle: Kern = Python-Orakel (16 Faelle)", () => {
  const faelle = JSON.parse(readFileSync(new URL("faelle.json", HIER), "utf8")).faelle;
  const erw = JSON.parse(readFileSync(new URL("erwartet.json", HIER), "utf8"));
  for (const f of faelle) {
    const t = typ({ id: "T", L: f.L, preis: f.preis ?? null });
    const el: Element = { id: f.id, gebaeude: "G1", typ_id: "T", menge: f.menge ?? 1, einbaujahr: f.E, angaben_lebensdauer: [], bewertung: f.bewertung ? { jahr: f.bewertung.jahr, zustandswert: f.bewertung.z } : null };
    const r = berechne(eingabe([t], [el], { parameter: { ...PARAM, teuerung: f.teuerung ?? "0.01" } }));
    const z = r.zeilen[0]; const e = erw[f.id];
    assert.equal(z.J1, e.J1, `${f.id} J1`); assert.equal(z.RL, e.RL, `${f.id} RL`); assert.equal(z.ampel, e.ampel, `${f.id} Ampel`);
    assert.deepEqual(r.ereignisse.map((x) => x.jahr), e.ereignis_jahre, `${f.id} Ereignisjahre`);
    if (e.kosten_rappen) assert.deepEqual(r.ereignisse.map((x) => x.kosten_rappen), e.kosten_rappen, `${f.id} Kosten`);
  }
});

// ---------- 2. ZHAW-Kurve: Eckpunkte, Monotonie, Umkehrfunktion ----------
test("ZHAW-Kurve: z(0)=1, z(a_k)=0,4, z(L)=g, monoton, Umkehr exakt", () => {
  const L = dez("20"), k = dez("0.75"), g = dez("0.25"), eps = 10n ** 20n; // 1e-10
  const nah = (a: bigint, b: bigint) => (a - b < 0n ? b - a : a - b) < eps;
  assert.ok(nah(zustand(0n, L, k, g), dez("1"))); assert.ok(nah(zustand(dez("15"), L, k, g), dez("0.4"))); assert.ok(nah(zustand(L, L, k, g), g));
  let vor = dez("2");
  for (let a = 0; a <= 200; a++) { const z = zustand(dez((a / 10).toFixed(1)), L, k, g); assert.ok(z <= vor, `monoton bei ${a / 10}`); vor = z; }
  for (let a = 0; a <= 200; a++) { const A = dez((a / 10).toFixed(1)); assert.ok(nah(aequivalenzalter(zustand(A, L, k, g), L, k, g), A), `Umkehr bei ${a / 10}`); }
});

// ---------- 3. Lebensdauer-Rangfolge Element > Typ manuell > Datenblatt > Standard ----------
function rangFall(elementManuell: boolean, typManuell: boolean, datenblatt: boolean) {
  const t = typ({ L: "25", lebensdauer_tabelle: { min: typManuell ? "15" : "25", mittel: typManuell ? "18" : "25", max: typManuell ? "21" : "25", quelle: typManuell ? "manuell" : "planora_standard" },
    angaben_lebensdauer: datenblatt ? [ang({ dokumentart: "datenblatt", stunden: "50000" })] : [] });
  const el: Element = { id: "E", gebaeude: "G1", typ_id: "T", menge: 1, einbaujahr: 2010, angaben_lebensdauer: elementManuell ? [ang({ quelle_art: "manuell", jahre: "12" })] : [] };
  return berechne(eingabe([t], [el])).zeilen[0];
}
test("Override-Rangfolge: alle 8 Kombinationen", () => {
  for (const em of [true, false]) for (const tm of [true, false]) for (const db of [true, false]) {
    const z = rangFall(em, tm, db);
    const [rang, L] = em ? [1, "12.0"] : tm ? [2, "18.0"] : db ? [3, "20.0"] : [4, "25.0"];
    assert.equal(z.lebensdauer_rang, rang, `em=${em} tm=${tm} db=${db}`); assert.equal(z.L_mittel, L);
  }
});
test("Unbestaetigte KI-Angabe und verworfene Angabe beeinflussen die Rechnung nie", () => {
  for (const status of ["vorgeschlagen", "verworfen", "ersetzt"] as const) {
    const t = typ({ L: "25", angaben_lebensdauer: [ang({ dokumentart: "datenblatt", jahre: "5", status })] });
    const el: Element = { id: "E", gebaeude: "G1", typ_id: "T", menge: 1, einbaujahr: 2010, angaben_lebensdauer: [ang({ quelle_art: "manuell", jahre: "3", status })] };
    const z = berechne(eingabe([t], [el])).zeilen[0]; assert.equal(z.lebensdauer_rang, 4); assert.equal(z.J1, 2035);
  }
});
test("Stunden -> Jahre (FA-17): 50'000 h / 2'500 h/a = 20,0; ohne h/a naechster Rang", () => {
  const t = typ({ L: "25", angaben_lebensdauer: [ang({ dokumentart: "datenblatt", stunden: "50000" })] });
  const el: Element = { id: "E", gebaeude: "G1", typ_id: "T", menge: 1, einbaujahr: 2020, angaben_lebensdauer: [] };
  const z = berechne(eingabe([t], [el])).zeilen[0];
  assert.equal(z.L_mittel, "20.0"); assert.ok(z.rechenweg.some((w) => w.includes("50000 h / 2500 h/a = 20.0 J.")));
  const z3 = berechne(eingabe([t], [{ ...el, betriebsstunden_pro_jahr: "3000" }])).zeilen[0]; assert.equal(z3.L_mittel, "16.7"); assert.equal(z3.J1, 2037);
  const ohne = berechne(eingabe([t], [el], { parameter: { ...PARAM, betriebsstunden_default: undefined } })).zeilen[0];
  assert.equal(ohne.lebensdauer_rang, 4); assert.ok(ohne.rechenweg.some((w) => w.includes("nicht verwendbar")));
});
test("Bandbreite proportional: Standard 15/20/25, Datenblatt 30 J. -> 22,5/30/37,5", () => {
  const t = typ({ L: "20", lebensdauer_tabelle: { min: "15", mittel: "20", max: "25", quelle: "planora_standard" }, planora_standard: { min: "15", mittel: "20", max: "25" }, angaben_lebensdauer: [ang({ dokumentart: "datenblatt", jahre: "30" })] });
  const z = berechne(eingabe([t], [{ id: "E", gebaeude: "G1", typ_id: "T", menge: 1, einbaujahr: 2000, angaben_lebensdauer: [] }])).zeilen[0];
  assert.equal(z.J1, 2030); assert.equal(z.J1_frueh, 2023); /* 22,5 -> 23 */ assert.equal(z.J1_spaet, 2038); /* 37,5 -> 38 */
});
test("Fehlender Preis -> kosten null und 'ohne Kosten' gezaehlt, nie 0", () => {
  const r = berechne(eingabe([typ({ L: "5" })], [{ id: "E", gebaeude: "G1", typ_id: "T", menge: 1, einbaujahr: 2026, angaben_lebensdauer: [] }]));
  assert.ok(r.ereignisse.length > 0 && r.ereignisse.every((e) => e.kosten_rappen === null)); assert.equal(r.ohne_kosten, r.ereignisse.length); assert.equal(r.summe_rappen, "0");
});
test("Ohne Einbaujahr, Uebergabe und Bewertung -> unvollstaendig, grau, kein Ereignis", () => {
  const r = berechne(eingabe([typ({ L: "5" })], [{ id: "E", gebaeude: "G1", typ_id: "T", menge: 1, einbaujahr: null, angaben_lebensdauer: [] }]));
  assert.equal(r.zeilen[0].status, "unvollstaendig"); assert.equal(r.zeilen[0].ampel, "grau"); assert.equal(r.ereignisse.length, 0);
});
test("Einbaujahr abgeleitet aus Uebergabejahr, im Rechenweg sichtbar (FA-16)", () => {
  const r = berechne(eingabe([typ({ L: "10" })], [{ id: "E", gebaeude: "G1", typ_id: "T", menge: 1, einbaujahr: null, angaben_lebensdauer: [] }], { uebergabejahr: { G1: 2020 } }));
  assert.equal(r.zeilen[0].J1, 2030); assert.ok(r.zeilen[0].rechenweg.some((w) => w.includes("abgeleitet")));
});
test("Rundung half-up: rundGanz", () => {
  assert.equal(rundGanz(dez("16.5")), 17n); assert.equal(rundGanz(dez("16.4999")), 16n); assert.equal(rundGanz(dez("-2.5")), -3n); assert.equal(rundGanz(dez("12.5")), 13n);
});

// ---------- 4. Eigenschaftstests mit Zufalls-Schnappschuessen ----------
test(`Determinismus: ${N_ZUFALL} Zufalls-Schnappschuesse zweimal gerechnet -> byte-identisch; Reihenfolge der Eingabe egal; Summe = Summe der Zeilen`, () => {
  for (let s = 1; s <= N_ZUFALL; s++) {
    const e = zufallsEingabe(s); const a = kanonisch(berechne(e)); const b = kanonisch(berechne(structuredClone(e)));
    assert.equal(a, b, `Seed ${s}`);
    const gemischt = { ...e, elemente: [...e.elemente].reverse(), typen: [...e.typen].reverse() };
    const rg = berechne(gemischt), r0 = berechne(e);
    assert.equal(kanonisch({ ...rg, eingabe_hash: "" }), kanonisch({ ...r0, eingabe_hash: "" }), `Reihenfolge Seed ${s}`);
    const zeilenSumme = r0.ereignisse.reduce((acc, x) => acc + BigInt(x.kosten_rappen ?? "0"), 0n);
    const planSumme = Object.values(r0.plan).flatMap((j) => Object.values(j)).reduce((acc, x) => acc + BigInt(x), 0n);
    assert.equal(zeilenSumme.toString(), r0.summe_rappen); assert.equal(planSumme.toString(), r0.summe_rappen);
  }
});
test("Determinismus ueber Prozesse: anderer Prozess, andere Zeitzone/Locale -> gleicher Gesamt-Hash", () => {
  const lokal = gesamtHash(2000);
  const fremd = execFileSync(process.execPath, [fileURLToPath(new URL("hash_lauf.ts", HIER)), "2000"], { env: { ...process.env, TZ: "Pacific/Kiritimati", LANG: "fr_CH.UTF-8", LC_ALL: "fr_CH.UTF-8" } }).toString().trim();
  assert.equal(fremd, lokal);
});
