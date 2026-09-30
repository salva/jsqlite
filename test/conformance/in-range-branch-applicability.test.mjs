import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';

const matrix=JSON.parse(fs.readFileSync(new URL('./cases/in-range-branch-applicability.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
const bytes=fs.readFileSync(new URL(`../../${matrix.cases[0].fixture}`,import.meta.url));
test('review-v6 original branch dispositions have executable source-mapped coverage',async()=>{
  assert.equal(matrix.sourceId,manifest.sqliteSourceId);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),matrix.fixtureSha256);
  const doc=fs.readFileSync(new URL('../../docs/TRANSLATION.md',import.meta.url),'utf8');
  const source=fs.readFileSync(new URL('../../docs/SQLITE_SOURCE_MAP.md',import.meta.url),'utf8');
  const baseline=fs.readFileSync(new URL('./in-range-selected-red.test.mjs',import.meta.url),'utf8');
  assert.match(baseline,/three-slot selected IN/);
  for(const marker of ['fourth-IN-slot','subquery-IN-RHS','selected-versus-residual','multi-source-prerequisite','forced-index-traversal','prepare-unsupported'])assert.ok(doc.includes(marker)&&source.includes(marker),`${marker}: missing source-backed disposition in living guide/map`);
  assert.ok(matrix.cases.length>=6);
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
    for(const c of matrix.cases){
      if(c.disposition==='unsupported'){
        assert.throws(()=>db.prepare(c.sql),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary',`${c.dimension}: atomic temporary unsupported`);
        continue;
      }
      const st=db.prepare(c.sql).statement;
      try{
        const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
        assert.deepEqual(rows,c.expected.map(row=>row.map(decode)),c.dimension);
        const count=privateAccounting(st);
        if(c.disposition==='selected')assert.ok(count.indexSeeks>0,`${c.dimension}: selected index seek`);
        else assert.equal(count.indexSeeks,0,`${c.dimension}: safe residual traversal, not selected seek`);
      }finally{st.finalize()}
    }
  }finally{try{db?.closeDeferred()}catch{}await new Promise(r=>server.close(r))}
});
