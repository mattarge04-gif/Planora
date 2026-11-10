import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { erfolgreich, prozess, type Prozess } from "../backup/prozess.js";
export type Verschluesseln = (daten: Buffer) => Promise<Buffer>;
export type Entschluesseln = (daten: Buffer) => Promise<Buffer>;
/** age BSD-3-Clause, Version und Downloadhash im Backup-Dockerfile. */
async function age(daten: Buffer, args: string[], lauf: Prozess) {
  const dir=await fs.mkdtemp(join(tmpdir(),"planora-age-"));
  try {
    const quelle=join(dir,"quelle"), ziel=join(dir,"ziel");
    await fs.writeFile(quelle,daten,{mode:0o600,flag:"wx"});
    await erfolgreich(lauf,{programm:"age",args:[...args,"--output",ziel,quelle]});
    return await fs.readFile(ziel);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
}
export const ageVerschluesseln = (empfaenger: string, lauf: Prozess=prozess): Verschluesseln => {
  if (!/^age1[a-z0-9]+$/.test(empfaenger)) throw new Error("Ungueltiger age-Empfaenger");
  return (daten) => age(daten,["--encrypt","--recipient",empfaenger],lauf);
};
export const ageEntschluesseln = (identityDatei: string, lauf: Prozess=prozess): Entschluesseln =>
  (daten) => age(daten,["--decrypt","--identity",identityDatei],lauf);
