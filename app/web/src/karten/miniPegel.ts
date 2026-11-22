import { PEGEL_FOLGE, pegelSegmente, type Segment, type Zaehler } from "../szene3/pegelband";

/** Mini-Pegel der Geschoss-Karte (Kritik r3 Top 1): 48 × 4 px, Segmente wie das Pegelband im 3D, mit kleiner Fuge. */
export const MINI_PEGEL_PX = 48;
const FUGE_PX = 2;

const KURZ: Record<keyof Zaehler, string> = { rot: "ersetzen", gelb: "bald ersetzen", gruen: "in Ordnung", grau: "Baujahr fehlt" };

/** Segmente (Anteile 0..1) mit Fuge in Pixeln, gleiche Reihenfolge und Mindestanteile wie das Band. */
export function miniSegmente(zaehler: Zaehler | undefined): Segment[] {
  if (!zaehler) return [];
  const n = PEGEL_FOLGE.filter((a) => zaehler[a] > 0).length;
  return pegelSegmente(zaehler, undefined, n > 1 ? FUGE_PX / MINI_PEGEL_PX : 0);
}

/** Zugänglicher Text: «UG1: 4 ersetzen, 1 bald ersetzen, 2 in Ordnung». */
export function miniPegelText(code: string, zaehler: Zaehler | undefined): string {
  const teile = zaehler ? PEGEL_FOLGE.filter((a) => zaehler[a] > 0).map((a) => `${zaehler[a]} ${KURZ[a]}`) : [];
  return `${code}: ${teile.length ? teile.join(", ") : "keine Bauteile mit Lebensdauer"}`;
}
