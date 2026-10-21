import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';

// Explicit native-FIRST artifact input; never silently skip missing evidence.
const directory=process.env.SELECT_IN_NATIVE_DIR;
assert.ok(directory,'SELECT_IN_NATIVE_DIR must name capture-selected-select-in.py output');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
function nativeValue(cell){
 switch(cell.type){
  case 'integer':return BigInt(cell.value);
  case 'real':return Buffer.from(cell.ieee754be,'hex').readDoubleBE();
  case 'null':return null;
  case 'text':return Buffer.from(cell.utf8Hex,'hex').toString('utf8');
  case 'blob':return new Uint8Array(Buffer.from(cell.hex,'hex'));
  default:return assert.fail(`unknown native type ${cell.type}`);
 }
}
for(const variant of capture.variants){
 test(`${variant.encoding}: scalar SELECT-IN unforced useful selected work`,async()=>{
  const bytes=fs.readFileSync(path.join(directory,variant.fixture));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   const oracle=variant.cases.useful;
   assert.match(oracle.eqp[0],/SEARCH t USING COVERING INDEX t_ab/);
   const st=db.prepare(oracle.sql).statement;
   try{
   for(let execution=0;execution<2;execution++){
    const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1),st.column(2)]);
    assert.deepEqual(rows,oracle.rows.map(row=>row.map(c=>c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():assert.fail(`unexpected fixture type ${c.type}`))));
    const work=privateAccounting(st);
    assert.ok(work.indexSeeks>0,'unforced useful selected IN must seek LHS index; residual-only correct rows are not delivery');
    assert.ok(work.inProbes>0,'selected IN probes must be executed');
    assert.ok(work.tableNext<100,'must not scan 2000 LHS rows');
    st.reset();
    await assert.rejects(async()=>{while(await st.step({maxWorkUnits:400})==='row'){}},error=>error.kind==='limit'&&/maxWorkUnits/.test(error.message));
    assert.throws(()=>st.reset(),error=>error.kind==='limit');
   }
   }finally{st.finalize()}
   const streaming=db.prepare('SELECT id FROM t INDEXED BY t_ab WHERE a IN(SELECT v FROM rhs)').statement;
   try{
    assert.equal(await streaming.step(),'row');
    const cancelled=new AbortController();cancelled.abort();
    await assert.rejects(()=>streaming.step({signal:cancelled.signal}),error=>error.kind==='cancelled');
    assert.throws(()=>streaming.reset(),error=>error.kind==='cancelled');
    const ids=[];while(await streaming.step()==='row')ids.push(streaming.column(0));
    assert.deepEqual(ids.sort((a,b)=>a<b?-1:a>b?1:0),oracle.rows.map(row=>nativeValue(row[0])));
   }finally{streaming.finalize()}
   const parameterized=db.prepare(variant.cases['param-one'].sql).statement;
   try{
    for(const name of ['param-one','param-two','param-one']){
     const expected=variant.cases[name];
     parameterized.clearBindings();
     expected.bindings.forEach((value,i)=>parameterized.bind(i+1,value));
     const rows=[];
     while(await parameterized.step()==='row')rows.push([parameterized.column(0),parameterized.column(1)]);
     assert.deepEqual(rows,expected.rows.map(row=>row.map(nativeValue)),name);
     assert.ok(privateAccounting(parameterized).indexSeeks>0,`${name}: selected LHS seeks`);
     parameterized.reset();
    }
   }finally{parameterized.finalize()}
   for(const name of ['forced','empty','null','range','range-desc','limit','affinity','join','left','two-slot','or']){
    const expected=variant.cases[name];
    const statement=db.prepare(expected.sql).statement;
    try{
     assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i)),expected.metadata.map(column=>({name:column.name,declaredType:column.decltype,database:column.database_name,table:column.table_name,origin:column.origin_name})),`${name}: metadata`);
     for(let execution=0;execution<2;execution++){
      const rows=[];
      while(await statement.step()==='row')rows.push(expected.rows[0]?.map((_,i)=>statement.column(i))??[]);
      assert.deepEqual(rows,expected.rows.map(row=>row.map(nativeValue)),name);
      if(['forced','range','range-desc','join','left','two-slot','or'].includes(name)){
       assert.ok(privateAccounting(statement).indexSeeks>0,`${name}: selected LHS seeks`);
       assert.ok(privateAccounting(statement).inProbes>0,`${name}: RHS probes`);
      }
      statement.reset();
     }
    }finally{statement.finalize()}
   }
  }finally{
   db?.closeDeferred();
   await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  }
 });
}
