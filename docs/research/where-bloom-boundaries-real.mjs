// Native receipt must be captured first by where-bloom-boundaries-native.py.
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {openFixture,privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../test/conformance/close-test-server.mjs';
const native=JSON.parse(fs.readFileSync(process.argv[2]));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,pin.sqliteSourceId);
function cell(s,i){const type=s.columnType(i),value=s.column(i);if(type==='null')return {type};if(type==='integer')return {type,value:String(value)};throw Error(`unexpected witness type ${type}`);}
for(const v of native.variants){
 const bytes=fs.readFileSync(v.fixture);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  try{for(const c of v.cases){
   const s=db.prepare(c.sql).statement;
   try{
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.columns);
    for(const expected of c.runs){
     const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s,i)));
     assert.deepEqual(rows,expected,`${v.encoding} ${c.case}`);
     const o=privateAccounting(s);assert.equal(o.ownedBytes,0);assert.equal(o.openCursors,0);
     if(c.case==='frame'){assert.equal(o.filterAdds,0);assert.equal(o.probes,0);}
     else {assert.equal(o.planKind,'standalone-bloom');assert.ok(o.filterAdds>0);assert.ok(o.probes>0);assert.ok(o.indexSeeks>0);}
     console.log(v.encoding,c.case,'native rows/metadata/reset/release passed',JSON.stringify({filterAdds:o.filterAdds,probes:o.probes,planKind:o.planKind}));
     s.reset();
    }
   }finally{s.finalize();}
  }}finally{db.close();}
 }finally{await closeTestServer(server);}
}
