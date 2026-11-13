import type { KatalogEintrag } from "../../typen";
export const TEST_KATALOG: KatalogEintrag[] = [
  { id: "heizung.waermepumpe", name: "Wärmepumpe", bereich: "zentrale" },
  { id: "heizung.speicher", name: "Speicher", bereich: "zentrale" },
  { id: "heizung.umwaelzpumpe", name: "Umwälzpumpe", bereich: "zubehoer" },
  { id: "heizung.verteiler", name: "Verteiler", bereich: "verteilung" },
  { id: "heizung.heizkoerper", name: "Heizkörper", bereich: "einheit" },
  { id: "heizung.fbh_kreis", name: "FBH-Kreis", bereich: "einheit" },
  { id: "heizung.ventil_3weg", name: "3-Weg-Ventil", bereich: "zubehoer" },
  { id: "heizung.ventil_2weg", name: "Durchgangsventil", bereich: "zubehoer" },
  { id: "heizung.wmz", name: "Wärmezähler", bereich: "zubehoer" },
];
