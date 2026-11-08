// Druckt den Gesamt-Hash ueber N Zufalls-Schnappschuesse (fuer Vergleich zwischen Prozessen/Maschinen).
// Aufruf: node s10-rechenkern/hash_lauf.ts 10000
import { createHash } from "node:crypto";
import { berechne, kanonisch } from "./kern.ts";
import { zufallsEingabe } from "./zufall.ts";
const n = Number(process.argv[2] ?? "10000");
const h = createHash("sha256"); for (let s = 1; s <= n; s++) h.update(kanonisch(berechne(zufallsEingabe(s))));
console.log(h.digest("hex"));
