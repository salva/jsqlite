import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {Mem} from '../../src/internal/mem.ts';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';

// Production allocation witness: count only real owning copies of the exact
// document, not inspection allocations or aggregate heap estimates.
for(const encoding of ['utf8','utf16le','utf16be'])test(`undemanded JSON document is not copied per row: ${encoding}`,async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));
 const original=Mem.prototype.copyFrom;let active=false,copies=0,statement,db;
 const document='['+Array.from({length:64},(_,i)=>i).join(',')+']';
 Mem.prototype.copyFrom=function(source){if(active&&source.initialStorageClass==='text'&&source.textValue()===document)copies++;return original.call(this,source);};
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
  for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree'])for(const projection of ['value','root','*','json']){
   statement=db.prepare(`SELECT ${projection} FROM ${module}('${document}')`).statement;
   const descriptors=Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i));
   for(let run=0;run<2;run++){
    copies=0;let rows=0;active=true;
    try{while(await statement.step()==='row'){rows++;if(projection==='json'){assert.equal(statement.columnType(0),'text');assert.equal(statement.column(0),document);}}}finally{active=false;}
    assert.equal(rows,module.endsWith('tree')?65:64);
    assert.ok(projection==='json'?copies>=rows:copies<=(module.endsWith('tree')&&(projection==='value'||projection==='*')?3:1),`${module}/${projection}: ${copies} document copies for ${rows} rows`);
    assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i)),descriptors);
    statement.reset();
   }
   statement.finalize();statement=undefined;
  }
 }finally{active=false;Mem.prototype.copyFrom=original;try{statement?.finalize()}catch{}db?.closeDeferred();await closeTestServer(bridge.server);}
});
