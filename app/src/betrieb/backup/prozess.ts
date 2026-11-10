import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
export type Aufruf = { programm: string; args: string[]; cwd?: string; env?: NodeJS.ProcessEnv; ausgabeDatei?: string; signal?: AbortSignal };
export type Prozess = (aufruf: Aufruf) => Promise<{ code: number; stdout: string }>;
/** Keine Shell, keine Passwoerter in Argumenten oder Fehlermeldungen. */
export const prozess: Prozess = async (a) => {
  const p = spawn(a.programm, a.args, { cwd: a.cwd, env: { ...process.env, ...a.env }, signal: a.signal, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  p.stderr.resume(); // Tools koennen Credentials in stderr wiedergeben: nicht ungefiltert loggen.
  const ausgabe = a.ausgabeDatei
    ? pipeline(p.stdout, createWriteStream(a.ausgabeDatei, { flags: "wx", mode: 0o600 }))
    : new Promise<void>((resolve, reject) => {
      p.stdout.on("data", (d) => { stdout += d; }); p.stdout.on("end", resolve); p.stdout.on("error", reject);
    });
  const ende = new Promise<number>((resolve, reject) => { p.on("error", reject); p.on("close", (code) => resolve(code ?? -1)); });
  const [code] = await Promise.all([ende, ausgabe]);
  return { code, stdout };
};
export async function erfolgreich(lauf: Prozess, a: Aufruf) {
  a.signal?.throwIfAborted();
  const r = await lauf(a);
  a.signal?.throwIfAborted();
  if (r.code !== 0) throw new Error(`${a.programm}: Exitcode ${r.code}`);
  return r.stdout;
}
