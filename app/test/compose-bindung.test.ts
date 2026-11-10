import { expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruefeComposeBindung } from "../src/betrieb/update/compose.js";
import { dockerAusfuehrer } from "../src/betrieb/update/docker.js";
import type { Release } from "../src/betrieb/release.js";

it("prueft die effektiv gerenderten Dienst-Images gegen alle Manifest-Bindungen", async()=>{
  const dir=mkdtempSync(join(tmpdir(),"compose-bindung-")), envDatei=join(dir,"instanz.env");writeFileSync(envDatei,"PLANORA_RELEASE=test\n");
  const images=["app","db","proxy","backup"].map((dienst)=>({dienst,referenz:`planora-${dienst}:test@sha256:${"a".repeat(64)}`}));
  const r={images} as Release;
  const services=Object.fromEntries(Object.entries({api:"app",worker:"app",migrator:"app",proxy:"proxy",db:"db",backup:"backup",journal:"backup",restore:"backup"}).map(([s,d])=>[s,{image:images.find(i=>i.dienst===d)!.referenz}]));
  const i={projekt:"planora-test",envDatei,composeDateien:["compose.yaml"]};
  try {
    const docker=async()=>({code:0,stdout:JSON.stringify({services}),stderr:""});
    await pruefeComposeBindung(docker,i,r);
    services.worker.image="fremd:test";
    await expect(pruefeComposeBindung(docker,i,r)).rejects.toThrow(/worker/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

it("uebergibt geerbte Image-/Compose-Overrides nicht an Docker-Prozesse",async()=>{
  const keys=["PLANORA_IMAGE_APP","PLANORA_BACKUP_IMAGE","COMPOSE_FILE","COMPOSE_PROFILES"],alt=keys.map(k=>process.env[k]);
  try {
    for(const k of keys)process.env[k]="fremder-wert";
    const r=await dockerAusfuehrer(process.execPath)(["-e",`process.stdout.write(JSON.stringify(Object.keys(process.env).filter(k=>/^(PLANORA_|COMPOSE_)/i.test(k))))`]);
    expect(r.code).toBe(0);expect(JSON.parse(r.stdout)).toEqual([]);
  }finally{keys.forEach((k,n)=>{if(alt[n]===undefined)delete process.env[k];else process.env[k]=alt[n];});}
});
