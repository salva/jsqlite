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
const ids=['view-basic','view-nested','view-explicit-columns','view-inferred-columns','view-duplicate-inferred','view-explicit-width-error','view-metadata','view-inherited-collation','lexical-shadow','error-ambiguous','error-missing','error-width-scalar'];

function value(v){
  if(v.type==='null')return null;
  if(v.type==='integer')return BigInt(v.value);
  if(v.type==='real')return Number(v.value);
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
  const server=http.createServer((request,response)=>{response.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':body.length});response.end(body)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  return server;
}

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} immutable-view column expansion matches pinned SQLite 3.53.4`,async()=>{
  const server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    for(const id of ids){
      const expected=capture.cases.find(item=>item.id===id);assert.ok(expected,id);
      if(expected.native.prepare.kind==='error'){
        assert.throws(()=>db.prepare(expected.sql),error=>error.kind==='sqlite'&&error.code===expected.native.prepare.code&&error.message===expected.native.prepare.message,id);
        continue;
      }
      statement=db.prepare(expected.sql).statement;
      assert.deepEqual(metadata(statement),expected.native.columns,`${id} metadata`);
      const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
      assert.deepEqual(rows,expected.native.first.rows.map(row=>row.map(value)),`${id} rows`);
      statement.finalize();statement=undefined;
    }
  }finally{
    try{statement?.finalize()}catch{}
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
