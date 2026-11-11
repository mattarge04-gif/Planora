// Test-CA zur Laufzeit (M1-Abnahme Punkt 2): openssl erzeugt Wegwerf-Schluessel in einem Temp-Verzeichnis.
// Keine Schluessel im Repository. openssl aus PLANORA_OPENSSL, PATH oder Git fuer Windows.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function findeOpenssl(): string | undefined {
  const kandidaten = [process.env.PLANORA_OPENSSL, "openssl", "C:/Program Files/Git/mingw64/bin/openssl.exe", "C:/Program Files/Git/usr/bin/openssl.exe"].filter((k): k is string => !!k);
  for (const k of kandidaten) {
    try { execFileSync(k, ["version"], { stdio: "ignore", windowsHide: true }); return k; } catch { /* naechster */ }
  }
  return undefined;
}

export type TestCa = { verzeichnis: string; caPem: string; ausstellen(name: string, o?: { dns?: string[]; tage?: number; vonTagen?: number }): { certDatei: string; keyDatei: string; certPem: string; keyPem: string }; aufraeumen(): void };

/** Neue Wegwerf-CA (EC P-256). ausstellen() signiert Serverzertifikate mit subjectAltName. */
export function testCa(openssl: string, name = "Planora Test-Kunden-CA"): TestCa {
  const v = mkdtempSync(join(tmpdir(), "planora-test-ca-"));
  const o = (args: string[]) => execFileSync(openssl, args, { cwd: v, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: { ...process.env, MSYS_NO_PATHCONV: "1", MSYS2_ARG_CONV_EXCL: "*" } });
  o(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "ca.key"]);
  o(["req", "-x509", "-new", "-key", "ca.key", "-sha256", "-days", "30", "-subj", `/CN=${name}`, "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-out", "ca.pem"]);
  let serial = 1;
  return {
    verzeichnis: v, caPem: readFileSync(join(v, "ca.pem"), "utf8"),
    ausstellen(datei, a = {}) {
      const dns = a.dns ?? ["planora.kunde.test"];
      o(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", `${datei}.key.sec1`]);
      // PKCS#8 wie typische Kunden-Exporte; Caddy und Node lesen beide Formate.
      o(["pkcs8", "-topk8", "-nocrypt", "-in", `${datei}.key.sec1`, "-out", `${datei}.key`]);
      o(["req", "-new", "-key", `${datei}.key`, "-subj", `/CN=${dns[0]}`, "-out", `${datei}.csr`]);
      writeFileSync(join(v, `${datei}.ext`), [`subjectAltName=${dns.map((d) => `DNS:${d}`).join(",")}`, "basicConstraints=critical,CA:FALSE", "keyUsage=critical,digitalSignature", "extendedKeyUsage=serverAuth", ""].join("\n"));
      o(["x509", "-req", "-in", `${datei}.csr`, "-CA", "ca.pem", "-CAkey", "ca.key", "-set_serial", String(serial++), "-days", String(a.tage ?? 20), "-sha256", "-extfile", `${datei}.ext`, "-out", `${datei}.pem`]);
      const certDatei = join(v, `${datei}.pem`), keyDatei = join(v, `${datei}.key`);
      return { certDatei, keyDatei, certPem: readFileSync(certDatei, "utf8"), keyPem: readFileSync(keyDatei, "utf8") };
    },
    aufraeumen() { if (existsSync(v)) rmSync(v, { recursive: true, force: true }); },
  };
}
