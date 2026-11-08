// Laufzeit: 1 Schnappschuss mit 10'000 Elementen (Ziel 03 Kap. 1.2: Erneuerungsliste <= 2 s)
import { berechne } from "./kern.ts";
import { typ, eingabe, ang } from "./zufall.ts";
const typen = Array.from({ length: 40 }, (_, i) => typ({ id: `T${i}`, katalog_id: `k.${i}`, gruppe: `G${i % 6}`, L: String(8 + (i % 30)), preis: { rappen: String(10000 + i * 997), preisjahr: 2024 }, angaben_lebensdauer: i % 3 ? [ang({ dokumentart: "datenblatt", stunden: "50000" })] : [] }));
const els = Array.from({ length: 10_000 }, (_, i) => ({ id: `E${String(i).padStart(5, "0")}`, gebaeude: `B${i % 3}`, typ_id: `T${i % 40}`, menge: 1 + (i % 7), einbaujahr: 1990 + (i % 35), angaben_lebensdauer: [], bewertung: i % 4 ? null : { jahr: 2024, zustandswert: ((i % 11) / 10).toFixed(1) } }));
const e = eingabe(typen, els); const zeiten: number[] = [];
for (let r = 0; r < 5; r++) { const t0 = performance.now(); const res = berechne(e); zeiten.push(performance.now() - t0); if (r === 0) console.log("Ereignisse:", res.ereignisse.length, "Summe Rappen:", res.summe_rappen); }
console.log("ms je Lauf:", zeiten.map((z) => z.toFixed(0)).join(", "));
