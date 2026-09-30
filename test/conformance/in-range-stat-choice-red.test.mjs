import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import {openFixture, privateAccounting} from './public-api-adapter.mjs';

const capture=JSON.parse(fs.readFileSync(new URL('./cases/in-range-stat-native.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
assert.deepEqual(capture.variants.map(v=>[v.encoding,v.state]),['utf8','utf16le','utf16be'].flatMap(encoding=>['before','after'].map(state=>[encoding,state])),'stat oracle must contain six encoding/state snapshots');
for(const variant of capture.variants)for(const name of ['stat-choice','stat-choice-force-a','stat-choice-force-ab'])assert.ok(variant.cases[name],`${variant.encoding}/${variant.state}: missing native choice/control ${name}`);

for(const variant of capture.variants){
  test(`${variant.encoding}/${variant.state} stat-choice preserves pinned selected access and sorting`,async()=>{
    const expected=variant.cases['stat-choice'];
    assert.deepEqual(expected.eqp.slice(0,1),[variant.state==='before'?'SEARCH t USING INDEX t_a (a=?)':'SEARCH t USING COVERING INDEX t_ab (a=? AND b=?)']);
    assert.equal(expected.counters.sortOperations,variant.state==='before'?0:1);
    const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256,`${variant.encoding}/${variant.state}: native oracle fixture bytes`);
    const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
    await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
    let db;
    try{
      db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
      const st=db.prepare(capture.sql['stat-choice']).statement;
      // Both forced candidates must work irrespective of which one the unforced
      // planner chooses. This also exercises the controls on red before files.
      for(const [name,index,expectedProbes,expectSort] of [['stat-choice-force-a','t_a',0,false],['stat-choice-force-ab','t_ab',2,true]]){
        const oracle=variant.cases[name];
        assert.equal(oracle.eqp[0],index==='t_a'?'SEARCH t USING INDEX t_a (a=?)':'SEARCH t USING COVERING INDEX t_ab (a=? AND b=?)');
        assert.equal(oracle.counters.sortOperations,expectSort?1:0);
        const forced=db.prepare(capture.sql[name]).statement;
        try{
          const ids=[];while(await forced.step()==='row')ids.push(forced.column(0));
          assert.deepEqual(ids,oracle.rows.map(row=>BigInt(row[0].value)),`${name}: pinned native typed ordered integer rows`);
          const accounting=privateAccounting(forced);
          assert.ok(accounting.indexSeeks>0);
          assert.equal(accounting.inProbes,expectedProbes);
          assert.equal(accounting.sorterRows,expectSort?ids.length:0);
        }finally{forced.finalize()}
      }
      try{
        const rows=[];
        while(await st.step()==='row')rows.push(st.column(0));
        assert.deepEqual(rows,expected.rows.map(row=>BigInt(row[0].value)),`${variant.encoding}/${variant.state}: unforced native typed ordered integer rows`);
        const work=privateAccounting(st);
        assert.ok(work.indexSeeks>0,'must use selected access rather than scan-equivalent credit');
        assert.equal(work.sorterRows,variant.state==='before'?0:rows.length,'pinned access chooses rowid order before ANALYZE and covering IN with sorter after');
        assert.equal(work.inProbes,variant.state==='before'?0:2,'the selected prefix must reflect pinned t_a vs t_ab access');
      }finally{st.finalize()}
    }finally{
      try{db?.closeDeferred()}catch{}
      await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    }
  });
}
