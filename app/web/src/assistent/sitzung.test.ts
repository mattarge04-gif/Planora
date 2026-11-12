import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFehler } from "../api";
import { Autosave, KONFLIKT_MELDUNG, konfliktLaden, ladeAssistent, type AssistentApi, type SpeicherStatus } from "./sitzung";
import { routeAusPfad, pfadFuer } from "./route";
import { leererZustand, reduziere, type AssistentZustand } from "./zustand";
import type { BeschreibungEingabe } from "../typen";

const ID = "00000000-0000-4000-8000-000000000900";
const BESCHREIBUNG: BeschreibungEingabe = {
  gebaeudeId: ID, stand: 3, geschosse: [{ id: "00000000-0000-4000-8000-000000000001", code: "EG" }],
  heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
  einheiten: [{ id: "00000000-0000-4000-8000-000000000100", geschossId: "00000000-0000-4000-8000-000000000001", bezeichnung: "Büro 1", art: "buero", flaecheM2: null }],
  bauteile: [], gruppen: [],
};
function fakeApi(over: Partial<AssistentApi> = {}): AssistentApi {
  const nie = () => Promise.reject(new Error("nicht erwartet"));
  return { ladeEntwurf: async () => null, speichereEntwurf: nie, loescheEntwurf: nie, ladeBeschreibung: async () => BESCHREIBUNG,
    ladeWelt: nie, vorschau: nie, uebernehmen: nie, legeAn: nie, katalog: nie, ...over };
}

describe("Navigation", () => {
  it("vor und zurück innerhalb 1–8", () => {
    let z: AssistentZustand = { ...leererZustand(), gebaeude: { ...leererZustand().gebaeude, id: ID } };
    z = reduziere(z, { typ: "zurueck" });
    expect(z.schritt).toBe(1);
    for (let i = 0; i < 10; i++) z = reduziere(z, { typ: "weiter" });
    expect(z.schritt).toBe(8);
    z = reduziere(z, { typ: "zurueck" });
    expect(z.schritt).toBe(7);
    z = reduziere(z, { typ: "schritt", nr: 3 });
    expect(z.schritt).toBe(3);
  });
  it("ohne angelegtes Gebäude bleibt der Assistent in Schritt 1", () => {
    let z = leererZustand();
    z = reduziere(z, { typ: "weiter" });
    z = reduziere(z, { typ: "schritt", nr: 4 });
    expect(z.schritt).toBe(1);
  });
  it("Schritt 1 ist ohne huelle.verwalten nur lesend", () => {
    let z = reduziere(leererZustand(), { typ: "huelleBearbeitbar", wert: false });
    z = reduziere(z, { typ: "gebaeude", name: "Neu", grundform: "l_form" });
    z = reduziere(z, { typ: "geschosse", ug: 2, og: 4 });
    expect(z.gebaeude).toEqual(leererZustand().gebaeude);
    z = reduziere(reduziere(z, { typ: "huelleBearbeitbar", wert: true }), { typ: "gebaeude", name: "Neu" });
    expect(z.gebaeude.name).toBe("Neu");
  });
  it("geladene Gebäude sind in Schritt 1 lesend", async () => {
    const g = await ladeAssistent(fakeApi(), ID, { name: "Haus" });
    expect(g.zustand.huelleBearbeitbar).toBe(false);
    expect(g.zustand.gebaeude.name).toBe("Haus");
  });
  it("Adressen /gebaeude/neu und /gebaeude/:id/assistent", () => {
    expect(routeAusPfad("/gebaeude/neu")).toEqual({ art: "neu" });
    expect(routeAusPfad(`/gebaeude/${ID}/assistent/`)).toEqual({ art: "bearbeiten", gebaeudeId: ID });
    expect(routeAusPfad("/gebaeude/abc/assistent")).toBeNull();
    expect(routeAusPfad("/")).toBeNull();
    expect(pfadFuer({ art: "bearbeiten", gebaeudeId: ID })).toBe(`/gebaeude/${ID}/assistent`);
  });
});

describe("Laden", () => {
  it("zuerst der Entwurf, sonst die Beschreibung", async () => {
    const entwurf = { ...leererZustand(), schritt: 5 as const, gebaeude: { ...leererZustand().gebaeude, id: ID, name: "Alt" } };
    const a = await ladeAssistent(fakeApi({ ladeEntwurf: async () => ({ stand: 7, daten: entwurf }) }), ID, { name: "Haus" });
    expect(a).toMatchObject({ ausEntwurf: true, entwurfStand: 7 });
    expect(a.zustand.schritt).toBe(5);
    const b = await ladeAssistent(fakeApi(), ID, {});
    expect(b).toMatchObject({ ausEntwurf: false, entwurfStand: 0 });
    expect(b.zustand.einheiten[0].bezeichnung).toBe("Büro 1");
  });
  it("fremder oder ungültiger Entwurf wird ignoriert", async () => {
    const r = await ladeAssistent(fakeApi({ ladeEntwurf: async () => ({ stand: 2, daten: { version: 1, gebaeude: { id: "anders" } } }) }), ID, {});
    expect(r).toMatchObject({ ausEntwurf: false, entwurfStand: 2 });
  });
});

describe("Autosave", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("speichert 1.5 s nach der letzten Eingabe einmal mit den letzten Daten", async () => {
    const speichern = vi.fn(async (stand: number) => stand + 1);
    const status: SpeicherStatus[] = [];
    const a = new Autosave(speichern, 0, (s) => status.push(s), () => {});
    a.eingabe({ n: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    a.eingabe({ n: 2 });
    await vi.advanceTimersByTimeAsync(1499);
    expect(speichern).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(speichern).toHaveBeenCalledTimes(1);
    expect(speichern).toHaveBeenCalledWith(0, { n: 2 });
    expect(a.stand).toBe(1);
    expect(status.at(-1)).toBe("gespeichert");
  });
  it("Schrittwechsel speichert sofort; unveränderte Daten nicht erneut", async () => {
    const speichern = vi.fn(async (stand: number) => stand + 1);
    const a = new Autosave(speichern, 4, () => {}, () => {});
    a.basis({ n: 0 });
    await a.sofort({ n: 0 });
    expect(speichern).not.toHaveBeenCalled();
    a.eingabe({ n: 1 });
    await a.sofort({ n: 1 });
    expect(speichern).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(speichern).toHaveBeenCalledTimes(1);
    expect(a.stand).toBe(5);
  });
  it("Speichervorgänge laufen nacheinander mit dem jeweils neuen Stand", async () => {
    const staende: number[] = [];
    const speichern = vi.fn(async (stand: number) => { staende.push(stand); await new Promise((r) => setTimeout(r, 100)); return stand + 1; });
    const a = new Autosave(speichern, 1, () => {}, () => {});
    const p1 = a.sofort({ n: 1 });
    const p2 = a.sofort({ n: 2 });
    await vi.advanceTimersByTimeAsync(300);
    await Promise.all([p1, p2]);
    expect(staende).toEqual([1, 2]);
  });
  it("409 meldet Konflikt, ruht und lädt neu", async () => {
    const speichern = vi.fn(async () => { throw new ApiFehler(409, ["Entwurf wurde inzwischen geaendert; bitte neu laden"]); });
    const onKonflikt = vi.fn();
    const status: SpeicherStatus[] = [];
    const a = new Autosave(speichern, 1, (s) => status.push(s), onKonflikt);
    await a.sofort({ n: 1 });
    expect(onKonflikt).toHaveBeenCalledTimes(1);
    expect(status.at(-1)).toBe("konflikt");
    a.eingabe({ n: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(speichern).toHaveBeenCalledTimes(1);

    const neu = { ...leererZustand(), gebaeude: { ...leererZustand().gebaeude, id: ID }, schritt: 6 as const };
    const api = fakeApi({ ladeEntwurf: async () => ({ stand: 9, daten: neu }) });
    const r = await konfliktLaden(api, ID, {}, 2);
    expect(r.meldung).toBe(KONFLIKT_MELDUNG);
    expect(r).toMatchObject({ entwurfStand: 9 });
    expect(r.zustand.schritt).toBe(6);
    a.neuStart(r.entwurfStand, r.zustand);
    a.eingabe({ n: 3 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(speichern).toHaveBeenCalledTimes(2);
    expect(speichern).toHaveBeenLastCalledWith(9, { n: 3 });
  });
});
