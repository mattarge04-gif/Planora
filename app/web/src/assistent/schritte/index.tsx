import type { ComponentType } from "react";
import type { Welt } from "../../typen";
import type { Positionen } from "../beschreibung";
import type { SchrittNr } from "../zustand";
import type { SchrittProps } from "./gemeinsam";
import { Schritt1Gebaeude } from "./Schritt1Gebaeude";
import { Schritt2Einheiten } from "./Schritt2Einheiten";
import { Schritt3Abgaben } from "./Schritt3Abgaben";
import { Schritt4Zentrale } from "./Schritt4Zentrale";

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
  1: Schritt1Gebaeude, 2: Schritt2Einheiten, 3: Schritt3Abgaben, 4: Schritt4Zentrale, 5: Folgt, 6: Folgt, 7: Folgt, 8: Folgt,
};
