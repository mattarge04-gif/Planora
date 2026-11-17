import type { KatalogEintrag, Welt } from "../typen";
import { INTERNE_HINWEISE } from "../panel/daten";
import { K, teilName } from "./bestueckung";
import type { Positionen } from "./beschreibung";
import {
  ABGABE_VON, HEIZ_ARTEN, HEIZ_NAME, einheitVon, erzeuger, fbhSpeisung, gruppeVonVerbraucher, hauptverteiler, istAbgabe, unterverteiler, verbraucherDerArt, weitereTeile, zentraleRaumHinweis, zubehoerVon,
  type AssistentZustand, type SchrittNr, type ZBauteil, type ZGruppe,
} from "./zustand";

export interface PruefHinweis { code: string; text: string; schritt: SchrittNr; schluessel?: string }

/** Kurzname eines Bauteils mit Ort, z. B. «Heizkörper, Büro 1». */
export function bauteilText(z: AssistentZustand, t: ZBauteil, katalog?: readonly KatalogEintrag[] | null): string {
  const e = einheitVon(z, t);
  const fbh = t.katalogId === K.verteiler && unterverteiler(z).some((x) => x.schluessel === t.schluessel);
  const name = (fbh ? "FBH-Verteiler" : t.katalogId === K.verteiler ? "Hauptverteiler" : teilName(t.katalogId, katalog)) + (t.hersteller ? ` ${t.hersteller}` : "");
  return e ? `${name}, ${e.bezeichnung}` : name;
}

/**
 * Hinweise für "Prüfen" (nicht blockierend): eigene Prüfungen am Zustand plus Hinweise der Vorschau-Welt,
 * deren Bezug über die Platzhalter-IDs (`neu-<art>-<i>`) bzw. gespeicherte IDs auf Schlüssel abgebildet wird.
 */
export function pruefHinweise(z: AssistentZustand, welt: Welt | null, positionen: Positionen, katalog?: readonly KatalogEintrag[] | null): PruefHinweis[] {
  const h: PruefHinweis[] = [];
  if (z.einheiten.length === 0) h.push({ code: "keine_einheiten", text: "Noch keine Einheiten erfasst.", schritt: 2 });
  if (erzeuger(z).length === 0) h.push({ code: "kein_erzeuger", text: "Noch kein Erzeuger gewählt.", schritt: 4 });
  // E42: «Weiss nicht» als Standard ergibt keine Abgaben – ohne Hinweis fiele das nicht auf
  if (z.einheiten.length > 0 && !z.bauteile.some(istAbgabe))
    h.push({ code: "keine_abgaben", text: "Im Gebäude sind keine Heizkörper, keine Fussbodenheizung und kein TABS erfasst. Prüfen Sie den Heizungsstandard.", schritt: 3 });
  const raum = zentraleRaumHinweis(z);
  if (raum) h.push({ code: "zentrale_raum", text: raum, schritt: 4 });
  // Fehlende Mengen je Abgabeart, gebündelt
  for (const art of HEIZ_ARTEN) {
    const einheiten = new Set(z.bauteile.filter((t) => t.katalogId === ABGABE_VON[art] && t.menge === null && "einheit" in t.standort)
      .map((t) => (t.standort as { einheit: string }).einheit));
    if (einheiten.size) h.push({ code: "menge_offen", text: `Für ${einheiten.size === 1 ? "1 Einheit" : `${einheiten.size} Einheiten`} fehlt die Anzahl ${HEIZ_NAME[art]}.`, schritt: 3 });
  }
  // Verbraucher ohne Gruppe, eine Zeile je Bauteilart
  const ohne = new Map<string, ZBauteil[]>();
  for (const art of HEIZ_ARTEN) for (const t of verbraucherDerArt(z, art)) if (!gruppeVonVerbraucher(z, t.schluessel)) {
    const name = t.katalogId === K.verteiler ? "FBH-Verteiler" : teilName(t.katalogId, katalog);
    ohne.set(name, [...(ohne.get(name) ?? []), t]);
  }
  for (const [name, teile] of ohne) h.push({ code: "ohne_gruppe", schritt: 5, schluessel: teile[0].schluessel,
    text: teile.length === 1 ? `${name === "FBH-Verteiler" ? `FBH-Verteiler ${einheitVon(z, teile[0])?.bezeichnung ?? ""}`.trim() : bauteilText(z, teile[0], katalog)} gehört zu keiner Gruppe.`
      : `${teile.length} ${name === "Heizkörper" || name === "FBH-Verteiler" ? name : `× ${name}`} gehören zu keiner Gruppe.` });
  // Heizart mit Verbrauchern, aber ohne (Regel-)Gruppe – nur wenn Gruppen schon existieren
  if (z.gruppen.length) for (const art of HEIZ_ARTEN)
    if (verbraucherDerArt(z, art).length && !z.gruppen.some((g) => g.regel?.heizart === art || g.verbraucher.some((v) => verbraucherDerArt(z, art).some((t) => t.schluessel === v))))
      h.push({ code: "gruppe_fehlt", text: `Für ${HEIZ_NAME[art]} gibt es noch keine Gruppe.`, schritt: 5 });
  for (const g of z.gruppen) if (g.verbraucher.length === 0)
    h.push({ code: "gruppe_leer", text: `Gruppe «${g.bezeichnung || g.nummer}» hat keine Verbraucher.`, schritt: 5, schluessel: g.schluessel });

  // Hinweise der Vorschau-Welt, die nicht schon oben stehen
  const eigene = new Set(h.map((x) => x.code));
  const schluesselVon = (bezug: string): string | undefined => {
    const m = /^neu-([ebg])-(\d+)$/.exec(bezug);
    if (m) return (m[1] === "e" ? positionen.einheiten : m[1] === "b" ? positionen.bauteile : positionen.gruppen)[Number(m[2])];
    return bezug;
  };
  for (const w of welt?.hinweise ?? []) {
    if (eigene.has(w.code) || INTERNE_HINWEISE.has(w.code)) continue;
    const s = schluesselVon(w.bezug);
    const symbol = welt?.symbole.find((x) => x.schluessel === w.bezug);
    const e = z.einheiten.find((x) => x.schluessel === s);
    const t = z.bauteile.find((x) => x.schluessel === (symbol ? schluesselVon(symbol.bauteilIds[0]) : s));
    const wo = e ? `«${e.bezeichnung}»` : t ? `«${bauteilText(z, t, katalog)}»` : "";
    const text = w.code === "ueberlappung" ? `${wo || "Eine Einheit"} überlappt mit einer manuell platzierten Einheit.`
      : w.code === "position_widerspruch" ? `${wo || "Ein Bauteil"} hat widersprüchliche manuelle Positionen.`
      : w.code === "ohne_gruppe" ? `${wo || "Eine Abgabe"} gehört zu keiner Gruppe.`
      : w.code === "gruppe_leer" ? "Eine Gruppe hat keine Verbraucher."
      : w.code === "seitenverhaeltnis" ? `${wo || "Eine Einheit"} wird sehr langgezogen. Prüfen Sie die Aufteilung der Einheiten im Geschoss.`
      : `Hinweis ${w.code}${wo ? ` zu ${wo}` : ""}.`;
    h.push({ code: w.code, text, schritt: e ? 2 : 5, ...(s && { schluessel: s }) });
  }
  return h;
}

const DREI_TEXT = { ja: "ja", nein: "nein", unbekannt: "weiss nicht" } as const;

/** Zeilen für «Prüfen» in Sätzen statt Zählern (H7). */
export function zusammenfassung(z: AssistentZustand, katalog?: readonly KatalogEintrag[] | null): { titel: string; text: string; schritt: SchrittNr }[] {
  const geschosse = new Set(z.einheiten.map((e) => e.geschoss)).size;
  const regel = z.vorlagen.filter((v) => v.geschosse.length).map((v) => `${v.geschosse.length === 1 ? "1 Geschoss" : `${v.geschosse.length} Geschosse`} wie «${v.name}»`);
  const einheiten = `${z.einheiten.length === 1 ? "1 Einheit" : `${z.einheiten.length} Einheiten`} in ${geschosse === 1 ? "1 Geschoss" : `${geschosse} Geschossen`}${regel.length ? `, ${regel.join(", ")}` : ""}.`;
  const heizung = HEIZ_ARTEN.map((a) => `${HEIZ_NAME[a]}: ${DREI_TEXT[z.heizungStandard[a]]}`).join(" · ");
  const ausnahmen = z.einheiten.filter((e) => Object.keys(e.ausnahme).length).length;
  const zentrale = [...erzeuger(z).map((t) => teilName(t.katalogId, katalog)), ...(z.bauteile.some((t) => t.katalogId === K.speicher) ? ["Speicher"] : [])].join(", ") || "noch nichts gewählt";
  const haupt = hauptverteiler(z);
  const gruppen = z.gruppen.filter((g) => g.verteiler === haupt?.schluessel).sort((a, b) => a.nummer - b.nummer)
    .map((g) => `${g.bezeichnung || `Gruppe ${g.nummer}`} (${g.verbraucher.length})`);
  const weitere = weitereTeile(z).length;
  return [
    { titel: "Einheiten", text: einheiten, schritt: 2 },
    { titel: "Heizung", text: heizung + (ausnahmen ? ` · ${ausnahmen === 1 ? "1 Einheit" : `${ausnahmen} Einheiten`} mit Ausnahme` : ""), schritt: 3 },
    { titel: "Hersteller", text: herstellerText(z), schritt: 3 },
    { titel: "Zentrale", text: zentrale, schritt: 4 },
    { titel: "Gruppen", text: gruppen.length ? gruppen.join(", ") : "noch keine", schritt: 5 },
    { titel: "FBH-Verteiler", text: fbhVerteilerText(z), schritt: 5 },
    { titel: "Wärmezähler", text: wmzText(z), schritt: 5 },
    { titel: "Weitere Teile", text: weitere ? (weitere === 1 ? "1 Teil" : `${weitere} Teile`) : "keine", schritt: 6 },
  ];
}

const gruppenName = (g: ZGruppe) => g.bezeichnung || `Gruppe ${g.nummer}`;
const aufzaehlen = (xs: readonly string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}`);

/** Hersteller/Typ am Gebäudestandard je Heizart, die der Standard vorsieht (H5). */
function herstellerText(z: AssistentZustand): string {
  const teile = HEIZ_ARTEN.filter((a) => z.heizungStandard[a] !== "nein").flatMap((a) => {
    const g = z.standardGeraet[a];
    const text = [g?.hersteller, g?.typ].filter(Boolean).join(" ");
    return text ? [`${HEIZ_NAME[a]}: ${text}`] : [];
  });
  return teile.length ? teile.join(" · ") : "keine Angabe";
}

/** «8: 7 an «A», 1 an «B»» plus FBH-Kreise ohne eigenen Verteiler (B13/B14). */
function fbhVerteilerText(z: AssistentZustand): string {
  const uv = unterverteiler(z);
  const versorgt = new Set(uv.flatMap((t) => t.versorgt));
  const ohne = [...new Set(z.bauteile.filter((t) => t.katalogId === K.fbh && "einheit" in t.standort && !versorgt.has(t.standort.einheit))
    .map((t) => einheitVon(z, t)?.bezeichnung).filter((b): b is string => !!b))];
  const ohneText = ohne.length ? `${ohne.length === 1 ? "1 FBH-Kreis" : `${ohne.length} FBH-Kreise`} ohne Verteiler (${aufzaehlen(ohne)})` : "";
  if (uv.length === 0) return ohneText || "keine";
  const speisung = fbhSpeisung(z).sort((a, b) => b.anzahl - a.anzahl);
  const ziel = (g: ZGruppe | null) => (g ? `an «${gruppenName(g)}»` : "ohne Gruppe");
  const satz = speisung.length === 1 ? `${uv.length}, ${ziel(speisung[0].gruppe)}` : `${uv.length}: ${speisung.map((s) => `${s.anzahl} ${ziel(s.gruppe)}`).join(", ")}`;
  return ohneText ? `${satz} · ${ohneText}` : satz;
}

/** Wärmezähler an Gruppen und an FBH-Verteilern, «keine» ohne (B13). */
function wmzText(z: AssistentZustand): string {
  const mitWmz = z.gruppen.filter((g) => zubehoerVon(z, g.schluessel).some((t) => t.katalogId === K.wmz)).sort((a, b) => a.nummer - b.nummer).map((g) => `«${gruppenName(g)}»`);
  const uv = unterverteiler(z);
  const anUv = uv.filter((v) => z.bauteile.some((t) => t.katalogId === K.wmz && t.ort && "vorBauteil" in t.ort && t.ort.vorBauteil === v.schluessel)).length;
  const teile = [
    ...(mitWmz.length ? [`an ${mitWmz.length === 1 ? "Gruppe" : `${mitWmz.length} Gruppen`} ${aufzaehlen(mitWmz)}`] : []),
    ...(anUv ? [anUv === uv.length ? `an ${anUv === 1 ? "dem FBH-Verteiler" : `allen ${anUv} FBH-Verteilern`}` : `an ${anUv} von ${uv.length} FBH-Verteilern`] : []),
  ];
  return teile.length ? teile.join(" · ") : "keine";
}
