import { Bell, Building2, Check, ChevronDown, LogOut, PanelsTopLeft, PenLine, UserRound, LayoutList } from "lucide-react";
import type { GebaeudeEintrag } from "../typen";
import { Menue } from "./Menue";
import "./ui.css";

export type Modus = "uebersicht" | "technik";

interface Props {
  modus: Modus;
  onModus: (m: Modus) => void;
  modusAktiv: boolean;
  gebaeudeId: string;
  gebaeudeName: string;
  gebaeude: GebaeudeEintrag[] | null;
  onGebaeude: (g: GebaeudeEintrag) => void;
  hinweise: number | null;
  onHinweise: () => void;
  reduziert: boolean;
  onReduziert: (r: boolean) => void;
  onListe: () => void;
  onAnsicht: () => void;
  onEntwurf: () => void;
  onAbmelden: () => void;
}

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Bildmarke: drei gestapelte Geschossplatten in Isometrie, die oberste aufgeschnitten. */
export function Marke() {
  return (
    <svg className="ui-marke-bild" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" className="ui-marke-grund" />
      <path d="M14 18.6 6.5 14.9v1.6L14 20.2l7.5-3.7v-1.6z" className="ui-marke-platte3" />
      <path d="M14 15.1 6.5 11.4V13L14 16.7 21.5 13v-1.6z" className="ui-marke-platte2" />
      <path d="M14 7.8 6.5 11.4 14 15.1l7.5-3.7z" className="ui-marke-platte1" />
      <path d="M14 7.8v7.3l7.5-3.7z" className="ui-marke-schnitt" />
    </svg>
  );
}

export function Kopfzeile(p: Props) {
  const anzahl = p.hinweise ?? 0;
  return (
    <header className="ui-kopf">
      <div className="ui-kopf-links">
        <span className="ui-marke"><Marke /><span className="ui-wortmarke">Planora</span></span>
      </div>

      <nav className="ui-pills" aria-label="Ansicht">
        {(["uebersicht", "technik"] as const).map((m) => (
          <button key={m} type="button" className="ui-pill" aria-pressed={p.modusAktiv && p.modus === m}
            onClick={() => p.onModus(m)}>
            {m === "uebersicht" ? "Übersicht" : "Technik"}
          </button>
        ))}
      </nav>

      <div className="ui-kopf-rechts">
        <Menue name={`${p.gebaeudeName}, Gebäude wählen`} knopfKlasse="ui-glas ui-wahl" breite="breit"
          knopf={<><Building2 {...ICON} /><span className="ui-wahl-name">{p.gebaeudeName}</span><ChevronDown {...ICON} className="ui-chevron" /></>}>
          {(schliessen) => <>
            <p className="ui-menue-titel">Gebäude</p>
            {p.gebaeude === null && <p className="ui-menue-leer">Liste wird geladen …</p>}
            {p.gebaeude?.map((g) => (
              <button key={g.id} type="button" role="menuitemradio" aria-checked={g.id === p.gebaeudeId} className="ui-eintrag"
                onClick={() => { schliessen(); if (g.id !== p.gebaeudeId) p.onGebaeude(g); }}>
                <span className="ui-eintrag-text"><span>{g.name}</span><small>{g.liegenschaftName}</small></span>
                {g.id === p.gebaeudeId && <Check {...ICON} className="ui-haken" />}
              </button>
            ))}
            <span className="ui-trenner" role="separator" />
            <button type="button" role="menuitem" className="ui-eintrag" onClick={() => { schliessen(); p.onListe(); }}>
              <LayoutList {...ICON} />Alle Gebäude
            </button>
          </>}
        </Menue>

        <button type="button" className="ui-glas ui-rund" onClick={p.onHinweise}
          aria-label={p.hinweise === null ? "Hinweise" : `Hinweise: ${anzahl}`}>
          <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
          {anzahl > 0 && <span className="ui-zaehler" aria-hidden="true">{anzahl}</span>}
        </button>

        <Menue name="Profil und Einstellungen" knopfKlasse="ui-glas ui-rund ui-profil"
          knopf={<UserRound size={18} strokeWidth={1.75} aria-hidden="true" />}>
          {(schliessen) => <>
            <button type="button" role="menuitemcheckbox" aria-checked={p.reduziert} className="ui-eintrag"
              onClick={() => p.onReduziert(!p.reduziert)}>
              <span className="ui-eintrag-text"><span>Reduzierte Darstellung</span><small>Ohne Schatten und Tiefeneffekte</small></span>
              <span className="ui-schalter" aria-hidden="true" />
            </button>
            <span className="ui-trenner" role="separator" />
            <button type="button" role="menuitem" className="ui-eintrag" onClick={() => { schliessen(); p.onAnsicht(); }}>
              <PanelsTopLeft {...ICON} />Bisherige Ansicht
            </button>
            <button type="button" role="menuitem" className="ui-eintrag" onClick={() => { schliessen(); p.onEntwurf(); }}>
              <PenLine {...ICON} />Entwurf
            </button>
            <span className="ui-trenner" role="separator" />
            <button type="button" role="menuitem" className="ui-eintrag" onClick={() => { schliessen(); p.onAbmelden(); }}>
              <LogOut {...ICON} />Abmelden
            </button>
          </>}
        </Menue>
      </div>
    </header>
  );
}
