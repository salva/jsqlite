import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {IndexCursor} from '../../src/internal/btree.ts';

test('selected page-local skipscan corruption and untouched offpath index', {skip:process.env.SKIPSCAN_COPY_PROOF!=='1'&&process.env.SKIPSCAN_DEFAULT_PROOF!=='1'},async()=>{
 const evidence=path.join(process.env.SKIPSCAN_NATIVE_ROOT,process.env.SKIPSCAN_CORRUPTION_CAPTURE??'corruption-companions'),capture=JSON.parse(fs.readFileSync(path.join(evidence,'native.json'),'utf8'));
 const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url),'utf8'));assert.equal(capture.sourceId,pin.sqliteSourceId);
 const root=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'skipscan-corruption-public'),generation='corruption',dir=path.join(root,'generations',generation);fs.mkdirSync(dir,{recursive:true});
 const fixtures=capture.variants.map((v,i)=>{const bytes=fs.readFileSync(path.join(evidence,v.fixture));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);fs.writeFileSync(path.join(dir,`${i}.db`),bytes);return{id:`c${i}`,path:`${i}.db`,bytes:bytes.length};});
 fs.writeFileSync(path.join(root,'CURRENT.json'),JSON.stringify({generationId:generation}));fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify({semantic:{fixtures}}));
 const bridge=await startFixtureServer(root),original=IndexCursor.prototype.seekKey;let calls=[],failures=[];
 IndexCursor.prototype.seekKey=function(values,info,direction){calls.push([direction,values.length]);try{return original.call(this,values,info,direction);}catch(e){failures.push([direction,values.length]);for(const v of values)assert.equal(v.diagnostic().manifest,'null','failed seek releases operand copies');throw e;}};
 try{for(const [i,v] of capture.variants.entries()){
  if(v.stepRc!==11&&v.stepRc!==101)continue; // Native interrupt9 is not corruption-equivalence evidence.
  const db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/c${i}`));
  try{const statement=db.prepare(v.sql).statement;assert.ok(statement);
   try{for(let run=0;run<2;run++){
    calls=[];failures=[];const rows=[];let error=null;
    try{while(await statement.step()==='row')rows.push([{type:'integer',value:String(statement.columnInteger(0))}]);}catch(e){error=e;}
    assert.deepEqual(rows,v.rows,`${v.encoding}/${v.kind}/rows`);
    if(v.kind==='late-leaf'){assert.deepEqual(failures,[['gt',1]],'error belongs to strict prefix restart descent, not suffix or next');assert.ok(rows.length>0);assert.ok(calls.filter(([d,n])=>d==='gt'&&n===1).length>1,'actual restart iterations before late descent failure');}
    if(v.stepRc===11){assert.equal(error?.code,11,`${v.encoding}/${v.kind}`);assert.throws(()=>statement.reset(),e=>e.code===11);}
    else{assert.equal(error,null);assert.ok(calls.some(([d,n])=>d==='gt'&&n===1));statement.reset();}
   }}finally{statement.finalize();}
  }finally{db.close();}
 }}finally{IndexCursor.prototype.seekKey=original;await new Promise(resolve=>bridge.server.close(resolve));}
});
