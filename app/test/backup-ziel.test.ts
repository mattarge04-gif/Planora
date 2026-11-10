import { it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lokalesZiel, s3Ziel } from "../src/betrieb/backup/ziel.js";
it("publiziert unveraenderliche Zielobjekte atomar und ersetzt nur den Stand",async () => {
  const dir=await fs.mkdtemp(join(tmpdir(),"planora-ziel-")); const z=lokalesZiel(dir);
  try {
    const k="journal/instanz/1.age";
    await Promise.all([z.schreibe(k,Buffer.from("a"),true),z.schreibe(k,Buffer.from("b"),true)]);
    expect(["a","b"]).toContain((await z.lese(k)).toString());
    const vorher=await z.lese(k); expect(await z.schreibe(k,Buffer.from("c"),true)).toEqual(vorher);
    await z.schreibe("journal/instanz/stand.age",Buffer.from("1"),false);
    await z.schreibe("journal/instanz/stand.age",Buffer.from("2"),false);
    expect((await z.lese("journal/instanz/stand.age")).toString()).toBe("2");
    expect(await z.liste("journal/instanz")).toEqual([k,"journal/instanz/stand.age"]);
    await expect(z.schreibe("../ausbruch",Buffer.from("x"),true)).rejects.toThrow();
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
it("verweigert unverschluesselte S3-Endpunkte",() => {
  expect(() => s3Ziel({endpoint:"http://localhost",region:"ch",bucket:"b",accessKeyId:"",secretAccessKey:""})).toThrow(/HTTPS/);
});
