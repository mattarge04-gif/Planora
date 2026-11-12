import { REGELWERK_V2 } from "./regelwerk.v2.js";
import type { GruppenArt, Heizung, Beschreibung, BauteilEingabe, EinheitEingabe, GruppeEingabe, Huelle, HuelleGespeichert } from "./typen.js";
import { geschossRang } from "./regelwerk.js";

/** Mustergebaeude der Stufe 1 (Spec §8): Testgrundlage fuer Generator, Assistent und Leitungen; Entwicklungsdaten. */
export interface Muster {
  schluessel: string; name: string; huelle: Huelle;
  beschreibung: (geschossIds: string[]) => Omit<Beschreibung, "gebaeudeId" | "stand">;
}

type Rest = Omit<Beschreibung, "gebaeudeId" | "stand">;
const HK = "heizung.heizkoerper", FBH = "heizung.fbh_kreis", TABS = "heizung.tabs_feld", WP = "heizung.waermepumpe";
const SPEICHER = "heizung.speicher", VERTEILER = "heizung.verteiler", PUMPE = "heizung.umwaelzpumpe";
const V3 = "heizung.ventil_3weg", V2 = "heizung.ventil_2weg", WMZ = "heizung.wmz";

/** Kleiner Baukasten: gibt Indizes zurueck, damit die Muster ohne handgezaehlte Verweise auskommen. */
class Bau {
  readonly einheiten: EinheitEingabe[] = [];
  readonly bauteile: BauteilEingabe[] = [];
  readonly gruppen: GruppeEingabe[] = [];
  constructor(private readonly geschossIds: string[], private readonly standard: Heizung) {}

  einheit(geschoss: number, bezeichnung: string, art: string, heizungAusnahme?: Partial<Heizung>): number {
    this.einheiten.push({ geschossId: this.geschossIds[geschoss], bezeichnung, art, flaecheM2: null, ...(heizungAusnahme ? { heizungAusnahme } : {}) });
    return this.einheiten.length - 1;
  }
  bauteil(katalogId: string, einheit: number, menge: number | null, extra: Partial<BauteilEingabe> = {}): number {
    this.bauteile.push({ katalogId, standort: { einheitIndex: einheit }, menge, status: "bestaetigt", versorgt: [], ...extra });
    return this.bauteile.length - 1;
  }
  versorgt(verteiler: number, einheiten: number[]): void {
    this.bauteile[verteiler].versorgt = einheiten.map((einheitIndex) => ({ einheitIndex }));
  }
  /** Gruppe am Verteiler; Zubehoer nach Regelwerk-Bestueckung als "vorgeschlagen" (ausser `ohneZubehoer`). */
  gruppe(verteiler: number, art: GruppenArt, bezeichnung: string, verbraucher: number[], ohneZubehoer = false): number {
    const nummer = this.gruppen.filter((g) => g.verteiler.bauteilIndex === verteiler).length + 1;
    this.gruppen.push({ verteiler: { bauteilIndex: verteiler }, nummer, art, bezeichnung, verbraucher: verbraucher.map((bauteilIndex) => ({ bauteilIndex })) });
    const gruppeIndex = this.gruppen.length - 1;
    if (!ohneZubehoer)
      for (const z of REGELWERK_V2.bestueckung[art])
        this.zubehoer(verteiler, gruppeIndex, z.katalogId, z.menge, "vorgeschlagen");
    return gruppeIndex;
  }
  zubehoer(verteiler: number, gruppe: number, katalogId: string, menge: number, status: "vorgeschlagen" | "bestaetigt" = "bestaetigt"): number {
    return this.bauteil(katalogId, this.bauteile[verteiler].standort.einheitIndex!, menge, { status, ort: { gruppe: { gruppeIndex: gruppe } } });
  }
  fertig(): Rest {
    return { heizungStandard: this.standard, einheiten: this.einheiten, bauteile: this.bauteile, gruppen: this.gruppen };
  }
}

const HK_STANDARD: Heizung = { hk: "ja", fbh: "nein", tabs: "nein" };
const FBH_STANDARD: Heizung = { hk: "nein", fbh: "ja", tabs: "nein" };

const m1: Muster = {
  schluessel: "m1-ein-raum", name: "Muster 1 Ein Raum",
  huelle: { name: "Muster 1 Ein Raum", grundform: "quader", geschosse: [{ code: "EG" }] },
  beschreibung: (g) => {
    const b = new Bau(g, HK_STANDARD);
    const buero = b.einheit(0, "Buero", "buero");
    const technik = b.einheit(0, "Technik", "technik");
    const hk = b.bauteil(HK, buero, 4, { hersteller: "Zehnder" });
    b.bauteil(WP, technik, 1);
    const v = b.bauteil(VERTEILER, technik, 1);
    b.versorgt(v, [buero]);
    b.gruppe(v, "ungeregelt", "Heizkoerper Buero", [hk]);
    return b.fertig();
  },
};

/** Gemeinsame Anlage von m2 und m3: Beispielgebaeude mit EG/OG1 (Spec §8). */
function beispielBau(g: string[]) {
  const b = new Bau(g, HK_STANDARD);
  const e = {
    bueroA: b.einheit(0, "Buero A", "buero"),
    restaurant: b.einheit(0, "Restaurant", "gastro", { hk: "nein", fbh: "ja" }),
    technik: b.einheit(0, "Technik", "technik"),
    bueroC: b.einheit(1, "Buero C", "buero", { fbh: "ja" }),
    bueroD: b.einheit(1, "Buero D", "buero", { fbh: "ja" }),
  };
  b.bauteil(WP, e.technik, 1);
  b.bauteil(SPEICHER, e.technik, 1);
  const hkZ = b.bauteil(HK, e.bueroA, 12, { hersteller: "Zehnder" });
  const hkP = b.bauteil(HK, e.bueroA, 3, { hersteller: "Prolux" });
  const fbhR = b.bauteil(FBH, e.restaurant, 6);
  const fbhC = b.bauteil(FBH, e.bueroC, 4);
  const fbhD = b.bauteil(FBH, e.bueroD, null);
  const v = b.bauteil(VERTEILER, e.technik, 1);
  b.versorgt(v, [e.bueroA, e.restaurant, e.bueroC, e.bueroD]);
  return { b, v, hkZ, hkP, fbhR, fbhC, fbhD };
}

const m2: Muster = {
  schluessel: "m2-beispiel", name: "Muster 2 Beispiel",
  huelle: { name: "Muster 2 Beispiel", grundform: "quader", geschosse: [{ code: "EG" }, { code: "OG1" }] },
  beschreibung: (g) => {
    const { b, v, hkZ, hkP, fbhR, fbhC, fbhD } = beispielBau(g);
    b.gruppe(v, "ungeregelt", "HK Buero", [hkZ, hkP]);
    b.gruppe(v, "beimisch", "FBH", [fbhR, fbhC, fbhD]);
    return b.fertig();
  },
};

const m3: Muster = {
  schluessel: "m3-zubehoer", name: "Muster 3 Zubehoer",
  huelle: { name: "Muster 3 Zubehoer", grundform: "quader", geschosse: [{ code: "EG" }, { code: "OG1" }] },
  beschreibung: (g) => {
    const { b, v, hkZ, hkP, fbhR, fbhC, fbhD } = beispielBau(g);
    b.gruppe(v, "ungeregelt", "HK Buero", [hkZ, hkP], true); // bewusst ohne Zubehoer
    const g2 = b.gruppe(v, "einspritz", "FBH", [fbhR, fbhC, fbhD], true);
    // 2 Pumpen und 3 Ventile, gemischt: Bestueckung (Pumpe + 2-Weg) vorgeschlagen, Rest vom Kunden bestaetigt
    b.zubehoer(v, g2, PUMPE, 1, "vorgeschlagen");
    b.zubehoer(v, g2, V2, 1, "vorgeschlagen");
    b.zubehoer(v, g2, PUMPE, 1);
    b.zubehoer(v, g2, V3, 1);
    b.zubehoer(v, g2, V2, 1);
    return b.fertig();
  },
};

const m4: Muster = {
  schluessel: "m4-pumpe-vor-wp", name: "Muster 4 Pumpe vor WP",
  huelle: { name: "Muster 4 Pumpe vor WP", grundform: "quader", geschosse: [{ code: "EG" }] },
  beschreibung: (g) => {
    const b = new Bau(g, HK_STANDARD);
    const buero = b.einheit(0, "Buero", "buero");
    const technik = b.einheit(0, "Technik", "technik");
    const hk = b.bauteil(HK, buero, 6);
    const wp = b.bauteil(WP, technik, 1);
    b.bauteil(PUMPE, technik, 1, { ort: { vorBauteil: { bauteilIndex: wp } } }); // Primaerpumpe direkt vor der WP
    const v = b.bauteil(VERTEILER, technik, 1);
    b.versorgt(v, [buero]);
    b.gruppe(v, "ungeregelt", "Heizkoerper Buero", [hk]);
    return b.fertig();
  },
};

const m5: Muster = {
  schluessel: "m5-fbh-ueber-geschosse", name: "Muster 5 FBH ueber Geschosse",
  huelle: { name: "Muster 5 FBH ueber Geschosse", grundform: "quader", geschosse: [{ code: "EG" }, { code: "OG1" }, { code: "OG2" }] },
  beschreibung: (g) => {
    const b = new Bau(g, FBH_STANDARD);
    const technik = b.einheit(0, "Technik", "technik");
    const technikOg = b.einheit(1, "Technik OG1", "technik");
    const w1 = b.einheit(1, "Wohnung 1", "wohnung");
    const w2 = b.einheit(1, "Wohnung 2", "wohnung");
    const w3 = b.einheit(2, "Wohnung 3", "wohnung");
    const w4 = b.einheit(2, "Wohnung 4", "wohnung");
    b.bauteil(WP, technik, 1);
    const haupt = b.bauteil(VERTEILER, technik, 1);
    const unter = b.bauteil(VERTEILER, technikOg, 1); // Unterverteiler im OG1, Verbraucher der Gruppe 1 im EG
    b.versorgt(haupt, [technikOg]);
    b.versorgt(unter, [w1, w2, w3, w4]);
    for (const w of [w1, w2, w3, w4]) b.bauteil(FBH, w, 3);
    const g1 = b.gruppe(haupt, "ungeregelt", "Steigstrang FBH", [unter]);
    b.zubehoer(haupt, g1, WMZ, 1);
    return b.fertig();
  },
};

/** m6 und m6u: gleicher Inhalt, andere Grundform. */
function m6Inhalt(g: string[]): Rest {
  const b = new Bau(g, { hk: "ja", fbh: "nein", tabs: "nein" });
  const technik = b.einheit(0, "Technikzentrale", "technik");
  const kern = b.einheit(1, "Kern", "kern");
  const bueroA = b.einheit(1, "Buero A", "buero");
  const gastro = b.einheit(1, "Gastro", "gastro", { fbh: "ja" });
  const bueroB = b.einheit(2, "Buero B", "buero", { tabs: "ja" });
  const wohnung = b.einheit(2, "Wohnung", "wohnung", { hk: "nein", fbh: "ja" });
  b.bauteil(WP, technik, 1);
  b.bauteil(SPEICHER, technik, 1);
  const v = b.bauteil(VERTEILER, technik, 1);
  b.versorgt(v, [kern, bueroA, gastro, bueroB, wohnung]);
  const hkA = b.bauteil(HK, bueroA, 8);
  const fbhG = b.bauteil(FBH, gastro, 5);
  const hkG = b.bauteil(HK, gastro, 4);
  const tabsB = b.bauteil(TABS, bueroB, 2);
  const fbhW = b.bauteil(FBH, wohnung, 4);
  const hkK = b.bauteil(HK, kern, 2);
  b.gruppe(v, "ungeregelt", "HK Buero A", [hkA]);
  b.gruppe(v, "beimisch", "FBH Gastro", [fbhG]);
  b.gruppe(v, "drossel", "FBH Wohnung", [fbhW]);
  b.gruppe(v, "einspritz", "TABS Buero B", [tabsB]);
  b.gruppe(v, "umlenk", "HK Gastro", [hkG]);
  b.gruppe(v, "ungeregelt", "HK Kern", [hkK]);
  return b.fertig();
}
const GESCHOSSE_M6 = [{ code: "UG1" }, { code: "EG" }, { code: "OG1" }];

const m6: Muster = {
  schluessel: "m6-l-u-viele-gruppen", name: "Muster 6 L-Form viele Gruppen",
  huelle: { name: "Muster 6 L-Form viele Gruppen", grundform: "l_form", geschosse: GESCHOSSE_M6 },
  beschreibung: m6Inhalt,
};
export const MUSTER_M6U: Muster = {
  schluessel: "m6u-u-viele-gruppen", name: "Muster 6u U-Form viele Gruppen",
  huelle: { name: "Muster 6u U-Form viele Gruppen", grundform: "u_form", geschosse: GESCHOSSE_M6 },
  beschreibung: m6Inhalt,
};

/** Genau sechs, Reihenfolge nach Spec §8. */
export const MUSTER: Muster[] = [m1, m2, m3, m4, m5, m6];
/** Mit Variante m6u: Grundlage fuer Fixtures und Entwicklungsdaten. */
export const ALLE_MUSTER: Muster[] = [...MUSTER, MUSTER_M6U];

// --- Deterministische Eingabe fuer den Generator (ohne Datenbank) ---
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const MUSTER_GEBAEUDE_ID = uuid(900);
export const MUSTER_LIEGENSCHAFT_ID = uuid(901);

/** Geschoss-IDs 00000000-0000-4000-8000-0000000000NN (NN ab 01, in Rangfolge der Huelle). */
export function musterGeschossIds(m: Muster): string[] {
  return [...m.huelle.geschosse].sort((a, b) => geschossRang(a.code)! - geschossRang(b.code)!).map((_, i) => uuid(i + 1));
}

/** Gespeicherte Huelle und Beschreibung mit festen IDs (Einheiten 100+, Bauteile 200+, Gruppen 300+), wie sie der Generator erwartet. */
export function musterGeneratorEingabe(m: Muster): { huelle: HuelleGespeichert; beschreibung: Beschreibung } {
  const geschossIds = musterGeschossIds(m);
  const huelle: HuelleGespeichert = {
    gebaeudeId: MUSTER_GEBAEUDE_ID, liegenschaftId: MUSTER_LIEGENSCHAFT_ID, name: m.huelle.name, grundform: m.huelle.grundform,
    breiteM: null, tiefeM: null, regelwerkVersion: 2, stand: 0,
    geschosse: m.huelle.geschosse.map((g, i) => ({ id: geschossIds[i], code: g.code, hoeheM: g.hoeheM ?? REGELWERK_V2.geschoss.hoeheDefault })),
  };
  const r = m.beschreibung(geschossIds);
  const eId = (i: number) => uuid(100 + i), tId = (i: number) => uuid(200 + i), gId = (i: number) => uuid(300 + i);
  const beschreibung: Beschreibung = {
    gebaeudeId: MUSTER_GEBAEUDE_ID, stand: 0, heizungStandard: r.heizungStandard,
    einheiten: r.einheiten.map((e, i) => ({ ...e, id: eId(i) })),
    bauteile: r.bauteile.map((t, i) => ({
      ...t, id: tId(i),
      standort: { einheitId: eId(t.standort.einheitIndex!) },
      versorgt: t.versorgt.map((v) => ({ einheitId: eId(v.einheitIndex!) })),
      ...(t.ort ? { ort: "gruppe" in t.ort ? { gruppe: { gruppeId: gId(t.ort.gruppe.gruppeIndex!) } } : { vorBauteil: { bauteilId: tId(t.ort.vorBauteil.bauteilIndex!) } } } : {}),
    })),
    gruppen: (r.gruppen ?? []).map((g, i) => ({
      ...g, id: gId(i), verteiler: { bauteilId: tId(g.verteiler.bauteilIndex!) },
      verbraucher: g.verbraucher.map((v) => ({ bauteilId: tId(v.bauteilIndex!) })),
    })),
  };
  return { huelle, beschreibung };
}
