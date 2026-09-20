import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const spec=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-date-time.spec.json'),'utf8'));
const fixture=path.join(root,'test/fixtures/expression-cursor/users-utf8.db');
const server=http.createServer((req,res)=>{if(req.url!=='/date-time-fixture'){res.writeHead(404).end();return;}const stat=fs.statSync(fixture);res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':stat.size,'Content-Encoding':'identity'});fs.createReadStream(fixture).pipe(res);});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/date-time-fixture`));
const observations=[];
try{
 for(const contract of spec.adaptations){
  assert.equal(contract.credit,false); assert.equal(contract.currentDisposition,'expected-temporary-unsupported');
  assert.ok(contract.setup&&contract.sequence.length&&contract.sql.length);
  for(const sql of contract.sql){
   let outcome;
   try{
    const {statement}=db.prepare(sql); const rows=[];
    while(await statement.step()==='row') rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
    statement.finalize(); outcome={kind:'unexpected-success',rows};
   }catch(error){outcome={kind:error?.kind??null,code:error?.code??null,message:error?.message??String(error)};}
   assert.notEqual(outcome.kind,'unexpected-success',`${contract.id} unexpectedly became executable; replace this unsupported gate with typed seam assertions: ${JSON.stringify(outcome)}`);
   assert.match(outcome.message,/no such function|not implemented|temporarily unsupported|unsupported|no such column/i);
   observations.push({id:contract.id,sql,outcome:'expected-temporary-unsupported'});
  }
 }
}finally{db.closeDeferred();await new Promise(resolve=>server.close(resolve));}
assert.equal(observations.length,spec.adaptations.reduce((n,x)=>n+x.sql.length,0));
console.log(JSON.stringify({contracts:spec.adaptations.length,attempts:observations.length,outcome:'expected-temporary-unsupported',tsCredit:'0/18'}));
