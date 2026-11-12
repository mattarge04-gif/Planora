import type { ComponentType } from "react";
import type { Welt } from "../../typen";
import type { Positionen } from "../beschreibung";
import type { SchrittNr } from "../zustand";
import type { SchrittProps } from "./gemeinsam";

export interface SchrittInhaltProps extends SchrittProps {
  neu: boolean;
  liegenschaften: { id: string; name: string }[];
  welt: Welt | null;
  vorschauFehler: string[] | null;
  positionen: Positionen;
  onUebernehmen: () => void;
  arbeitet: boolean;
}

function Folgt() {
  return <p className="as-laden">Dieser Schritt folgt.</p>;
}

export const SCHRITT_INHALT: Record<SchrittNr, ComponentType<SchrittInhaltProps>> = {
  1: Folgt, 2: Folgt, 3: Folgt, 4: Folgt, 5: Folgt, 6: Folgt, 7: Folgt, 8: Folgt,
};
