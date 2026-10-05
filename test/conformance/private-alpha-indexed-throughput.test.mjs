import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {open} from '../../src/index.ts';
import {closeTestServer} from './close-test-server.mjs';
const oracle=JSON.parse(fs.readFileSync(new URL('./cases/private-alpha-indexed-throughput-native.json',import.meta.url)));
assert.equal(oracle.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
const cell=v=>v===null?{type:'null'}:typeof v==='bigint'?{type:'integer',value:String(v)}:typeof v==='number'?{type:'real',ieee754be:(()=>{const b=Buffer.alloc(8);b.writeDoubleBE(v);return b.toString('hex');})()}:typeof v==='string'?{type:'text',utf8Hex:Buffer.from(v).toString('hex')}:{type:'blob',hex:Buffer.from(v).toString('hex')};
test('immutable 1MB Chinook indexed range join: exact native rows, reset and bounded repeated delivery',async t=>{
 const bytes=fs.readFileSync(new URL('../../examples/browser/chinook.sqlite',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),oracle.fixtureSha256);
 assert.ok(bytes.length>=1_000_000);assert.ok(oracle.rows.length>=100);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db,st;const started=performance.now();
 try{
  db=await open(new Request(`http://127.0.0.1:${server.address().port}/chinook`));
  st=db.prepare(oracle.sql).statement;
  assert.deepEqual(oracle.metadata.map((_,i)=>st.columnMetadata(i)),oracle.metadata);
  for(let pass=0;pass<3;pass++){
   const before=performance.now(),rows=[];
   while(await st.step()==='row')rows.push(oracle.metadata.map((_,i)=>cell(st.column(i))));
   assert.deepEqual(rows,oracle.rows);
   t.diagnostic(`pass=${pass} rows=${rows.length} elapsedMs=${(performance.now()-before).toFixed(2)}`);
   st.reset();
  }
  // Practical bounded scenario, not a native speed ratio, memory ceiling, or
  // universal SQL termination assertion. Retain the existing30s file watchdog.
  assert.ok(performance.now()-started<30_000,'complete acquisition/three runs within unchanged30s bound');
 }finally{try{st?.finalize();}finally{try{db?.closeDeferred();}finally{await closeTestServer(server);}}}
});
