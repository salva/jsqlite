import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {PrivateBlobkeyPages} from '../../src/internal/private-blobkey-pages.ts';
const directory=process.env.SELECT_IN_REUSE_MATRIX_DIR;
assert.ok(directory,'SELECT_IN_REUSE_MATRIX_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceid,manifest.sqliteSourceId);assert.equal(capture.version,manifest.version);
const decode=cell=>cell.type==='null'?null:cell.type==='integer'?BigInt(cell.value):cell.type==='real'?Buffer.from(cell.ieee754be,'hex').readDoubleBE():cell.type==='text'?Buffer.from(cell.utf8Hex,'hex').toString('utf8'):cell.type==='blob'?new Uint8Array(Buffer.from(cell.hex,'hex')):assert.fail(cell.type);
for(const variant of capture.variants)test(`${variant.encoding}: typed persistent RHS, compatibility gates and useful composite range`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const original=PrivateBlobkeyPages.open;let opens=0,db,st;
 PrivateBlobkeyPages.open=async function(...args){opens++;return original.apply(this,args)};
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  const measured=new Map();
  for(const c of variant.cases){
   const scan=c.name==='useful-scan';
   if(!scan)assert.equal(c.ops.some(op=>op.opcode==='OpenEphemeral'),!c.reuse,c.name);
   assert.equal(c.ops.some(op=>op.opcode==='SorterOpen'),false,c.name);
   st=db.prepare(c.sql).statement;
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),c.metadata,c.name+' metadata');
   const runs=c.bindingRuns.length?c.bindingRuns:[{bindings:c.bindings,rows:c.rows},{bindings:c.bindings,rows:c.rows}];
   for(const run of runs){
    st.clearBindings();run.bindings.forEach((v,i)=>st.bind(i+1,v));
    opens=0;const rows=[],types=[];while(await st.step()==='row'){
     rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     types.push(Array.from({length:st.columnCount},(_,i)=>st.columnType(i)));
    }
    assert.deepEqual(rows,run.rows.map(row=>row.map(decode)),c.name);
    assert.deepEqual(types,run.rows.map(row=>row.map(cell=>cell.type)),c.name+' storage classes');
    const work=privateAccounting(st);measured.set(c.name,{...work,rows});
    assert.equal(work.sorterRows,0,c.name);
    if(c.name==='inner-residual'||c.name==='left-residual')assert.ok(work.residualTests>0,c.name+' retains unrelated predicate');
    if(!scan){
     if(c.reuse){assert.equal(opens,0,`${c.name}: ${JSON.stringify(work)}`);if(!['parameter-residual','inner','left','inner-residual','left-residual'].includes(c.name))assert.equal(work.residualTests,0,c.name);}
     else assert.ok(opens>0,c.name+' must produce fallback');
     if(c.name==='empty'||run.bindings.some(v=>v===null)){assert.equal(work.indexSeeks,0,c.name);}
     else{assert.ok(work.indexSeeks>0,c.name);assert.ok(work.inProbes>0,c.name);}
    }
    await st.reset();
   }
   await st.finalize();st=undefined;
  }
  const selected=measured.get('useful-range'),scan=measured.get('useful-scan');
  // Independent full EXPLAIN establishes RHS physical reuse, actual public
  // counters establish bounded LHS work; native VM steps are not TS credit.
  assert.equal(selected.rows.length,40);
  assert.deepEqual([...selected.rows].sort((a,b)=>Number(a[0]-b[0])),scan.rows);
  assert.equal(selected.indexSeeks,2);assert.equal(selected.inProbes,2);
  assert.ok(selected.indexNext>=40&&selected.indexNext<100,`indexNext=${selected.indexNext}`);
  assert.equal(selected.tableSeeks,40);assert.equal(selected.tableNext,0);
  assert.equal(scan.indexSeeks,0);
  // This counter includes the three rows of fallback membership production
  // (NULL included) as well as the 20k LHS scan; it is not table-local.
  assert.equal(scan.tableNext,20003);
 }finally{PrivateBlobkeyPages.open=original;try{await st?.finalize()}finally{db?.closeDeferred();await new Promise(r=>server.close(r))}}
});
