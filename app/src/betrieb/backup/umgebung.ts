import { readFile } from "node:fs/promises";
import { lokalesZiel, s3Ziel } from "./ziel.js";
export async function geheimnis(name: string) {
  const datei=process.env[`${name}_FILE`];
  const wert=datei?(await readFile(datei,"utf8")).trim():process.env[name];
  if(!wert)throw new Error(`Konfiguration fehlt: ${name}`);return wert;
}
export async function zielAusUmgebung() {
  if(process.env.PLANORA_ZIEL_ART==="s3")return s3Ziel({endpoint:await geheimnis("PLANORA_S3_ENDPOINT"),region:await geheimnis("AWS_REGION"),bucket:await geheimnis("PLANORA_S3_BUCKET"),accessKeyId:await geheimnis("AWS_ACCESS_KEY_ID"),secretAccessKey:await geheimnis("AWS_SECRET_ACCESS_KEY")});
  return lokalesZiel(process.env.PLANORA_OBJEKT_ZIEL??"/ziel");
}
