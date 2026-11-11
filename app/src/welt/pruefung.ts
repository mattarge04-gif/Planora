import { STANDORT_GESCHOSS, type Katalog, type Regelwerk } from "./regelwerk.js";
import { wirksameHeizung } from "./heizung.js";
import type { Beschreibung, EinheitEingabe, EinheitVerweis, Fehler } from "./typen.js";

/** IDs, die heute zu diesem Gebaeude gehoeren (aus der DB). */
export interface Bestand {
  geschossIds: Set<string>; einheitIds: Set<string>; bauteilIds: Set<string>;
  einheitenManuell: Set<string>; bauteileManuell: Set<string>;
}

export function pruefeBeschreibung(b: Beschreibung, bestand: Bestand, rw: Regelwerk, katalog: Katalog): Fehler[] {
  const fehler: Fehler[] = [];
  const melde = (pfad: string, code: string, meldung: string) => fehler.push({ pfad, code, meldung });
  const eintraege = new Map(katalog.eintraege.map((e) => [e.id, e]));

  const einheitIds = new Set<string>();
  b.einheiten.forEach((e, i) => {
    const p = `einheiten[${i}]`;
    if (e.id !== undefined) {
      if (!bestand.einheitIds.has(e.id)) melde(`${p}.id`, "id_unbekannt", "Einheit gehoert nicht zu diesem Gebaeude");
      else if (einheitIds.has(e.id)) melde(`${p}.id`, "id_doppelt", "Einheit mehrfach angegeben");
      einheitIds.add(e.id);
    }
    if (!bestand.geschossIds.has(e.geschossId)) melde(`${p}.geschossId`, "verweis_ungueltig", "Geschoss gehoert nicht zu diesem Gebaeude");
    if (!Object.hasOwn(rw.einheitArten, e.art)) melde(`${p}.art`, "art_unbekannt", `Einheit-Art ${e.art} ist im Regelwerk nicht vorgesehen`);
  });

  const einheitZu = (v: EinheitVerweis): EinheitEingabe | undefined => {
    if (v.einheitId !== undefined)
      return bestand.einheitIds.has(v.einheitId) ? b.einheiten.find((e) => e.id === v.einheitId) : undefined;
    if (v.einheitIndex !== undefined && Number.isInteger(v.einheitIndex) && v.einheitIndex >= 0 && v.einheitIndex < b.einheiten.length)
      return b.einheiten[v.einheitIndex];
    return undefined;
  };

  const bauteilIds = new Set<string>();
  b.bauteile.forEach((t, j) => {
    const p = `bauteile[${j}]`;
    if (t.id !== undefined) {
      if (!bestand.bauteilIds.has(t.id)) melde(`${p}.id`, "id_unbekannt", "Bauteil gehoert nicht zu diesem Gebaeude");
      else if (bauteilIds.has(t.id)) melde(`${p}.id`, "id_doppelt", "Bauteil mehrfach angegeben");
      bauteilIds.add(t.id);
    }
    const k = eintraege.get(t.katalogId);
    if (!k) melde(`${p}.katalogId`, "katalog_unbekannt", `Katalog-ID ${t.katalogId} unbekannt`);

    const s = t.standort;
    const anzahl = [s.einheitId, s.einheitIndex, s.geschossId].filter((x) => x !== undefined).length;
    let artStandort: string | undefined;
    let einheit: EinheitEingabe | undefined;
    if (anzahl === 0) melde(`${p}.standort`, "standort_fehlt", "Standort fehlt");
    else if (anzahl > 1) melde(`${p}.standort`, "standort_doppelt", "Genau einen Standort angeben");
    else if (s.geschossId !== undefined) {
      if (bestand.geschossIds.has(s.geschossId)) artStandort = STANDORT_GESCHOSS;
      else melde(`${p}.standort`, "verweis_ungueltig", "Geschoss gehoert nicht zu diesem Gebaeude");
    } else {
      einheit = einheitZu(s);
      if (einheit) artStandort = einheit.art;
      else melde(`${p}.standort`, "verweis_ungueltig", "Einheit nicht in dieser Beschreibung");
    }

    if (k && artStandort !== undefined && Object.hasOwn(rw.erlaubt, artStandort) && !rw.erlaubt[artStandort].includes(k.id))
      melde(`${p}.katalogId`, "katalog_nicht_erlaubt", `${k.name} ist an diesem Standort nicht vorgesehen`);
    if (k && t.menge !== null && (!Number.isInteger(t.menge) || t.menge < 0 || t.menge > k.mengeMax))
      melde(`${p}.menge`, "menge_ungueltig", `Ganze Zahl 0–${k.mengeMax} oder unbekannt erwartet`);
    if (k?.heizArt && t.status === "bestaetigt" && einheit && wirksameHeizung(b.heizungStandard, einheit.heizungAusnahme)[k.heizArt] !== "ja")
      melde(`${p}.status`, "bestaetigt_bei_unbekannt", `Bestaetigt nur moeglich, wenn ${k.heizArt.toUpperCase()} in der Einheit vorhanden ist`);
    t.versorgt.forEach((v, m) => {
      if (!einheitZu(v)) melde(`${p}.versorgt[${m}]`, "verweis_ungueltig", "Versorgte Einheit nicht in dieser Beschreibung");
    });
  });

  for (const id of bestand.einheitenManuell) if (!einheitIds.has(id)) melde("einheiten", "loeschen_blockiert", `Einheit ${id} hat ein manuelles Layout`);
  for (const id of bestand.bauteileManuell) if (!bauteilIds.has(id)) melde("bauteile", "loeschen_blockiert", `Bauteil ${id} hat eine manuelle Position`);
  return fehler;
}
