export type Instanzkonfiguration = {
  format: 1; instanzId: string; release: string; domain: string;
  tls: "acme"|"internal"|"kundenzertifikat"; profil: "P1"|"P2"|"P3";
  zeitzone: string;
  smtp?: { host: string; port: number; absender: string; starttls: boolean };
};
/** Definierte nicht geheime Laufzeitkonfiguration; Secrets ausschliesslich im age-Inventar. */
export function pruefeKonfiguration(o: unknown): asserts o is Instanzkonfiguration {
  const k=o as Instanzkonfiguration;
  if (!k || k.format!==1 || !/^[0-9a-f-]{36}$/i.test(k.instanzId??"") || !k.release || !/^[a-zA-Z0-9.-]+$/.test(k.domain??"") || !["acme","internal","kundenzertifikat"].includes(k.tls) || !["P1","P2","P3"].includes(k.profil) || !k.zeitzone || Object.keys(k).some((s)=>!["format","instanzId","release","domain","tls","profil","zeitzone","smtp"].includes(s))) throw new Error("Ungueltige nicht geheime Instanzkonfiguration");
  if (k.smtp && (!k.smtp.host || !k.smtp.absender || !Number.isInteger(k.smtp.port) || k.smtp.port<1 || k.smtp.port>65535 || typeof k.smtp.starttls!=="boolean" || Object.keys(k.smtp).some((s)=>!["host","port","absender","starttls"].includes(s)))) throw new Error("Ungueltige SMTP-Konfiguration; Credentials gehoeren ins Inventar");
}
