import assert from "node:assert/strict";
import http from "node:http";
import { startFixtureServer } from "./fixture-server.mjs";
const root = new URL("../fixtures", import.meta.url).pathname;
const x = await startFixtureServer(root);
const get = p => new Promise((resolve,reject)=>http.get({host:"127.0.0.1",port:x.port,path:p},r=>{let n=0;r.on("data",b=>n+=b.length);r.on("end",()=>resolve([r.statusCode,n,r.headers]));}).on("error",reject));
try {
 const [status,n,h]=await get(`/fixture/${x.token}/encoding-utf16le`); assert.equal(status,200); assert.ok(n>100); assert.equal(h["content-type"],"application/vnd.sqlite3");
 assert.equal((await get(`/fixture/${x.token}/../CURRENT.json`))[0],404);
 assert.equal((await get(`/fixture/bad/readonly`))[0],404);
 console.log("fixture server boundary passed");
} finally { await new Promise((resolve,reject)=>x.server.close(e=>e?reject(e):resolve())); }
