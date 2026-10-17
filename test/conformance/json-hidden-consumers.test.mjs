import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {Mem} from '../../src/internal/mem.ts';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';

// Exercise resolved moduleRows and sourceRow/AggInfo producers, not just the
// single-source legacy binder. Count production copies of this exact document.
test('resolved JSON producer demand survives joins, aggregate and Window consumers',async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));
 const original=Mem.prototype.copyFrom;let active=false,copies=0,s,db;
 const document='['+Array.from({length:64},(_,i)=>i).join(',')+']';
 Mem.prototype.copyFrom=function(source){if(active&&source.initialStorageClass==='text'&&source.textValue()===document)copies++;return original.call(this,source);};
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select4-t1`));
  const cases=[
   [`SELECT j.value FROM t1 JOIN json_each('${document}') j WHERE t1.n=1`,64,false],
   [`SELECT sum(j.value) FROM t1 JOIN json_each('${document}') j WHERE t1.n=1`,1,false],
   [`SELECT t1.n,sum(j.value) FROM t1 JOIN json_each('${document}') j WHERE t1.n=1 GROUP BY t1.n`,1,false],
   [`SELECT j.json FROM t1 JOIN json_each('${document}') j WHERE t1.n=1`,64,true],
   [`SELECT max(j.json) FROM t1 JOIN json_each('${document}') j WHERE t1.n=1`,1,true],
   [`SELECT value,row_number() OVER (ORDER BY value) FROM (SELECT j.value FROM t1 JOIN json_each('${document}') j WHERE t1.n=1)`,64,false],
   [`SELECT json,row_number() OVER (ORDER BY json) FROM (SELECT j.json FROM t1 JOIN json_each('${document}') j WHERE t1.n=1)`,64,true],
   [`SELECT a.value FROM json_each('${document}') a JOIN json_each('[0]') b ON 1`,64,false],
   [`SELECT j.json FROM t1 JOIN json_each('${document}') j WHERE t1.n=1 AND length(j.json)>0 ORDER BY j.root,j.value`,64,true],
  ];
  for(const [sql,expectedRows,hidden] of cases){
   s=db.prepare(sql).statement;copies=0;active=true;let rows=0;
   try{while(await s.step()==='row'){rows++;if(hidden)assert.equal(s.column(0),document);}}finally{active=false;}
   assert.equal(rows,expectedRows,sql);assert.ok(hidden?copies>=64:copies<=31,`${copies} copies: ${sql}`);
   s.finalize();s=undefined;
  }
 }finally{active=false;Mem.prototype.copyFrom=original;try{s?.finalize()}catch{}db?.closeDeferred();await closeTestServer(bridge.server);}
});
