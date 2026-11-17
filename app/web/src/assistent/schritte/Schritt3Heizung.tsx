import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Dreiwertig, HeizArt, Heizung } from "../../typen";
import { teilName } from "../bestueckung";
import {
  ABGABE_VON, ERLAUBT, FELDER_HEIZUNG, HEIZ_ARTEN, HEIZ_NAME, abgabenVon, abweichendIn, abweichungen, artName, einheitVon, platzWirksam, vorlageVonGeschoss, wirksam,
  EINHEIT_ARTEN, type Aktion, type ZBauteil, type ZEinheit, type ZVorlage,
} from "../zustand";
import { Abschnitt, Hinweis, ICON, Segment } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";
import { geschosseAbsteigend } from "./Schritt2Einheiten";

const DREI: readonly { wert: Dreiwertig; text: string }[] = [{ wert: "ja", text: "Ja" }, { wert: "nein", text: "Nein" }, { wert: "unbekannt", text: "Weiss nicht" }];
/** Kurzform für die Standard-Option, damit sie in drei Spalten nicht abgeschnitten wird. */
const STANDARD_TEXT: Record<Dreiwertig, string> = { ja: "Standard (Ja)", nein: "Standard (Nein)", unbekannt: "Standard (offen)" };
const KURZ = (art: string) => ({ buero: "Büro", wohnung: "Wohnung", gastro: "Gastro", allgemein: "Allgemein", technik: "Technik", kern: "Kern" } as Record<string, string>)[art] ?? art;

/** Gemeinsame Ausnahme aller Einheiten eines Geschosses: ein Wert, leer (= Standard) oder gemischt. */
export function geschossAusnahmeWert(einheiten: readonly ZEinheit[], art: HeizArt): Dreiwertig | "" | "gemischt" {
  const werte = new Set(einheiten.map((e) => e.ausnahme[art] ?? ""));
  if (werte.size === 0) return "";
  return werte.size === 1 ? ([...werte][0] as Dreiwertig | "") : "gemischt";
}

/** Auswahl Standard/Ja/Nein/Weiss nicht; abweichende Werte sind hervorgehoben. `name` ist der zugängliche Name, `label` der sichtbare. */
function AusnahmeWahl({ label, name, wert, standard, onWert, kurz }: {
  label?: string; name?: string; wert: Dreiwertig | "" | "gemischt"; standard: Dreiwertig; onWert: (w: Dreiwertig | null) => void; kurz?: boolean;
}) {
  return (
    <label className={`as-ausnahme${wert ? " as-ausnahme-gesetzt" : ""}`}>
      {label && <span>{label}</span>}
      <select value={wert} aria-label={name} onChange={(e) => e.target.value !== "gemischt" && onWert((e.target.value || null) as Dreiwertig | null)}>
        <option value="">{kurz ? "Standard" : STANDARD_TEXT[standard]}</option>
        {wert === "gemischt" && <option value="gemischt" disabled>Unterschiedlich</option>}
        {DREI.map((d) => <option key={d.wert} value={d.wert}>{d.text}</option>)}
      </select>
    </label>
  );
}

/** `name`: eindeutiger zugänglicher Name (z. B. «Büro 3.01: Heizkörper Anzahl»), `label` der kurze sichtbare Text. */
function Menge({ label, name, wert, onWert, inline, leer = "Weiss nicht" }: {
  label?: string; name?: string; wert: number | null; onWert: (n: number | null) => void; inline?: boolean; leer?: string;
}) {
  return (
    <label className={`as-ausnahme as-menge${inline ? " as-menge-inline" : ""}`}>
      {label && <span>{label}</span>}
      <input type="number" min={0} inputMode="numeric" placeholder={leer} value={wert ?? ""} aria-label={name}
        onChange={(e) => onWert(e.target.value === "" ? null : Number(e.target.value))} />
    </label>
  );
}

function AbgabeZeile({ t, z, dispatch, katalog }: { t: ZBauteil } & Pick<SchrittInhaltProps, "z" | "dispatch" | "katalog">) {
  const name = teilName(t.katalogId, katalog);
  const ort = einheitVon(z, t)?.bezeichnung;
  const voll = ort ? `${ort}: ${name}` : name;
  const art = HEIZ_ARTEN.find((a) => ABGABE_VON[a] === t.katalogId);
  const std = art ? z.standardGeraet[art] : undefined;
  const eigen = (t.hersteller ?? null) !== (std?.hersteller ?? null) || (t.typ ?? null) !== (std?.typ ?? null);
  return (
    <li className="as-zeile as-zeile-abgabe">
      <span className="as-badge as-badge-heizung">{name}</span>
      <Menge inline label="Anzahl" name={`${voll} Anzahl`} wert={t.menge} onWert={(n) => n === null ? dispatch({ typ: "abgabeWeissNicht", schluessel: t.schluessel }) : dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, menge: n })} />
      <button type="button" className="as-rundknopf" aria-label={`${voll} entfernen`} onClick={() => dispatch({ typ: "bauteilLoeschen", schluessel: t.schluessel })}><Trash2 {...ICON} /></button>
      <details className="as-aufklapp as-abgabe-geraet" open={eigen}>
        <summary>{eigen ? "Eigener Hersteller" : "Hersteller wie Standard"}</summary>
        <div className="as-reihe">
          <input type="text" aria-label={`${voll} Hersteller`} placeholder="Hersteller" value={t.hersteller ?? ""} maxLength={200}
            onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, hersteller: e.target.value })} />
          <input type="text" aria-label={`${voll} Typ`} placeholder="Typ" value={t.typ ?? ""} maxLength={200}
            onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, geraetTyp: e.target.value })} />
        </div>
      </details>
    </li>
  );
}

/** Heizung eines Geschosses als eine Auswahl (B2): Standard, nur HK, nur FBH, beides; alles andere ist «eigen» (Feineinstellung). */
export type HeizungWahl = "standard" | "hk" | "fbh" | "beide" | "eigen";
const WAHL_PAAR: Record<Exclude<HeizungWahl, "standard" | "eigen">, { hk: Dreiwertig; fbh: Dreiwertig }> = {
  hk: { hk: "ja", fbh: "nein" }, fbh: { hk: "nein", fbh: "ja" }, beide: { hk: "ja", fbh: "ja" },
};
const WAHL_TEXT: Record<Exclude<HeizungWahl, "standard">, string> = { hk: "Heizkörper", fbh: "Fussbodenheizung", beide: "Heizkörper und Fussbodenheizung", eigen: "Eigene Angaben (siehe «Einzeln»)" };

/** Kombination aus den Ausnahmen; gezählt werden nur Einheiten mit FBH-Möglichkeit (Kern hat nur Heizkörper). */
export function geschossHeizungWahl(einheiten: readonly ZEinheit[], standard: Heizung): HeizungWahl {
  const mitFbh = einheiten.filter((e) => (ERLAUBT[e.art] ?? []).includes(ABGABE_VON.fbh));
  const basis = mitFbh.length ? mitFbh : einheiten;
  if (basis.length === 0 || einheiten.every((e) => HEIZ_ARTEN.every((a) => e.ausnahme[a] === undefined))) return "standard";
  if (basis.some((e) => e.ausnahme.tabs !== undefined)) return "eigen";
  const paare = new Set(basis.map((e) => { const w = { ...standard, ...e.ausnahme }; return `${w.hk}/${w.fbh}`; }));
  if (paare.size !== 1) return "eigen";
  const paar = [...paare][0];
  const treffer = (Object.keys(WAHL_PAAR) as (keyof typeof WAHL_PAAR)[]).find((k) => `${WAHL_PAAR[k].hk}/${WAHL_PAAR[k].fbh}` === paar);
  return treffer ?? "eigen";
}

/** Aktionen zur Auswahl; «Ja» zuerst, damit keine Einheit zwischendurch ohne Heizung ist (Abgaben blieben sonst nicht erhalten). */
export function heizungWahlAktionen(geschoss: string, wahl: Exclude<HeizungWahl, "eigen">): Extract<Aktion, { typ: "geschossAusnahme" }>[] {
  // «Wie Standard» betrifft nur, was die Auswahl zeigt (Heizkörper, FBH); TABS bleibt eine Feineinstellung
  if (wahl === "standard") return (["hk", "fbh"] as const).map((art) => ({ typ: "geschossAusnahme", geschoss, art, wert: null }));
  const p = WAHL_PAAR[wahl];
  // N1: Heizkörper nur dort abwählen, wo FBH möglich ist – Kerne und Technik behalten ihre Heizkörper
  return (["hk", "fbh"] as const).map((art) => ({ typ: "geschossAusnahme" as const, geschoss, art, wert: p[art], ...(wahl === "fbh" && art === "hk" && { nurMit: "fbh" as const }) }))
    .sort((a, b) => (a.wert === "ja" ? 0 : 1) - (b.wert === "ja" ? 0 : 1));
}

/** Leise Zeile unter der Auswahl: Einheiten ohne FBH-Möglichkeit, die bei «Fussbodenheizung» ihre Heizkörper behalten (N1). */
export function wahlAusgenommen(einheiten: readonly ZEinheit[], wahl: HeizungWahl, standard: Heizung): string | null {
  if (wahl !== "fbh") return null;
  const namen = einheiten.filter((e) => e.art !== "technik" && !(ERLAUBT[e.art] ?? []).includes(ABGABE_VON.fbh) && { ...standard, ...e.ausnahme }.hk === "ja").map((e) => e.bezeichnung);
  if (namen.length === 0) return null;
  const liste = namen.length === 1 ? namen[0] : `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
  return `${liste} ${namen.length === 1 ? "behält" : "behalten"} Heizkörper.`;
}

/** «Heizkörper» oder «Heizkörper und FBH»: was der Standard tatsächlich vorsieht. */
function standardKurz(h: Heizung): string {
  const ja = HEIZ_ARTEN.filter((a) => h[a] === "ja").map((a) => (a === "fbh" ? "FBH" : HEIZ_NAME[a]));
  return ja.length ? ja.join(" und ") : "offen";
}

const SPALTE: Record<HeizArt, string> = { hk: "Heizkörper", fbh: "FBH", tabs: "TABS" };
const DREI_TEXT: Record<Dreiwertig, string> = { ja: "Ja", nein: "Nein", unbekannt: "offen" };
const anzahlText = (n: number, art: string) => {
  const a = EINHEIT_ARTEN.find((x) => x.art === art);
  return `${n} ${n === 1 ? (a?.name ?? art) : (a?.mehrzahl ?? art)}`;
};

/** Plätze des Regelgeschosses als kompakte Tabelle, standardmässig eingeklappt mit Kurzsatz (B2). */
function RegelTabelle({ v, z, dispatch }: { v: ZVorlage } & Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const spalten = HEIZ_ARTEN.filter((art) => v.plaetze.some((p) => (ERLAUBT[p.art] ?? []).includes(ABGABE_VON[art])));
  const arten = [...new Set(v.plaetze.map((p) => p.art))];
  const mitAusnahme = v.plaetze.filter((p) => Object.keys(p.ausnahme).length > 0 || Object.keys(p.mengen).length > 0).length;
  const satz = `${arten.map((a) => anzahlText(v.plaetze.filter((p) => p.art === a).length, a)).join(", ")} · ${mitAusnahme === 0 ? "Heizung wie Standard" : `${mitAusnahme} mit eigenen Angaben`}`;
  return (
    <details className="as-aufklapp as-regel-heizung">
      <summary>{satz}</summary>
      <table className="as-tabelle">
        <thead>
          <tr>
            <th scope="col">Platz</th>
            {spalten.map((art) => <th key={art} scope="col">{SPALTE[art]}<span className="as-tabelle-std">Standard {DREI_TEXT[z.heizungStandard[art]]}</span></th>)}
            <th scope="col" className="as-tabelle-zahl">Anzahl</th>
          </tr>
        </thead>
        <tbody>
          {v.plaetze.map((p, i) => {
            const w = platzWirksam(z, p);
            const erlaubt = ERLAUBT[p.art] ?? [];
            const titel = `${KURZ(p.art)} ${i + 1}`;
            const mengen = p.art === "technik" ? [] : HEIZ_ARTEN.filter((art) => w[art] === "ja" && erlaubt.includes(ABGABE_VON[art]));
            return (
              <tr key={p.schluessel}>
                <th scope="row">{titel}</th>
                {spalten.map((art) => <td key={art}>{erlaubt.includes(ABGABE_VON[art])
                  ? <AusnahmeWahl kurz name={`${v.name} ${titel}: ${HEIZ_NAME[art]}`} wert={p.ausnahme[art] ?? ""} standard={z.heizungStandard[art]}
                      onWert={(wert) => dispatch({ typ: "platzAusnahme", vorlage: v.schluessel, platz: p.schluessel, art, wert })} />
                  : <span className="as-gedimmt" aria-label="nicht möglich">–</span>}</td>)}
                <td className="as-tabelle-zahl"><div className="as-tabelle-mengen">
                  {mengen.length === 0 && <span className="as-gedimmt">–</span>}
                  {mengen.map((art) => <Menge key={art} leer="offen" inline={mengen.length > 1} label={mengen.length > 1 ? SPALTE[art] : undefined}
                    name={`${v.name} ${titel}: Anzahl ${HEIZ_NAME[art]}`} wert={p.mengen[art] ?? null}
                    onWert={(menge) => dispatch({ typ: "platzMenge", vorlage: v.schluessel, platz: p.schluessel, art, menge })} />)}
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

function EinheitHeizung({ e, z, dispatch, katalog }: { e: ZEinheit } & Pick<SchrittInhaltProps, "z" | "dispatch" | "katalog">) {
  const w = wirksam(z, e);
  const erlaubt = ERLAUBT[e.art] ?? [];
  const abgaben = abgabenVon(z, e.schluessel);
  const angebote = HEIZ_ARTEN.filter((art) => w[art] !== "nein" && erlaubt.includes(ABGABE_VON[art]));
  const abweichend = !!e.vorlage && abweichendIn(e, FELDER_HEIZUNG).length > 0;
  return (
    <section className="as-einheit-heizung" aria-label={e.bezeichnung}>
      <header className="as-karte-kopf">
        <h3>{e.bezeichnung}</h3><span className="as-zahl">{artName(e.art)}</span>
        {abweichend && <button type="button" className="as-rundknopf as-kopf-ende" aria-label={`Heizung von ${e.bezeichnung} auf Regelgeschoss zurücksetzen`}
          title="Heizung auf Regelgeschoss zurücksetzen" onClick={() => dispatch({ typ: "einheitZuruecksetzen", einheit: e.schluessel, felder: FELDER_HEIZUNG })}><RotateCcw {...ICON} /></button>}
      </header>
      <div className="as-ausnahmen">
        {HEIZ_ARTEN.filter((art) => erlaubt.includes(ABGABE_VON[art])).map((art) => (
          <AusnahmeWahl key={art} label={HEIZ_NAME[art]} name={`${e.bezeichnung}: ${HEIZ_NAME[art]}`} wert={e.ausnahme[art] ?? ""} standard={z.heizungStandard[art]}
            onWert={(wert) => dispatch({ typ: "ausnahme", einheit: e.schluessel, art, wert })} />
        ))}
      </div>
      {abgaben.length > 0 && <ul className="as-zeilen as-liste-roh">{abgaben.map((t) => <AbgabeZeile key={t.schluessel} t={t} z={z} dispatch={dispatch} katalog={katalog} />)}</ul>}
      {angebote.length > 0 && <div className="as-chips">
        {angebote.map((art) => (
          <button key={art} type="button" className="as-textknopf" onClick={() => dispatch({ typ: "abgabeNeu", einheit: e.schluessel, katalogId: ABGABE_VON[art] })}>
            <Plus size={14} strokeWidth={1.75} aria-hidden />{teilName(ABGABE_VON[art], katalog)}</button>
        ))}
      </div>}
    </section>
  );
}

/** Ein Geschoss in zwei Zeilen: Kopf mit Herkunft/Abweichung, darunter eine Auswahl «Heizung» und «Einzeln» (B2). */
function GeschossHeizung({ code, einheiten, z, dispatch, katalog }: { code: string; einheiten: ZEinheit[] } & Pick<SchrittInhaltProps, "z" | "dispatch" | "katalog">) {
  const [offen, setOffen] = useState(false);
  const v = vorlageVonGeschoss(z, code);
  const mitArt = (art: HeizArt) => einheiten.filter((e) => (ERLAUBT[e.art] ?? []).includes(ABGABE_VON[art]));
  const arten = HEIZ_ARTEN.filter((art) => mitArt(art).length > 0);
  const werte = arten.map((art) => geschossAusnahmeWert(mitArt(art), art));
  const wahl = geschossHeizungWahl(einheiten, z.heizungStandard);
  const fbhMoeglich = arten.includes("fbh");
  const ausgenommen = wahlAusgenommen(einheiten, wahl, z.heizungStandard);
  const ab = v ? abweichungen(z, v.schluessel, FELDER_HEIZUNG, code) : 0;
  const inhalt = `as-heizung-${code}`;
  return (
    <section className={`as-karte as-geschoss-heizung${v ? " as-karte-vorlage" : ""}`} aria-label={`Geschoss ${code}`}>
      <header className="as-karte-kopf as-kopf-umbruch">
        <span className="as-code">{code}</span>
        <span className="as-zahl">{einheiten.length === 1 ? "1 Einheit" : `${einheiten.length} Einheiten`}</span>
        {v && <span className="as-badge">{v.name}{ab > 0 && ` · ${ab} abweichend`}</span>}
        {!v && werte.some(Boolean) && <span className="as-badge as-badge-leise">Ausnahme</span>}
        {ab > 0 && <button type="button" className="as-textknopf as-kopf-ende" aria-label={`Heizung in ${code} auf Regelgeschoss zurücksetzen`}
          title="Heizung auf Regelgeschoss zurücksetzen" onClick={() => dispatch({ typ: "geschossZuruecksetzen", geschoss: code, felder: FELDER_HEIZUNG })}>
          <RotateCcw size={14} strokeWidth={1.75} aria-hidden />Zurücksetzen</button>}
      </header>
      <div className="as-geschoss-zeile">
        {fbhMoeglich
          ? <label className={`as-ausnahme as-ausnahme-quer${wahl !== "standard" ? " as-ausnahme-gesetzt" : ""}`}>
              <span>Heizung</span>
              <select value={wahl} aria-label={`Heizung im ganzen Geschoss ${code}`}
                onChange={(ev) => { const w = ev.target.value as HeizungWahl; if (w !== "eigen") for (const a of heizungWahlAktionen(code, w)) dispatch(a); }}>
                <option value="standard">Wie Standard ({standardKurz(z.heizungStandard)})</option>
                {(["hk", "fbh", "beide"] as const).map((k) => <option key={k} value={k}>{WAHL_TEXT[k]}</option>)}
                {wahl === "eigen" && <option value="eigen" disabled>{WAHL_TEXT.eigen}</option>}
              </select>
            </label>
          : <span className="as-zahl">Nur Heizkörper möglich</span>}
        <button type="button" className="as-textknopf as-einzeln" aria-expanded={offen} aria-controls={inhalt}
          aria-label={`Heizung in ${code} einzeln einstellen`} onClick={() => setOffen(!offen)}>
          Einzeln<ChevronDown size={14} strokeWidth={1.75} aria-hidden /></button>
      </div>
      {ausgenommen && <p className="as-hilfe as-geschoss-hinweis">{ausgenommen}</p>}
      {offen && <div id={inhalt} className="as-aufklapp-inhalt as-einheiten-heizung">
        <span className="as-label as-untertitel" id={`${inhalt}-alle`}>Ganzes Geschoss, je Heizart</span>
        <div className="as-ausnahmen" role="group" aria-labelledby={`${inhalt}-alle`}>
          {arten.map((art, i) => <AusnahmeWahl key={art} label={HEIZ_NAME[art]} name={`${HEIZ_NAME[art]} im ganzen Geschoss ${code}`} wert={werte[i]}
            standard={z.heizungStandard[art]} onWert={(wert) => dispatch({ typ: "geschossAusnahme", geschoss: code, art, wert })} />)}
        </div>
        {einheiten.map((e) => <EinheitHeizung key={e.schluessel} e={e} z={z} dispatch={dispatch} katalog={katalog} />)}
      </div>}
    </section>
  );
}

export function Schritt3Heizung({ z, dispatch, katalog }: SchrittInhaltProps) {
  return <>
    <Abschnitt titel="Gebäudestandard" zusatz="Gilt für alle Einheiten, ausser bei Ausnahmen.">
      <div className="as-raster-standard">
        {HEIZ_ARTEN.map((art) => {
          const g = z.standardGeraet[art];
          return (
            <div key={art} className="as-standard-zeile">
              <span className="as-label">{HEIZ_NAME[art]}</span>
              <Segment name={`as-standard-${art}`} label={HEIZ_NAME[art]} wert={z.heizungStandard[art]} optionen={DREI} onWert={(wert) => dispatch({ typ: "standard", art, wert })} />
              {z.heizungStandard[art] !== "nein" && <details className="as-aufklapp as-standard-geraet">
                <summary>{g?.hersteller || g?.typ ? [g.hersteller, g.typ].filter(Boolean).join(" · ") : "Hersteller und Typ (optional)"}</summary>
                <div className="as-reihe">
                  <label className="as-feld"><span className="as-label">Hersteller</span>
                    <input type="text" aria-label={`${HEIZ_NAME[art]}: Hersteller`} value={g?.hersteller ?? ""} maxLength={200} onChange={(e) => dispatch({ typ: "standardGeraet", art, hersteller: e.target.value })} /></label>
                  <label className="as-feld"><span className="as-label">Typ</span>
                    <input type="text" aria-label={`${HEIZ_NAME[art]}: Typ`} value={g?.typ ?? ""} maxLength={200} onChange={(e) => dispatch({ typ: "standardGeraet", art, geraetTyp: e.target.value })} /></label>
                </div>
              </details>}
            </div>
          );
        })}
      </div>
    </Abschnitt>
    {z.einheiten.length === 0 && <Hinweis art="warnung">Noch keine Einheiten erfasst. Lege sie in Schritt 2 an.</Hinweis>}
    {z.vorlagen.filter((v) => v.plaetze.length).map((v) => (
      <Abschnitt key={v.schluessel} titel={v.name} zusatz={v.geschosse.length ? `gilt für ${[...v.geschosse].join(", ")}` : "keinem Geschoss zugewiesen"}>
        <RegelTabelle v={v} z={z} dispatch={dispatch} />
      </Abschnitt>
    ))}
    <Abschnitt titel="Geschosse und Einheiten" zusatz="Die Auswahl gilt für alle Einheiten im Geschoss.">
      {geschosseAbsteigend(z).map((g) => {
        const einheiten = z.einheiten.filter((e) => e.geschoss === g.code);
        return einheiten.length === 0 ? null : <GeschossHeizung key={g.code} code={g.code} einheiten={einheiten} z={z} dispatch={dispatch} katalog={katalog} />;
      })}
    </Abschnitt>
  </>;
}
