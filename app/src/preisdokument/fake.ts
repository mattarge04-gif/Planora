import type { LeseAdapter, LeseErgebnis } from "./adapter.js";
export function fakeAdapter(antwort: (dateiname: string) => unknown | Error, verzoegerungMs = 0): LeseAdapter & { aufrufe: string[] } {
  const aufrufe: string[] = [];
  return { aufrufe, async lies(_pdf, dateiname) {
    aufrufe.push(dateiname);
    if (verzoegerungMs) await new Promise((r) => setTimeout(r, verzoegerungMs));
    const a = antwort(dateiname);
    if (a instanceof Error) throw a;
    return { roh: a, modell: "fake", tokensEin: 30000, tokensAus: 4000 } satisfies LeseErgebnis;
  } };
}
