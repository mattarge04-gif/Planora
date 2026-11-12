import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import { abgabenVon, hauptverteiler, leererZustand, reduziere, type Aktion, type AssistentZustand } from "./zustand";

function neuesGebaeude(...aktionen: Aktion[]): AssistentZustand {
  let z = leererZustand("00000000-0000-4000-8000-000000000901");
  z = reduziere(z, { typ: "geschosse", ug: 1, og: 1 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: [{ id: "00000000-0000-4000-8000-000000000001", code: "UG1" }, { id: "00000000-0000-4000-8000-000000000002", code: "EG" }, { id: "00000000-0000-4000-8000-000000000003", code: "OG1" }] });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}

describe("Abgaben folgen Standard und Ausnahmen", () => {
  it("neue Einheit erhält je wirksamer Abgabe eine Zeile «weiss nicht»", () => {
    const z = neuesGebaeude({ typ: "standard", art: "fbh", wert: "ja" }, { typ: "einheitNeu", geschoss: "EG", art: "buero" });
    const e = z.einheiten[0];
    expect(abgabenVon(z, e.schluessel).map((t) => [t.katalogId, t.menge, t.status])).toEqual([[K.hk, null, "vorgeschlagen"], [K.fbh, null, "vorgeschlagen"]]);
  });
  it("Ausnahme nein entfernt die Abgabe samt Gruppenzuteilung; Technik erhält keine Abgaben", () => {
    let z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero" }, { typ: "einheitNeu", geschoss: "UG1", art: "technik" }, { typ: "gruppenAnzahl", anzahl: 1 });
    const buero = z.einheiten[0].schluessel;
    const hk = abgabenVon(z, buero)[0].schluessel;
    z = reduziere(z, { typ: "verbraucher", gruppe: z.gruppen[0].schluessel, bauteil: hk, an: true });
    expect(hauptverteiler(z)!.versorgt).toEqual([buero]);
    z = reduziere(z, { typ: "ausnahme", einheit: buero, art: "hk", wert: "nein" });
    expect(abgabenVon(z, buero)).toEqual([]);
    expect(z.gruppen[0].verbraucher).toEqual([]);
    expect(hauptverteiler(z)!.versorgt).toEqual([]);
    expect(abgabenVon(z, z.einheiten[1].schluessel)).toEqual([]);
  });
  it("Ausnahme gleich Standard wird nicht gespeichert; unbekannt macht Mengen zum Vorschlag", () => {
    let z = neuesGebaeude({ typ: "einheitNeu", geschoss: "EG", art: "buero" });
    const e = z.einheiten[0].schluessel;
    z = reduziere(z, { typ: "ausnahme", einheit: e, art: "hk", wert: "ja" });
    expect(z.einheiten[0].ausnahme).toEqual({});
    z = reduziere(z, { typ: "abgabeAendern", schluessel: abgabenVon(z, e)[0].schluessel, menge: 4 });
    z = reduziere(z, { typ: "ausnahme", einheit: e, art: "hk", wert: "unbekannt" });
    expect(z.einheiten[0].ausnahme).toEqual({ hk: "unbekannt" });
    expect(abgabenVon(z, e)[0]).toMatchObject({ menge: 4, status: "vorgeschlagen" });
  });
});
