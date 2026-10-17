import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';

// expr.c TK_AGG_COLUMN/useSortingIdx: every nested leaf must read the
// saved row after VNext/EOF, not merely arguments that are whole columns.
test('module grouped computed arguments own sorter snapshots in every encoding',async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));
 try{for(const encoding of ['utf8','utf16le','utf16be']){
  const db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
  try{for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree'])for(const binary of [false,true]){
   const input=binary?"jsonb('[1,2,3]')":"'[1,2,3]'";
   const from=`${module}(${input})`;
   for(const [expression,expected] of [
    ['sum(value+1)',9n],['sum(value)',6n],
    ['sum(CASE WHEN value>0 THEN value ELSE 0 END)',6n],
    ['sum(coalesce(value,0)+1)',9n],['sum(CAST(value AS INTEGER)+1)',9n],
    ['sum(CASE WHEN value BETWEEN 1 AND 2 THEN value ELSE 0 END)',3n],
    ['sum(CASE WHEN value IN (1,3) THEN value ELSE 0 END)',4n],
    ['sum(-(value+1))',-9n],
   ]){
    const sql=`SELECT type,${expression} FROM ${from} WHERE type='integer' GROUP BY type`;
    const s=db.prepare(sql).statement;
    try{for(let pass=0;pass<2;pass++){
     assert.equal(await s.step(),'row',sql);assert.equal(s.column(0),'integer',sql);
     assert.equal(s.columnType(0),'text',sql);assert.equal(s.columnType(1),'integer',sql);
     assert.equal(s.column(1),expected,sql);assert.equal(await s.step(),'done',sql);
     if(pass===0)s.reset();
    }}finally{s.finalize();}
   }
  }}finally{db.closeDeferred();}
 }}finally{await closeTestServer(bridge.server);}
});
