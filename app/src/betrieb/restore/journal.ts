import type { Ziel } from "../backup/ziel.js";
import type { Entschluesseln } from "../journal/age.js";
import type { JournalEintrag, JournalStand } from "../journal/outbox.js";
export async function ladeJournal(ziel:Ziel,entschluesseln:Entschluesseln,instanzId:string,basisSeq:string) {
  const prefix=`journal/${instanzId}`;
  const stand=JSON.parse((await entschluesseln(await ziel.lese(`${prefix}/stand.age`))).toString()) as JournalStand;
  if(stand.instanzId!==instanzId || !/^\d+$/.test(stand.letzteQuittierteSeq) || !Number.isFinite(Date.parse(stand.zeit)))throw new Error("Ungueltiger Journal-Stand");
  const schluessel=await ziel.liste(prefix),seqs:bigint[]=[];
  for(const k of schluessel){
    if(k===`${prefix}/stand.age`)continue;
    const teil=k.slice(prefix.length+1);
    if(!/^[1-9]\d*\.age$/.test(teil))throw new Error("Unbekanntes Journal-Objekt");
    const seq=BigInt(teil.slice(0,-4));if(seq>BigInt(basisSeq))seqs.push(seq);
  }
  seqs.sort((a,b)=>a<b?-1:a>b?1:0);
  const eintraege:JournalEintrag[]=[];let erwartet=BigInt(basisSeq)+1n;
  for(const seq of seqs){
    if(seq!==erwartet)throw new Error("Journal-Luecke");
    const e=JSON.parse((await entschluesseln(await ziel.lese(`${prefix}/${seq}.age`))).toString()) as JournalEintrag;
    if(e.instanzId!==instanzId || e.seq!==seq.toString() || typeof e.art!=="string" || typeof e.ziel!=="string" || !Number.isFinite(Date.parse(e.zeit)))throw new Error("Ungueltiger Journal-Eintrag");
    eintraege.push(e);erwartet++;
  }
  if(BigInt(stand.letzteQuittierteSeq)>=erwartet)throw new Error("Journal-Luecke vor quittiertem Stand");
  return{stand,eintraege};
}
