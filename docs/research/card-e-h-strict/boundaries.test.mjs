import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../../src/index.ts';
import {loadSchemaGraph} from '../../../src/internal/schema.ts';
const receipt=JSON.parse(fs.readFileSync(new URL('./boundaries-native.json',import.meta.url)));
const pin=JSON.parse(fs.readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(receipt.sourceId,pin.sqliteSourceId);
const decode=cell=>cell.type==='integer'?BigInt(cell.value):cell.type==='text'?Buffer.from(cell.utf8Hex,'hex').toString('utf8'):cell.type==='blob'?new Uint8Array(Buffer.from(cell.hex,'hex')):cell.type==='real'?Buffer.from(cell.ieee754be,'hex').readDoubleBE():null;
async function fixture(v,fn){
 const bytes=fs.readFileSync(v.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://fixture.test/strict-boundary');await fn(db);}finally{await db?.close();globalThis.fetch=previous;}
}
for(const v of receipt.variants){
 test(`${v.encoding}: STRICT accepted types and PK identity metadata`,()=>fixture(v,async db=>{
  const graph=loadSchemaGraph(db);
  for(const [name,rows] of Object.entries(v.tables)){
   const table=graph.tables.get(name);assert.equal(table.strict,true);assert.ok(Object.isFrozen(table));
   assert.deepEqual(table.columns.map(c=>[c.name,c.declaredType,c.notNull]),rows.map(row=>[decode(row[1]),decode(row[2]),decode(row[3])===1n]),name);
  }
  assert.deepEqual(graph.tables.get('types').columns.map(c=>c.affinity),['integer','integer','real','text','blob','blob']);
 }));
 for(const [i,c] of v.cases.entries())test(`${v.encoding}: typed generated boundary query ${i} and reset`,()=>fixture(v,async db=>{
  const stmt=db.prepare(c.sql).statement;
  try{
   const check=async()=>{const rows=[];while(await stmt.step()==='row'){
    const row=c.rows[rows.length];assert.ok(row,'no surplus row');
    assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnType(i)),row.map(cell=>cell.type));
    rows.push(Array.from({length:stmt.columnCount},(_,i)=>stmt.column(i)));
   }assert.deepEqual(rows,c.rows.map(row=>row.map(decode)));};
   for(let j=0;j<c.bindings.length;j++)stmt.bind(j+1,c.bindings[j]);
   await check();stmt.reset();await check();
  }finally{stmt.finalize();}
 }));
}
for(const v of receipt.errors)test(`${v.encoding}/${v.kind}: native declaration error precedence`,()=>fixture(v,async db=>{
 assert.throws(()=>db.prepare('SELECT * FROM t'),error=>error.code===v.code&&error.kind==='sqlite'&&error.message.includes(v.message.split(' - ')[1]));
}));
