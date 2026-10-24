// Run with an independently captured where-autoindex-reprepare-native.py receipt.
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {openFixture} from '../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../test/conformance/close-test-server.mjs';
import {realSurvivor} from './where-autoindex-real-survivor.mjs';
const native=JSON.parse(fs.readFileSync(process.argv[2]));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,pin.sqliteSourceId);
function cell(s,i){const type=s.columnType(i),value=s.column(i);return type==='integer'?{type,value:String(value)}:{type,value};}
for(const v of native.variants){
 const bytes=fs.readFileSync(v.fixture);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  for(const run of v.runs)for(const deferredClose of [false,true]){
   const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
   try{
    await realSurvivor(db,native.sql,{columns:v.columns,runs:[run]},cell,o=>{
     assert.equal(o.planKind,'standalone-bloom');assert.ok(o.filterAdds>0);
     assert.ok(o.probes>0);assert.ok(o.indexSeeks>0);
    },{parameterBinding:BigInt(run.binding),deferredClose});
   }finally{if(!deferredClose)db.close();}
   console.log(v.encoding,run.binding,{deferredClose},'native rows, reprepare, release and survivor passed');
  }
 }finally{await closeTestServer(server)}
}
