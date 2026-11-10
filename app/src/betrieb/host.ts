import { composeArgs, mussGelingen, type Ausfuehrer, type InstanzPfad } from "./update/docker.js";

/** One-offs und pausierte Container mitpruefen; ein unbekannter Engine-Status belegt keinen Stillstand. */
export async function backupLaeuft(docker: Ausfuehrer, projekt: string): Promise<boolean> {
  const r = await mussGelingen(docker, ["ps", "-aq", "--filter", `label=com.docker.compose.project=${projekt}`, "--filter", "label=com.docker.compose.service=backup"]);
  const ids = r.stdout.trim().split(/\s+/).filter(Boolean);
  if (!ids.length) return false;
  const status = await mussGelingen(docker, ["inspect", ...ids, "--format", "{{.State.Status}}"]);
  const z = status.stdout.trim().split(/\s+/);
  return z.length !== ids.length || z.some((s) => !["exited", "dead"].includes(s));
}

export async function reconcileHost(docker: Ausfuehrer, i: InstanzPfad) {
  const aktiv = await backupLaeuft(docker, i.projekt);
  return mussGelingen(docker, [...composeArgs(i), "run", "--pull", "never", "--rm", "-T", "--no-deps", "backup", "reconcile", "--container-laeuft", String(aktiv)]);
}
