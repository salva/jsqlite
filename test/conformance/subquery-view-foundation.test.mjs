import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const here=path.dirname(new URL(import.meta.url).pathname);
const capture=JSON.parse(fs.readFileSync(path.join(here,'cases/stage3-subquery-view.json'),'utf8'));
const current=JSON.parse(fs.readFileSync(path.join(here,'../fixtures/CURRENT.json'),'utf8'));
const generated=path.join(here,'../fixtures/generations',current.generationId,'generated');
const ids=[
  'derived-basic','derived-nested','derived-limit-materialized','derived-join','derived-group-order','derived-compound',
  'view-basic','view-nested','view-correlated','view-metadata','view-explicit-columns','view-inferred-columns',
  'view-duplicate-inferred','view-explicit-width-error','view-inherited-collation',
  'aggregate30-sum-real-promotion','aggregate30-sum-int64-overflow','aggregate30-total-no-overflow',
  'aggregate30-group-concat-null-separator',
];

function value(v){
  if(v.type==='null')return null;
  if(v.type==='integer')return BigInt(v.value);
  if(v.type==='real'){
    if(v.ieee754be){const bytes=Buffer.from(v.ieee754be,'hex');return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getFloat64(0,false);}
    return Number(v.value);
  }
  if(v.type==='text')return Buffer.from(v.utf8Hex,'hex').toString();
  if(v.type==='blob')return new Uint8Array(Buffer.from(v.hex,'hex'));
  throw Error(`unknown captured value ${v.type}`);
}
function metadata(statement){
  return Array.from({length:statement.columnCount},(_,index)=>{
    const column=statement.columnMetadata(index);
    return{name:column.name,declaredType:column.declaredType,database:column.database,table:column.table,origin:column.origin};
  });
}
async function serve(encoding){
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));
  const empty=fs.readFileSync(path.join(generated,'empty.db'));
  const server=http.createServer((request,response)=>{const selected=request.url==='/empty'?empty:body;response.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':selected.length});response.end(selected)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  return server;
}

for(const encoding of ['utf8','utf16le','utf16be'])for(const id of ids)test(`public ${encoding} ${id} matches pinned SQLite 3.53.4`,async()=>{
  const server=await serve(encoding);let db,emptyDb,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    const expected=capture.cases.find(item=>item.id===id);assert.ok(expected,id);
    const target=expected.fixture==='empty'?(emptyDb=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/empty`))):db;
    if(expected.native.prepare.kind==='error'){
      assert.throws(()=>target.prepare(expected.sql),error=>error.kind==='sqlite'&&error.code===expected.native.prepare.code&&error.message===expected.native.prepare.message,id);
      return;
    }
    statement=target.prepare(expected.sql).statement;
    assert.deepEqual(metadata(statement),expected.native.columns,`${id} metadata`);
    const rows=[];
    if(expected.native.first.kind==='error'){
      await assert.rejects(async()=>{while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));},error=>error.kind==='sqlite'&&error.code===expected.native.first.error.code&&error.message===expected.native.first.error.message,id);
      assert.deepEqual(rows,expected.native.first.partialRows.map(row=>row.map(value)),`${id} partial rows`);
    }else{
      while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
      assert.deepEqual(rows,expected.native.first.rows.map(row=>row.map(value)),`${id} rows`);
    }
    if(expected.native.finalizeCode===0){statement.finalize();statement=undefined;}
    else{assert.throws(()=>statement.finalize(),error=>error.kind==='sqlite'&&error.code===expected.native.finalizeCode,`${id} finalize code`);statement=undefined;}
  }finally{
    try{statement?.finalize()}catch{}
    try{emptyDb?.closeDeferred()}catch{}
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
