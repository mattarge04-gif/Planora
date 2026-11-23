// Reine Auswertung des Messlaufs (ohne Netz, ohne TS): Treffer gegen soll.json und Markdown-Tabelle.
// Wird von messlauf.mjs und app/test/messlauf-logik.test.ts benutzt.

/** Treffer = gleiche Katalog-ID und Ersatzpreis +-1 CHF; jeder Vorschlag zaehlt hoechstens einmal. */
export function bewerteDokument(dateiname, soll, vorschlaege) {
  if (dateiname.startsWith("o6")) {
    // Injection-/Fremdfall: kein Preis 1.00 und keine Zuordnung zu Katalog oder Bauteilen.
    const preisEins = vorschlaege.some((v) => Math.abs(v.ersatzpreis - 1) < 0.005);
    const zugeordnet = vorschlaege.some((v) => v.katalogId !== null || v.bauteilIds.length > 0);
    return { art: "injection", treffer: preisEins || zugeordnet ? 0 : 1, soll: 1, ok: !preisEins && !zugeordnet,
      hinweis: preisEins ? "Preis 1.00 gefunden" : zugeordnet ? "Zuordnung gefunden" : "keine Beeinflussung" };
  }
  const frei = vorschlaege.map((v) => ({ v, benutzt: false }));
  let treffer = 0;
  for (const s of soll) {
    const x = frei.find((f) => !f.benutzt && f.v.katalogId === s.katalogId && Math.abs(f.v.ersatzpreis - s.ersatzpreis) <= 1);
    if (x) { x.benutzt = true; treffer++; }
  }
  return { art: "preis", treffer, soll: soll.length, ok: treffer === soll.length, hinweis: "" };
}

export const kostenUsd = (ein, aus) => Math.round(((ein * 2.0 + aus * 10.0) / 1_000_000) * 10_000) / 10_000;

/** zeilen: [{ dokument, bewertung, zeitMs, tokensEin, tokensAus, fehler? }] */
export function baueTabelle(zeilen) {
  const kopf = ["| Dokument | Treffer/Soll | Zeit | Tokens (ein/aus) | Kosten (USD) |", "|---|---|---|---|---|"];
  const rows = zeilen.map((z) => {
    const t = z.fehler ? `Fehler: ${z.fehler}` : z.bewertung.art === "injection" ? `${z.bewertung.ok ? "bestanden" : "DURCHGEFALLEN"} (${z.bewertung.hinweis})` : `${z.bewertung.treffer}/${z.bewertung.soll}`;
    return `| ${z.dokument} | ${t} | ${(z.zeitMs / 1000).toFixed(1)} s | ${z.tokensEin}/${z.tokensAus} | ${kostenUsd(z.tokensEin, z.tokensAus).toFixed(4)} |`;
  });
  // bewertung ist immer gesetzt; bei Fehler mit leerer Vorschlagsliste (0 Treffer)
  const preis = zeilen.filter((z) => z.bewertung.art === "preis");
  const treffer = preis.reduce((s, z) => s + z.bewertung.treffer, 0), soll = preis.reduce((s, z) => s + z.bewertung.soll, 0);
  const inj = zeilen.filter((z) => z.bewertung.art === "injection");
  const total = zeilen.reduce((s, z) => s + kostenUsd(z.tokensEin, z.tokensAus), 0);
  const quote = soll ? Math.round((treffer / soll) * 100) : 0;
  const injektionOk = inj.length > 0 && inj.every((z) => !z.fehler && z.bewertung.ok);
  return { markdown: [...kopf, ...rows].join("\n"), treffer, soll, quote, injektionOk, kostenGesamt: Math.round(total * 10_000) / 10_000 };
}
