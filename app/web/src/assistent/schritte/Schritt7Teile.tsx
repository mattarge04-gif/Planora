import { Plus, Trash2 } from "lucide-react";
import { K, ZUBEHOER, teilName } from "../bestueckung";
import { bauteilText } from "../hinweise";
import { vorKandidaten, weitereTeile } from "../zustand";
import { Hinweis, ICON } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

export function Schritt7Teile({ z, dispatch, katalog }: SchrittInhaltProps) {
  const teile = weitereTeile(z);
  const ziele = vorKandidaten(z);
  return <>
    <Hinweis>Pumpen, Ventile oder Wärmezähler, die nicht in einer Gruppe sitzen, z. B. eine Pumpe direkt vor der Wärmepumpe.</Hinweis>
    {teile.length > 0 && <ul className="as-zeilen as-liste-roh">
      {teile.map((t, i) => {
        const vor = t.ort && "vorBauteil" in t.ort ? t.ort.vorBauteil : "";
        return (
          <li key={t.schluessel} className="as-zeile as-zeile-teil">
            <select aria-label={`Teil ${i + 1}: Typ`} value={t.katalogId} onChange={(e) => dispatch({ typ: "teilAendern", schluessel: t.schluessel, katalogId: e.target.value })}>
              {ZUBEHOER.map((id) => <option key={id} value={id}>{teilName(id, katalog)}</option>)}
            </select>
            <span className="as-zahl">vor</span>
            <select aria-label={`Teil ${i + 1}: vor Bauteil`} value={vor} onChange={(e) => dispatch({ typ: "teilAendern", schluessel: t.schluessel, vor: e.target.value })}>
              {ziele.filter((x) => x.schluessel !== t.schluessel).map((x) => <option key={x.schluessel} value={x.schluessel}>{bauteilText(z, x, katalog)}</option>)}
            </select>
            <button type="button" className="as-rundknopf" aria-label={`Teil ${i + 1} entfernen`} onClick={() => dispatch({ typ: "bauteilLoeschen", schluessel: t.schluessel })}><Trash2 {...ICON} /></button>
          </li>
        );
      })}
    </ul>}
    {teile.length === 0 && <p className="as-leer">Keine weiteren Teile erfasst.</p>}
    <div>
      <button type="button" className="as-knopf as-knopf-klein" disabled={ziele.length === 0}
        onClick={() => ziele[0] && dispatch({ typ: "teilNeu", katalogId: K.pumpe, vor: ziele[0].schluessel })}>
        <Plus size={14} strokeWidth={1.75} aria-hidden />Teil an anderem Ort</button>
    </div>
    {ziele.length === 0 && <Hinweis>Lege zuerst einen Erzeuger oder Verteiler an (Schritt 4 oder 5).</Hinweis>}
  </>;
}
