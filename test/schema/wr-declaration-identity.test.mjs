import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {open} from '../../src/index.ts';
const folder=process.env.WR_FIXTURES;
const receipt=JSON.parse(fs.readFileSync(path.join(folder,'native.json')));
for(const control of receipt.controls)test(`native schema rejection ${control.file}`,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(fs.readFileSync(path.join(folder,control.file)));let db;
 try{db=await open('https://wr.test/corrupt.db');assert.throws(()=>db.prepare(control.sql),e=>{assert.equal(e.code,control.result.error.code);assert.equal(e.message,control.result.error.message);return true;});}
 finally{db?.close();globalThis.fetch=old}
});
const source=fs.readFileSync(new URL('../../src/internal/schema.ts',import.meta.url),'utf8');
test('WR post-construction consumers use retained declaration, rowid fallback stays explicit',()=>{
 assert.match(source,/table\.withoutRowid\s*\? withoutRowidDefinitions.get\(table\)!/);
 assert.equal((source.match(/implicitIndexDefinitions\(table,parseDdl\(table.sql/g)||[]).length,1);
 assert.ok(!source.includes('const ddl=parseDdl(table.sql'));
 assert.equal((source.match(/attachmentDefinitions\(table\)/g)||[]).length,3);
});
for(const fixture of receipt.files)test(`retained WR declaration/root/column identities ${fixture.file}`,async()=>{
 const bytes=fs.readFileSync(path.join(folder,fixture.file));
 const owner=ImmutableStorage.open(bytes),carrier={[storageOwner]:owner};
 try{
  assert.throws(()=>loadSchemaGraph(carrier,{check:phase=>{if(phase==='finalize')throw new Error('cancel')}}),/cancel/);
  assert.equal(owner.schemaBytes,0);
  const graph=loadSchemaGraph(carrier);
  const reopenedOwner=ImmutableStorage.open(bytes);
  try{const reopened=loadSchemaGraph({[storageOwner]:reopenedOwner});assert.notEqual(reopened,graph);assert.deepEqual([...reopened.indexes.keys()],[...graph.indexes.keys()]);}finally{reopenedOwner.close()}
  for(const expected of fixture.tables){
   const table=graph.tables.get(expected.name);assert.ok(table);
   assert.deepEqual(table.indexes.map(i=>i.name),expected.indexes.map(i=>i[1]));
   for(const index of table.indexes){
    assert.equal(index.table,table);assert.ok(Object.isFrozen(index));
    if(index.origin==='primary-key')assert.equal(index.rootPage,table.rootPage);
    for(const term of index.terms)assert.equal(term.column,table.columns.find(c=>c.name===term.column.name));
    const native=expected.xinfo[index.name].filter(row=>row[5]==='1');
    assert.deepEqual(index.terms.map(t=>[t.column.name,t.descending?'1':'0',t.collation??'BINARY']),native.map(r=>[r[2],r[3],r[4]]));
   }
  }
  assert.equal(loadSchemaGraph(carrier),graph);
 }finally{owner.close()}
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);
 let db;
 try{
  db=await open('https://wr.test/catalog.db');
  for(const expected of fixture.reads){
   const s=db.prepare(expected.sql).statement;const rows=[];
   try{
    assert.deepEqual(expected.columns.map((_,i)=>s.columnMetadata(i)),expected.columns);
    while(await s.step()==='row')rows.push(expected.columns.map((_,i)=>{const type=s.columnType(i),value=s.column(i);return {type,value:type==='integer'?String(value):type==='blob'?Buffer.from(value).toString('hex'):value};}));
   }finally{s.finalize()}
   assert.deepEqual(rows,expected.rows);
  }
 }finally{db?.close();globalThis.fetch=old}
});
