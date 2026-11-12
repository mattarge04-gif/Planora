import type { Beschreibung, KatalogEintrag, Welt } from "../typen";

export interface PanelDaten {
  titel: string; herstellerTyp: string | null; status: "bestaetigt" | "vorgeschlagen"; menge: string;
  zeilen: { menge: string; baujahr: string }[]; standort: string; versorgt: string[];
}

export function mengeText(summe: number, unbekannt: boolean): string {
  if (!unbekannt) return String(summe);
  return summe === 0 ? "unbekannt" : `mind. ${summe} (teilweise unbekannt)`;
}

export function panelDaten(welt: Welt, beschreibung: Beschreibung, katalog: KatalogEintrag[], schluessel: string): PanelDaten | null {
  const s = welt.symbole.find((x) => x.schluessel === schluessel);
  if (!s) return null;
  const code = new Map(welt.geschosse.map((g) => [g.id, g.code]));
  const einheit = new Map(welt.einheiten.map((e) => [e.id, e]));
  const zeilen = s.bauteilIds.flatMap((id) => beschreibung.bauteile.filter((b) => b.id === id));
  const erstes = zeilen[0];
  let standort = "–";
  if (erstes?.standort.einheitId) {
    const e = einheit.get(erstes.standort.einheitId);
    if (e) standort = `${code.get(e.geschossId) ?? "?"} · ${e.bezeichnung}`;
  } else if (erstes?.standort.geschossId) {
    standort = `${code.get(erstes.standort.geschossId) ?? "?"} · direkt am Geschoss`;
  }
  return {
    titel: katalog.find((k) => k.id === s.katalogId)?.name ?? s.katalogId,
    herstellerTyp: [s.hersteller, s.typ].filter((x): x is string => !!x).join(" · ") || null,
    status: s.status,
    menge: mengeText(s.mengeSumme, s.mengeUnbekannt),
    zeilen: zeilen.map((b) => ({ menge: b.menge === null ? "unbekannt" : String(b.menge), baujahr: b.baujahr == null ? "–" : String(b.baujahr) })),
    standort,
    versorgt: s.versorgt.map((id) => { const e = einheit.get(id); return e ? `${e.bezeichnung} (${code.get(e.geschossId) ?? "?"})` : id; }),
  };
}

export function uebersicht(welt: Welt, beschreibung: Beschreibung) {
  const name = (id: string) => welt.einheiten.find((e) => e.id === id)?.bezeichnung ?? id;
  const text = (h: { code: string; bezug: string }) => {
    if (h.code === "verteiler_vorschlag") return `${name(h.bezug)}: Verteiler noch nicht erfasst`;
    if (h.code === "ueberlappung") return `${name(h.bezug)}: Layout ueberlappt`;
    if (h.code === "position_widerspruch") return "Widerspruechliche manuelle Positionen in einer Bauteilgruppe";
    return h.code;
  };
  return {
    geschosse: welt.geschosse.length, einheiten: welt.einheiten.length, symbole: welt.symbole.length,
    hinweise: [...(beschreibung.hinweise ?? []), ...welt.hinweise].map(text),
  };
}
