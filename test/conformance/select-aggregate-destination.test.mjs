import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

const sql='SELECT y%2 AS k, count(*) AS n FROM t1 GROUP BY y%2 ORDER BY k';
test('group destination retains pinned typed rows, metadata and reset',async()=>{
 const server=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.port}/fixture/${server.token}/expr-relational`));
  const s=db.prepare(sql).statement;
  try{
   assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),['k','n']);
   for(let iteration=0;iteration<2;iteration++){
    const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i)]));
    assert.deepEqual(rows,[[['integer',0n],['integer',16n]],[['integer',1n],['integer',16n]]]);
    assert.equal(await s.step(),'done');if(iteration===0)s.reset();
   }
  }finally{s.finalize()}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.server.close(e=>e?reject(e):resolve()))}
});

test('aggregate producer reserves all live register ranges through shared builder',()=>{
 const text=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const producer=text.slice(text.indexOf('export function compileAggregateSelect('),text.indexOf('export class VdbeStatement'));
 assert.match(producer,/SelectProgramBuilder/);
 assert.doesNotMatch(producer,/registers\s*\+=/,'aggregate direct range increments can overtake builder allocations');
});
