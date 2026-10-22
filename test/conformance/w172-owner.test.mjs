import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {parseSql} from '../../src/internal/parse.ts';
import {compileScalarSelect} from '../../src/internal/vdbe.ts';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {btreeFromStorage} from '../../src/internal/btree.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
const receipt=JSON.parse(fs.readFileSync(new URL('../../docs/research/w172-owner-native.json',import.meta.url)));
const fixtureRoot=path.resolve('test/fixtures/generations',receipt.generation,'generated');
const typed=(type,value)=>type==='null'?{type}:{type,value:type==='integer'?String(value):value};
for(const variant of receipt.variants)test(`W172 semantic owners: native metadata/types/reset and distinct cursors ${variant.encoding}`,async()=>{
 for(const family of ['subquery','encoding']){
  const bytes=fs.readFileSync(path.join(fixtureRoot,`${family}-${variant.encoding}.db`));
  const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
  const storage=ImmutableStorage.open(bytes);
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
   const schema=loadSchemaGraph({[storageOwner]:storage}),database=btreeFromStorage(storage);
   for(const c of variant.cases.filter(c=>c.family===family)){
    // Inspect the actual emitted ordinary-child branch, not a source regex.
    const program=compileScalarSelect(parseSql(c.sql).statement,database.encoding,undefined,undefined,undefined,schema,database);
    if(c.sql.includes(' IN ')){
     const sets=program.ops.filter(op=>op.code==='InSet');assert.equal(sets.length,1);
     const cursor=sets[0].p1;
     assert.ok(program.ops.some(op=>op.code==='OpenEphemeral'&&op.p1===cursor));
     assert.ok(program.ops.some(op=>op.code==='IdxInsert'&&op.p1===cursor));
     const readers=program.ops.filter(op=>op.code==='OpenRead');assert.ok(readers.length>0);
     for(const reader of readers)assert.notEqual(reader.p1,cursor,'live RHS table reader must not reopen IN Set');
     if(c.sql.includes('DISTINCT'))assert.ok(program.ops.filter(op=>op.code==='OpenEphemeral').length>=2,'DISTINCT and IN retain separate owned sets');
    }
    const stmt=db.prepare(c.sql).statement;
    try{
     assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i)),c.metadata,c.sql);
     for(const expected of c.runs){
      const rows=[];let error;
      try{while(await stmt.step()==='row')rows.push(Array.from({length:stmt.columnCount},(_,i)=>typed(stmt.columnType(i),stmt.column(i))));}catch(e){error=e;}
      assert.deepEqual(rows,expected.rows,c.sql);
      if(expected.end===101){assert.equal(error,undefined);stmt.reset();}
      else{assert.equal(error?.code,expected.end);assert.equal(error?.message,expected.error);assert.throws(()=>stmt.reset(),e=>e===error);}
     }
    }finally{stmt.finalize();}
   }
  }finally{storage.close();db?.closeDeferred();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
 }
});
