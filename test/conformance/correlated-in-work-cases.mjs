import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const directory=process.env.CORRELATED_IN_WORK_DIR;
assert.ok(directory,'CORRELATED_IN_WORK_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceid,pin.sqliteSourceId);assert.equal(capture.version,pin.version);
// Keep 20k LHS cardinality. Bound correlated residual rebuilding by the same
// outer predicate on BOTH paths, rather than disguising scan limit failures.
export function registerCorrelatedInWork(encoding){
 const variants=capture.variants.filter(variant=>variant.encoding===encoding);
 assert.equal(variants.length,1,`exactly one native fixture for ${encoding}`);
 for(const variant of variants)test(`${variant.encoding}: bounded 20k correlated selected/scan work`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:{maxWorkUnits:1000000000}});
  const works={};
  // G67-1: native wherecode.c rejects the ready false restriction before
  // TERM_VARSELECT, regardless of conjunct order. Keep the actual 20k DB.
  const correlated='(SELECT abs(-9223372036854775808) FROM rhs WHERE rhs.k=o.k)=1';
  for(const access of ['NOT INDEXED','INDEXED BY t_ab'])for(const condition of [
   `${correlated} AND o.k<0`,`o.k<0 AND ${correlated}`,
  ]){
   st=db.prepare(`SELECT o.k,t.id FROM outer_t o CROSS JOIN t ${access} WHERE ${condition}`).statement;
   for(let run=0;run<2;run++){
    assert.equal(st.columnCount,2);
    assert.deepEqual([0,1].map(index=>st.columnMetadata(index).name),['k','id']);
    assert.equal(await st.step(),'done');
    assert.equal(privateAccounting(st).tableSeeks,0);
    await st.reset();
   }
   st.finalize();st=undefined;
  }
  // A ripe true restriction must not suppress the error; reset reports the
  // prior failure, then a fresh execution must still fail (no cached result).
  st=db.prepare(`SELECT o.k,t.id FROM outer_t o CROSS JOIN t NOT INDEXED WHERE ${correlated} AND o.k<=2`).statement;
  for(let run=0;run<2;run++){
   await assert.rejects(st.step(),error=>error.kind==='sqlite'&&error.message==='integer overflow');
   assert.throws(()=>st.reset(),error=>error.kind==='sqlite'&&error.message==='integer overflow');
  }
  st.finalize();st=undefined;
  for(const c of variant.cases){
   st=db.prepare(c.sql).statement;
   for(let run=0;run<2;run++){
    const rows=[],types=[];
    while(await st.step()==='row'){rows.push([st.column(0),st.column(1)]);types.push([st.columnType(0),st.columnType(1)]);}
    assert.deepEqual(rows,c.rows.map(row=>row.map(cell=>BigInt(cell.value))));
    assert.deepEqual(types,c.rows.map(row=>row.map(cell=>cell.type)));
    const work=privateAccounting(st);works[c.name]=work;
    if(c.name==='selected'){
     assert.ok(work.indexSeeks>0&&work.inProbes>0);
     assert.ok(work.indexSeeks<=40&&work.tableSeeks<=4&&work.tableNext<2000,JSON.stringify(work));
    }else{
     assert.equal(work.indexSeeks,0);assert.equal(work.inProbes,0);
     assert.ok(work.tableNext>=40000,JSON.stringify(work));
     // wherecode.c ripe-term frontier: o.k<=2 must reject the other 18
     // outer rows before entering t. Includes real RHS Btree scan work;
     // retain the original lower bound and selected/scan ratio checks.
     assert.ok(work.tableNext<=120020,`outer WHERE frontier: ${JSON.stringify(work)}`);
    }
    await st.reset();
   }
   st.finalize();st=undefined;
  }
  assert.ok(works.scan.tableNext>works.selected.tableNext*20);
 }finally{await st?.finalize();db?.closeDeferred();await new Promise(r=>server.close(r))}
});
}
