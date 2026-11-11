import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
export type Ziel = {
  lese(schluessel: string): Promise<Buffer>;
  /** Liefert bei unveraenderlichen Objekten die bereits vorhandenen Bytes zur Inhaltspruefung. */
  schreibe(schluessel: string, daten: Buffer, unveraenderlich: boolean): Promise<Buffer>;
  liste(prefix: string): Promise<string[]>;
  /** Nur fuer die Retention (Inventar entfernter Saetze, nicht mehr benoetigte Journal-Objekte); fehlend ist kein Fehler. */
  loesche(schluessel: string): Promise<void>;
};
function pruefe(s: string) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(s) || s.startsWith("/") || s.split("/").some((t) => t === ".." || t === "." || !t)) throw new Error("Ungueltiger Zielschluessel");
}
/** Wurzel ist ein eigenes, nur durch den Backup-Benutzer beschreibbares Ziel. */
export function lokalesZiel(wurzel: string): Ziel {
  const basis=resolve(wurzel);
  async function pfad(s: string) {
    pruefe(s); let p=basis;
    for (const t of s.split("/")) {
      p=join(p,t);
      try { if ((await fs.lstat(p)).isSymbolicLink()) throw new Error("Verlinktes Backup-Ziel"); }
      catch(e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    }
    return p;
  }
  const ziel: Ziel = {
    async lese(s) { return fs.readFile(await pfad(s)); },
    async schreibe(s,daten,unveraenderlich) {
      const p=await pfad(s); await fs.mkdir(dirname(p),{recursive:true,mode:0o700});
      const temp=p+"."+randomUUID()+".tmp";
      try {
        await fs.writeFile(temp,daten,{flag:"wx",mode:0o600});
        const f=await fs.open(temp,"r+"); try { await f.sync(); } finally { await f.close(); }
        if (unveraenderlich) {
          try { await fs.link(temp,p); } catch(e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
        } else { await fs.rename(temp,p); }
        return await ziel.lese(s);
      } finally { await fs.rm(temp,{force:true}); }
    },
    async liste(prefix) {
      const start=await pfad(prefix), ergebnis: string[]=[];
      async function besuche(p: string, s: string): Promise<void> {
        let eintraege;
        try { eintraege=await fs.readdir(p,{withFileTypes:true}); } catch(e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return; throw e; }
        for (const e of eintraege) {
          if (e.isSymbolicLink()) throw new Error("Verlinktes Backup-Ziel");
          if (e.isDirectory()) await besuche(join(p,e.name),s+"/"+e.name);
          else if (e.isFile() && !e.name.endsWith(".tmp")) ergebnis.push(s+"/"+e.name);
        }
      }
      await besuche(start,prefix); return ergebnis.sort();
    },
    async loesche(s) { await fs.rm(await pfad(s),{force:true}); },
  }; return ziel;
}
/** [A] Echter CH-S3-Endpunkt noch ungetestet; nur HTTPS und bedingtes PUT zulassen. */
export function s3Ziel(o: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string }): Ziel {
  if (new URL(o.endpoint).protocol !== "https:") throw new Error("S3-Ziel verlangt HTTPS");
  const client = new S3Client({ endpoint:o.endpoint,region:o.region,forcePathStyle:true,credentials:{accessKeyId:o.accessKeyId,secretAccessKey:o.secretAccessKey} });
  const ziel: Ziel = {
    async lese(s) {
      pruefe(s); const r=await client.send(new GetObjectCommand({Bucket:o.bucket,Key:s}));
      if (!r.Body) throw new Error("Leeres S3-Objekt"); return Buffer.from(await r.Body.transformToByteArray());
    },
    async schreibe(s,daten,unveraenderlich) {
      pruefe(s);
      try { await client.send(new PutObjectCommand({Bucket:o.bucket,Key:s,Body:daten,...(unveraenderlich?{IfNoneMatch:"*"}:{})})); }
      catch(e) { if (!unveraenderlich || (e as {$metadata?:{httpStatusCode:number}}).$metadata?.httpStatusCode !== 412) throw e; }
      return ziel.lese(s);
    },
    async liste(prefix) {
      pruefe(prefix); let token: string|undefined; const result: string[]=[];
      do {
        const r=await client.send(new ListObjectsV2Command({Bucket:o.bucket,Prefix:prefix+"/",ContinuationToken:token}));
        for (const obj of r.Contents??[]) if (obj.Key) { pruefe(obj.Key); result.push(obj.Key); }
        token=r.NextContinuationToken;
        if (r.IsTruncated && !token) throw new Error("S3-Liste unvollstaendig");
      } while (token);
      return result.sort();
    },
    async loesche(s) { pruefe(s); await client.send(new DeleteObjectCommand({Bucket:o.bucket,Key:s})); },
  }; return ziel;
}
