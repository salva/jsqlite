import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Development-only exact-ID fixture server. It never maps request text to paths. */
export function startFixtureServer(fixtureRoot) {
  const current = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "CURRENT.json"), "utf8"));
  const generation = path.join(fixtureRoot, "generations", current.generationId);
  const catalog = JSON.parse(fs.readFileSync(path.join(generation, "catalog.json"), "utf8"));
  const fixtures = new Map(catalog.semantic.fixtures.map((f) => [f.id, f]));
  const token = crypto.randomBytes(32).toString("hex");
  const server = http.createServer((req, res) => {
    const prefix = `/fixture/${token}/`;
    let id = null;
    try { if (req.method === "GET" && req.url.startsWith(prefix) && !req.url.includes("?")) id = decodeURIComponent(req.url.slice(prefix.length)); } catch {}
    const item = id && !id.includes("/") && !id.includes(".") ? fixtures.get(id) : null;
    if (!item) { res.writeHead(404, {"Cache-Control":"no-store"}); res.end(); return; }
    const file = path.join(generation, item.path);
    res.writeHead(200, {"Content-Type":"application/vnd.sqlite3","Content-Length":item.bytes,"Cache-Control":"no-store","Content-Encoding":"identity"});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({server, token, port:server.address().port}));
  });
}
