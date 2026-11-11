import { it, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ladeInventar, sichereInventar, type Schluesselinventar } from "../src/betrieb/backup/inventar.js";
import { lokalesZiel } from "../src/betrieb/backup/ziel.js";
function inventar():Schluesselinventar {
  const neu=()=>randomBytes(24).toString("hex");
  return {format:1,instanzId:randomUUID(),restic:{repository:"/ziel/restic",passwort:neu()},zielCredentials:{},appSecrets:{auth:neu()},dbRollen:{planora_app:neu(),planora_betrieb:neu(),planora_backup:neu(),planora_migrator:neu()}};
}
it("legt ein instanzgebundenes Inventar ausserhalb von restic ab und liest es mit Recovery",async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),"planora-inventar-"));const ziel=lokalesZiel(dir),i=inventar(),id=randomUUID();
  const enc=async(d:Buffer)=>Buffer.from(d.toString("base64")),dec=async(d:Buffer)=>Buffer.from(d.toString(),"base64");
  try{
    await sichereInventar(i,id,ziel,enc);
    expect(await ladeInventar(i.instanzId,id,ziel,dec)).toEqual(i);
    await expect(ladeInventar(randomUUID(),id,ziel,dec)).rejects.toThrow();
    await expect(ladeInventar(i.instanzId,randomUUID(),ziel,dec)).rejects.toThrow();
    const fremd={...i,instanzId:randomUUID()};
    await ziel.schreibe(`inventar/${i.instanzId}/${id}.age`,await enc(Buffer.from(JSON.stringify(fremd))),false);
    await expect(ladeInventar(i.instanzId,id,ziel,dec)).rejects.toThrow(/fremder Instanz/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
it("verweigert unvollstaendige Inventare vor dem Schreiben",async()=>{
  const i=inventar();delete (i.dbRollen as Partial<typeof i.dbRollen>).planora_migrator;
  let geschrieben=false;const ziel={lese:async()=>Buffer.alloc(0),liste:async()=>[],schreibe:async()=>{geschrieben=true;return Buffer.alloc(0);},loesche:async()=>{}};
  await expect(sichereInventar(i,randomUUID(),ziel,async(d)=>d)).rejects.toThrow(/unvollstaendig/);expect(geschrieben).toBe(false);
});
