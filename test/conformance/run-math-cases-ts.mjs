import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const spec=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-math.spec.json'),'utf8'));
const fixtures={'UTF-8':'users-utf8.db','UTF-16le':'users-utf16le.db','UTF-16be':'users-utf16be.db'};
const token='math-evidence';
const server=http.createServer((req,res)=>{const e=Object.keys(fixtures).find(x=>req.url===`/${token}/${encodeURIComponent(x)}`);if(!e){res.writeHead(404).end();return}const f=path.join(root,'test/fixtures/expression-cursor',fixtures[e]);const s=fs.statSync(f);res.writeHead(200,{'Content-Length':s.size});fs.createReadStream(f).pipe(res)});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
let absent=0,unexpected=0;
try{for(const encoding of Object.keys(fixtures)){const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/${token}/${encodeURIComponent(encoding)}`));try{for(const c of spec.cases.filter(x=>x.encodings.includes(encoding))){let statement;try{({statement}=db.prepare(c.sql));for(const p of c.parameters){let v=p.type==='null'?null:p.type==='integer'?BigInt(p.value):p.type==='real'?Number(p.value):p.type==='blob'?Uint8Array.from(Buffer.from(p.hex,'hex')):p.value;statement.bind(p.index,v)}while(await statement.step()==='row'){}unexpected++}catch(error){assert.match(error?.message??String(error),/no such function|not implemented|temporarily unsupported|unsupported/i,`${c.id}: ${error}`);absent++}finally{statement?.finalize()}}}finally{db.closeDeferred()}}}finally{await new Promise(resolve=>server.close(resolve))}
assert.equal(absent,spec.scope.oracleObservations);assert.equal(unexpected,0);
console.log(JSON.stringify({outcome:'pass-absent-zero-credit',cases:spec.scope.selectedCases,encodings:3,absentObservations:absent,tsCredit:0}));
