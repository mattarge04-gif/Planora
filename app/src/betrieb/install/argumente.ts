/** Kleiner Parser fuer --name wert, Schalter ohne Wert und Positionsargumente. */
export function leseArgumente(args: string[], erlaubt: string[], schalter: string[] = []): { werte: Record<string, string>; positionen: string[] } {
  const werte: Record<string, string> = {}, positionen: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) { positionen.push(a); continue; }
    const name = a.slice(2);
    if (schalter.includes(name)) { werte[name] = "1"; continue; }
    if (!erlaubt.includes(name)) throw new Error(`Unbekannte Option: ${a}`);
    const wert = args[++i];
    if (wert === undefined || wert.startsWith("--")) throw new Error(`Wert fehlt fuer ${a}`);
    werte[name] = wert;
  }
  return { werte, positionen };
}
