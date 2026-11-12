import type { RefObject } from "react";
import { panelDaten } from "../panel/daten";
import type { Beschreibung, KatalogEintrag, Welt } from "../typen";

interface Props {
  karteRef: RefObject<HTMLDivElement | null>; welt: Welt; beschreibung: Beschreibung; katalog: KatalogEintrag[];
  auswahl: string | null; onSchliessen: () => void;
}

/** Position setzt Welt3D (Anker) per transform; hier nur Inhalt. */
export function BauteilKarte({ karteRef, welt, beschreibung, katalog, auswahl, onSchliessen }: Props) {
  const d = auswahl ? panelDaten(welt, beschreibung, katalog, auswahl) : null;
  return (
    <div ref={karteRef} className="glas bauteilkarte" role="dialog" aria-label="Bauteil" hidden={!d}>
      {d && (
        <>
          <button className="schliessen" aria-label="Schliessen" onClick={onSchliessen}>×</button>
          <p className="ueberzeile">{d.standort}</p>
          <h2>{d.titel}</h2>
          {d.herstellerTyp && <p>{d.herstellerTyp}</p>}
          <p><span className={d.status === "vorgeschlagen" ? "marke vorschlag" : "marke"}>{d.status === "vorgeschlagen" ? "vorgeschlagen" : "bestaetigt"}</span> Menge: {d.menge}</p>
          {d.versorgt.length > 0 && <><h3>Versorgt</h3><ul>{d.versorgt.map((v) => <li key={v}>{v}</li>)}</ul></>}
          <p className="leise">Position schematisch</p>
        </>
      )}
    </div>
  );
}
