import { timingSafeEqual } from "node:crypto";
import type { Ziel } from "./ziel.js";
import type { Verschluesseln, Entschluesseln } from "../journal/age.js";
export type Schluesselinventar = {
  format: 1; instanzId: string;
  restic: { repository: string; passwort: string };
  zielCredentials: Record<string,string>; appSecrets: Record<string,string>;
  dbRollen: Record<"planora_app"|"planora_betrieb"|"planora_backup"|"planora_migrator",string>;
};
export const istUuid = (s: unknown): s is string => typeof s==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function woerterbuch(o: unknown, leer=false) {
  return !!o && typeof o==="object" && !Array.isArray(o) && (leer || Object.keys(o).length>0) && Object.values(o).every((v)=>typeof v==="string" && v.length>0);
}
export function pruefeInventar(o: unknown): asserts o is Schluesselinventar {
  const i=o as Schluesselinventar;
  if (!i || i.format!==1 || !istUuid(i.instanzId) || typeof i.restic?.repository!=="string" || !i.restic.repository || typeof i.restic?.passwort!=="string" || !i.restic.passwort || !woerterbuch(i.zielCredentials,true) || !woerterbuch(i.appSecrets) || !woerterbuch(i.dbRollen) || ["planora_app","planora_betrieb","planora_backup","planora_migrator"].some((r)=>!i.dbRollen[r as keyof typeof i.dbRollen])) throw new Error("Schluesselinventar unvollstaendig");
  if(Object.keys(i.zielCredentials).some((k)=>!["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY","AWS_SESSION_TOKEN","AWS_DEFAULT_REGION","AWS_REGION"].includes(k)))throw new Error("Unbekannte Ziel-Credentials im Inventar");
}
function pfad(instanzId:string,backupId:string) {
  if (!istUuid(instanzId)||!istUuid(backupId)) throw new Error("Ungueltige Inventar-ID");
  return `inventar/${instanzId}/${backupId}.age`;
}
export async function sichereInventar(i:Schluesselinventar,backupId:string,ziel:Ziel,verschluesseln:Verschluesseln) {
  pruefeInventar(i);
  const daten=await verschluesseln(Buffer.from(JSON.stringify(i)));
  const gespeichert=await ziel.schreibe(pfad(i.instanzId,backupId),daten,true);
  if (gespeichert.length!==daten.length || !timingSafeEqual(gespeichert,daten)) throw new Error("Inventar-Objektkonflikt");
}
export async function ladeInventar(instanzId:string,backupId:string,ziel:Ziel,entschluesseln:Entschluesseln) {
  const daten=JSON.parse((await entschluesseln(await ziel.lese(pfad(instanzId,backupId)))).toString());
  pruefeInventar(daten);
  if (daten.instanzId!==instanzId) throw new Error("Inventar gehoert zu fremder Instanz");
  return daten;
}
