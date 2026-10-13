import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-e-mixed-json-native.json',import.meta.url)));
const root=new URL('../fixtures/',import.meta.url).pathname;
for(const entry of capture.cases)test(`mixed physical JSON pinned ${entry.encoding} ${entry.id}`,async()=>{
 const encoding=entry.encoding;
 const bridge=await startFixtureServer(root);let db;
 try{db=await open(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`);
 {
  let s;try{
   s=db.prepare(entry.sql).statement;
   assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),entry.columns,entry.id+' metadata');
   for(let pass=0;pass<2;pass++){
    const rows=[];
    if(entry.error){let first;await assert.rejects(s.step(),e=>{first=e;return e.kind==='sqlite'&&e.code===entry.error.code&&e.message===entry.error.message});assert.throws(()=>s.reset(),e=>e===first);break;}
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const type=s.columnType(i),value=s.column(i);return{type,value:type==='integer'?String(value):type==='blob'?Buffer.from(value).toString('hex'):value}}));
    assert.deepEqual(rows,entry.rows,entry.id);if(!pass)s.reset();
   }
  }finally{s?.finalize();}
 }
 }finally{db?.close();bridge.server.closeAllConnections();await new Promise(resolve=>bridge.server.close(resolve));}
});

test('mixed LEFT cursor control errors release state and statement admission',async()=>{
 const bridge=await startFixtureServer(root);let db;
 try{
  const url=`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-utf8`;
  for(const schedule of ['work','private','cancel']){
   db=await open(url,schedule==='private'?{limits:{maxPrivateBytes:64}}:{});
   let s=db.prepare(`SELECT j.atom FROM t1 t LEFT JOIN json_tree(?1) j ON 1`).statement;s.bind(1,'[1,2,3]');
   const controller=new AbortController();controller.abort('mixed cursor');
   const options=schedule==='work'?{maxWorkUnits:1}:schedule==='cancel'?{signal:controller.signal}:{};
   const first=await s.step(options).then(()=>null,e=>e);assert.equal(first?.kind,schedule==='cancel'?'cancelled':'limit');
   await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
   // reset releases the failed execution while returning its saved error.
   s.bind(1,'[]');if(schedule!=='private'){assert.equal(await s.step(),'row');assert.equal(s.column(0),null);}s.finalize();
   const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();db.close();db=undefined;
  }
 }finally{db?.closeDeferred();bridge.server.closeAllConnections();await new Promise(resolve=>bridge.server.close(resolve));}
});
