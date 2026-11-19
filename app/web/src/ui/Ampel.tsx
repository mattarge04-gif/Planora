import { CircleCheck, CircleDashed, Clock, OctagonAlert, type LucideIcon } from "lucide-react";
import { AMPEL_FARBE, AMPEL_TEXT } from "../lebensdauer/ansicht";
import type { Ampel } from "../lebensdauer/typen";

/** Jede Ampelstufe hat neben der Farbe eine eigene Form: die Farbe allein trägt nie die Bedeutung
 *  (Rot ist auch KOO-Heizung, designsystem.md Abschnitt 1). */
export const AMPEL_ICON: Record<Ampel, LucideIcon> = { gruen: CircleCheck, gelb: Clock, rot: OctagonAlert, grau: CircleDashed };

interface Props {
  ampel: Ampel;
  groesse?: number;
  /** Ohne sichtbaren Text daneben: Zeichen bekommt den Ampeltext als zugänglichen Namen. */
  alleine?: boolean;
  klasse?: string;
}

export function AmpelZeichen({ ampel, groesse = 14, alleine = false, klasse = "" }: Props) {
  const Icon = AMPEL_ICON[ampel];
  return <Icon size={groesse} strokeWidth={2.1} color={AMPEL_FARBE[ampel]} className={`ui-ampel ${klasse}`}
    {...(alleine ? { role: "img", "aria-label": AMPEL_TEXT[ampel], "aria-hidden": false } : { "aria-hidden": true })} />;
}
