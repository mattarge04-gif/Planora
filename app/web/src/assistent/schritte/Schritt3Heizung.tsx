import { Plus, Trash2 } from "lucide-react";
import type { Dreiwertig, HeizArt } from "../../typen";
import { teilName } from "../bestueckung";
import { ABGABE_VON, ERLAUBT, HEIZ_ARTEN, HEIZ_NAME, abgabenVon, artName, platzWirksam, vorlageVonGeschoss, wirksam, type ZBauteil, type ZEinheit } from "../zustand";
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
function AusnahmeWahl({ label, name, wert, standard, onWert }: { label: string; name?: string; wert: Dreiwertig | "" | "gemischt"; standard: Dreiwertig; onWert: (w: Dreiwertig | null) => void }) {
  return (
    <label className={`as-ausnahme${wert ? " as-ausnahme-gesetzt" : ""}`}>
      <span>{label}</span>
      <select value={wert} aria-label={name} onChange={(e) => e.target.value !== "gemischt" && onWert((e.target.value || null) as Dreiwertig | null)}>
        <option value="">{STANDARD_TEXT[standard]}</option>
        {wert === "gemischt" && <option value="gemischt" disabled>Unterschiedlich</option>}
        {DREI.map((d) => <option key={d.wert} value={d.wert}>{d.text}</option>)}
      </select>
    </label>
  );
}

function Menge({ label, wert, onWert, inline }: { label: string; wert: number | null; onWert: (n: number | null) => void; inline?: boolean }) {
  return (
    <label className={`as-ausnahme as-menge${inline ? " as-menge-inline" : ""}`}>
      <span>{label}</span>
      <input type="number" min={0} inputMode="numeric" placeholder="Weiss nicht" value={wert ?? ""}
        onChange={(e) => onWert(e.target.value === "" ? null : Number(e.target.value))} />
    </label>
  );
}

function AbgabeZeile({ t, z, dispatch, katalog }: { t: ZBauteil } & Pick<SchrittInhaltProps, "z" | "dispatch" | "katalog">) {
  const name = teilName(t.katalogId, katalog);
  const art = HEIZ_ARTEN.find((a) => ABGABE_VON[a] === t.katalogId);
  const std = art ? z.standardGeraet[art] : undefined;
  const eigen = (t.hersteller ?? null) !== (std?.hersteller ?? null) || (t.typ ?? null) !== (std?.typ ?? null);
  return (
    <li className="as-zeile as-zeile-abgabe">
      <span className="as-badge as-badge-heizung">{name}</span>
      <Menge inline label="Anzahl" wert={t.menge} onWert={(n) => n === null ? dispatch({ typ: "abgabeWeissNicht", schluessel: t.schluessel }) : dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, menge: n })} />
      <button type="button" className="as-rundknopf" aria-label={`${name} entfernen`} onClick={() => dispatch({ typ: "bauteilLoeschen", schluessel: t.schluessel })}><Trash2 {...ICON} /></button>
      <details className="as-aufklapp as-abgabe-geraet" open={eigen}>
        <summary>{eigen ? "Eigener Hersteller" : "Hersteller wie Standard"}</summary>
        <div className="as-reihe">
          <input type="text" aria-label={`${name}: Hersteller`} placeholder="Hersteller" value={t.hersteller ?? ""} maxLength={200}
            onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, hersteller: e.target.value })} />
          <input type="text" aria-label={`${name}: Typ`} placeholder="Typ" value={t.typ ?? ""} maxLength={200}
            onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, geraetTyp: e.target.value })} />
        </div>
      </details>
    </li>
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
                    <input type="text" value={g?.hersteller ?? ""} maxLength={200} onChange={(e) => dispatch({ typ: "standardGeraet", art, hersteller: e.target.value })} /></label>
                  <label className="as-feld"><span className="as-label">Typ</span>
                    <input type="text" value={g?.typ ?? ""} maxLength={200} onChange={(e) => dispatch({ typ: "standardGeraet", art, geraetTyp: e.target.value })} /></label>
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
        <ul className="as-zeilen as-liste-roh">
          {v.plaetze.map((p, i) => {
            const w = platzWirksam(z, p);
            const erlaubt = ERLAUBT[p.art] ?? [];
            const titel = `${KURZ(p.art)} ${i + 1}`;
            return (
              <li key={p.schluessel} className="as-karte as-platz">
                <header className="as-karte-kopf"><h3>{titel}</h3><span className="as-zahl">{artName(p.art)}</span></header>
                <div className="as-ausnahmen">
                  {HEIZ_ARTEN.filter((art) => erlaubt.includes(ABGABE_VON[art])).map((art) => (
                    <AusnahmeWahl key={art} label={HEIZ_NAME[art]} name={`${titel}: ${HEIZ_NAME[art]}`} wert={p.ausnahme[art] ?? ""} standard={z.heizungStandard[art]}
                      onWert={(wert) => dispatch({ typ: "platzAusnahme", vorlage: v.schluessel, platz: p.schluessel, art, wert })} />
                  ))}
                  {p.art !== "technik" && HEIZ_ARTEN.filter((art) => w[art] === "ja" && erlaubt.includes(ABGABE_VON[art])).map((art) => (
                    <Menge key={`m-${art}`} label={`Anzahl ${HEIZ_NAME[art]}`} wert={p.mengen[art] ?? null}
                      onWert={(menge) => dispatch({ typ: "platzMenge", vorlage: v.schluessel, platz: p.schluessel, art, menge })} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Abschnitt>
    ))}
    <Abschnitt titel="Geschosse und Einheiten" zusatz="Ausnahmen gelten für alle Einheiten im Geschoss.">
      {geschosseAbsteigend(z).map((g) => {
        const einheiten = z.einheiten.filter((e) => e.geschoss === g.code);
        if (einheiten.length === 0) return null;
        const v = vorlageVonGeschoss(z, g.code);
        // Nur Einheiten, in denen die Heizart erlaubt ist (z. B. Kern nur Heizkörper), sonst stünde FBH im EG immer auf «Unterschiedlich».
        const mitArt = (art: HeizArt) => einheiten.filter((e) => (ERLAUBT[e.art] ?? []).includes(ABGABE_VON[art]));
        const arten = HEIZ_ARTEN.filter((art) => mitArt(art).length > 0);
        const werte = arten.map((art) => geschossAusnahmeWert(mitArt(art), art));
        return (
          <section key={g.code} className={`as-karte${v ? " as-karte-vorlage" : ""}`} aria-label={`Geschoss ${g.code}`}>
            <header className="as-karte-kopf">
              <span className="as-code">{g.code}</span>
              <span className="as-zahl">{einheiten.length === 1 ? "1 Einheit" : `${einheiten.length} Einheiten`}</span>
              {v && <span className="as-badge">wie {v.name}</span>}
              {werte.some(Boolean) && <span className="as-badge as-badge-leise">Ausnahme</span>}
            </header>
            <div className="as-ausnahmen" role="group" aria-label={`Ausnahme für alle Einheiten in ${g.code}`}>
              {arten.map((art, i) => <AusnahmeWahl key={art} label={HEIZ_NAME[art]} name={`${HEIZ_NAME[art]} im ganzen Geschoss ${g.code}`} wert={werte[i]}
                standard={z.heizungStandard[art]} onWert={(wert) => dispatch({ typ: "geschossAusnahme", geschoss: g.code, art, wert })} />)}
            </div>
            <details className="as-aufklapp" open={!v && einheiten.length <= 3}>
              <summary>{einheiten.length === 1 ? "1 Einheit" : `${einheiten.length} Einheiten`} einzeln</summary>
              <div className="as-aufklapp-inhalt as-einheiten-heizung">
                {einheiten.map((e) => {
                  const w = wirksam(z, e);
                  const erlaubt = ERLAUBT[e.art] ?? [];
                  const abgaben = abgabenVon(z, e.schluessel);
                  const angebote = HEIZ_ARTEN.filter((art) => w[art] !== "nein" && erlaubt.includes(ABGABE_VON[art]));
                  return (
                    <section key={e.schluessel} className="as-einheit-heizung" aria-label={e.bezeichnung}>
                      <header className="as-karte-kopf"><h3>{e.bezeichnung}</h3><span className="as-zahl">{artName(e.art)}</span></header>
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
                })}
              </div>
            </details>
          </section>
        );
      })}
    </Abschnitt>
  </>;
}
