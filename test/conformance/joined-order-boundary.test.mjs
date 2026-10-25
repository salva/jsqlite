import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere} from '../../src/internal/where-plan.ts';
const native=JSON.parse(fs.readFileSync(new URL('./cases/joined-order-boundary-native.json',import.meta.url)));
assert.equal(native.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
const decode=c=>c.type==='integer'?BigInt(c.value):c.type==='null'?null:c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
for(const v of native.variants)test(`joined partial/full ORDER caller ${v.id}`,async()=>{
 const bytes=fs.readFileSync(v.fixture.path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));
  const schema=loadSchemaGraph(db),table=schema.tables.get('m');
  for(const c of v.cases){
   // Mirror the caller's represented order requirements, not a SQL-text shortcut.
   const resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema);
   const col=name=>table.columns.find(col=>col.name===name);
   const order=[{sourceOrdinal:0,column:col(c.kind==='partial'?'a':'id'),descending:false,collation:'binary'},{sourceOrdinal:1,column:col('b'),descending:true,collation:'binary'}];
   const selected=planWhere(resolved,{neededColumns:resolved.sources.map(()=>new Set(table.columns)),orderBy:order});
   assert.equal(selected.path.orderTermsSatisfied,c.kind==='partial'?1:2);
   assert.deepEqual(selected.path.loops.map(l=>l.sourceOrdinal),[0,1]);
   assert.equal(selected.path.loops[1].capability.physicalIndex.index.name,'m_abc');
   if(c.kind==='partial'){
    assert.equal(col('a').notNull,false);
    assert.equal(selected.path.loops[0].capability.physicalIndex.index.unique,false);
   }
   const st=db.prepare(c.sql).statement;
   try{for(let run=0;run<2;run++){
    c.metadata.forEach((m,i)=>assert.deepEqual(st.columnMetadata(i),{name:m.name,declaredType:m.decltype,database:m.database_name,table:m.table_name,origin:m.origin_name}));
    const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);
    assert.deepEqual(rows,c.runs[run].rows.map(r=>r.map(decode)),`${c.kind}: public native ordered rows`);
    const a=privateAccounting(st);
    assert.ok(a.indexSeeks>0,'selected inner seek executed');
    assert.ok(a.emittedOps.includes('OpenIndex'),'actual lowering opens selected index');
    assert.equal(a.sorterRows>0,c.kind==='partial','only full order may omit sorter');
    assert.equal(c.runs[run].sortCount>0,c.kind==='partial');
    st.reset();
   }}finally{st.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
