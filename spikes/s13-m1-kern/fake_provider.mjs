// Fake-Provider fuer T3: eigener Prozess, antwortet nach 500 ms, protokolliert jede eingehende Anfrage
// mit Zeitstempel (Epoch-ms, hochaufloesend) und ob der Client vor der Antwort abgebrochen hat.
import http from "node:http";

const jetzt = () => performance.timeOrigin + performance.now();
let log = [];
const server = http.createServer((req, res) => {
  const e = { ts: jetzt(), job: req.headers["x-job"], abgebrochen: false };
  log.push(e);
  const t = setTimeout(() => { res.end(JSON.stringify({ antwort: "ok" })); }, 500);
  res.on("close", () => { if (!res.writableFinished) { e.abgebrochen = true; clearTimeout(t); } });
});
server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
process.on("message", (m) => {
  if (m === "log") { process.send({ log }); log = []; }
  if (m === "ende") server.close(() => process.exit(0));
});
