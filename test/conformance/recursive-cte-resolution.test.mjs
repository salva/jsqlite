import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const prefix='WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) ';
for(const enc of ['UTF-8','UTF-16le','UTF-16be'])test(`direct recursive linked resolution ${enc}`,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(`../fixtures/recursive-join/${enc}-corrected.sqlite`,import.meta.url)));
 let db;try{db=await open('https://fixture.invalid/cf02');
 for(const tail of ['SELECT n FROM c','SELECT c.n FROM c','SELECT a.n FROM c a']){
  const s=db.prepare(prefix+tail).statement;try{assert.deepEqual(s.columnMetadata(0),{name:'n',declaredType:null,database:null,table:null,origin:null});for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row'){assert.equal(s.columnType(0),'integer');rows.push(s.column(0));}assert.deepEqual(rows,[1n,2n,3n]);s.reset();}}finally{s.finalize();}
 }
 for(const [tail,message] of [
  ['SELECT wrong.n FROM c','no such column: wrong.n'],
  ['SELECT c.n FROM c a','no such column: c.n'],
  ['SELECT main.c.n FROM c','no such column: main.c.n'],
  ['SELECT n AS x,x FROM c','no such column: x'],
  ['SELECT wrong.n FROM c LIMIT 0','no such column: wrong.n'],
  ['SELECT wrong.n,missing FROM c','no such column: wrong.n'],
  ['SELECT n FROM c a JOIN c b ON a.n=b.n','ambiguous column name: n'],
  ['SELECT EXISTS(SELECT wrong.n FROM c)','no such column: wrong.n'],
 ])assert.throws(()=>db.prepare(prefix+tail),e=>e.kind==='sqlite'&&e.code===1&&e.message===message,tail);
 for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){const s=db.prepare(prefix+'SELECT a.n FROM c a').statement;try{await assert.rejects(s.step(options),e=>e.kind===kind);assert.throws(()=>s.reset(),e=>e.kind===kind);assert.equal(await s.step(),'row');}finally{s.finalize();}}
 const bound=db.prepare('WITH RECURSIVE c(n) AS (VALUES(?1) UNION ALL SELECT n+1 FROM c WHERE n<?2) SELECT a.n FROM c a LIMIT ?3').statement;
 try{for(const start of [1n,3n]){bound.bind(1,start);bound.bind(2,3n);bound.bind(3,2n);const rows=[];while(await bound.step()==='row')rows.push(bound.column(0));assert.deepEqual(rows,start===1n?[1n,2n]:[3n]);bound.reset();}}finally{bound.finalize();}
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});
