import { expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalisiereZiel, planeInstanz, pruefeKollision } from "../src/betrieb/install/plan.js";

it("erkennt Punktsegmente, Datei-URLs und Junction-/Symlink-Aliase desselben lokalen Ziels",()=>{
  const dir=mkdtempSync(join(tmpdir(),"backup-alias-"));
  try {
    const echt=join(dir,"echt"),alias=join(dir,"alias"); mkdirSync(echt); symlinkSync(echt,alias,process.platform==="win32"?"junction":"dir");
    const ziel=join(echt,"neu");
    for(const pfad of [join(alias,"neu"),join(echt,"..","echt","neu"),pathToFileURL(ziel).href]) {
      expect(normalisiereZiel(pfad)).toBe(normalisiereZiel(ziel));
      const plan=planeInstanz({instanz:"kunde-b",domain:"planora.test",tls:"internal",backupZiel:pfad,httpsPort:28443,httpPort:28080});
      expect(pruefeKollision(plan,{projekte:[],volumes:[],instanzen:[{instanz:"kunde-a",backupZiel:ziel}]})).toContain("Backup-Ziel wird bereits von Instanz kunde-a verwendet");
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
it("normalisiert S3-Endpoint und URL-Aliase, erhaelt aber Gross/Klein im Objektschluessel",()=>{
  expect(normalisiereZiel("s3:https://S3.example.ch:443/bucket/a/../%62/" )).toBe(normalisiereZiel("s3:https://s3.example.ch/bucket/b"));
  expect(normalisiereZiel("s3:https://s3.example.ch/bucket/B")).not.toBe(normalisiereZiel("s3:https://s3.example.ch/bucket/b"));
});
