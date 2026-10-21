import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import http from 'node:http';
import {openFixture,privateAccounting} from '../../../test/conformance/public-api-adapter.mjs';
import {createHash} from 'node:crypto';
const native=fs.readFileSync(new URL('./numeric-native.jsonl',import.meta.url),'utf8').trim().split('\n').map(x=>JSON.parse(x));
import {parseSql} from '../../../src/internal/parse.ts';
import {stat4ValueFromExpr} from '../../../src/internal/stat4-probe.ts';
const scalars=[['1_000','integer','1000'],['1_0.0','real',10],['-9_223_372_036_854_775_808','integer','-9223372036854775808'],['9_223_372_036_854_775_808','real',9223372036854775808],['0x6_4','integer','100'],['-0x6_4','integer','-100'],['1e1_0','real',1e10],["'1_00'",'text','1_00']];
const cap=JSON.parse(fs.readFileSync(new URL('./skiprange-useful/skiprange-native.json',import.meta.url)));
for(const v of cap.variants)test(`${v.encoding}: numeric semantic tokens reach probe and VM`,async()=>{
 const bytes=fs.readFileSync(new URL('./skiprange-useful/'+v.fixture,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/f`));
 for(const [lit,type,value] of scalars){
  const sql=`SELECT ${lit}`,st=db.prepare(sql).statement;
  try{assert.equal(st.columnMetadata(0).name,lit);assert.equal(await st.step(),'row');assert.equal(st.columnType(0),type);assert.equal(type==='integer'?String(st.column(0)):st.column(0),value);assert.equal(await st.step(),'done');}finally{st.finalize()}
  const expr=parseSql(sql).statement.result[0].reduction,m=stat4ValueFromExpr(expr,'blob',v.encoding);
  try{assert.equal(m.initialStorageClass,type);assert.equal(type==='integer'?String(m.integerValue()):type==='real'?m.realValue():m.textValue(),value);}finally{m.release()}
 }
 for(const [raw,plain,count] of [['1_00','100',15],['1_0.0','10.0',28],['1e1_0','1e10',0],['0x6_4','0x64',15],['-1_00','-100',2858],['+1_0.0','+10.0',28]]){
  const results=[];for(const lit of [plain,raw]){const sql=`SELECT id,p FROM t WHERE b>${lit} AND c=1`,st=db.prepare(sql).statement;
   try{const runs=[];for(let run=0;run<2;run++){const rows=[];while(await st.step()==='row')rows.push([String(st.column(0)),st.column(1)]);runs.push(rows);if(run===0)st.reset();}assert.deepEqual(runs[0],runs[1]);results.push({rows:runs[0],work:privateAccounting(st)});}finally{st.finalize()}}
  assert.equal(results[0].rows.length,count);assert.deepEqual(results[1],results[0],raw);
  const oracle=native.find(x=>x.fixture===v.fixture&&x.literal===raw);assert.ok(oracle);
  assert.equal(createHash('sha256').update(JSON.stringify([...results[1].rows].sort())).digest('hex'),oracle.typedRowsSHA256);
 }
 for(const bad of ['1__0','1_','1_.0','1._0','0x1__0'])assert.throws(()=>db.prepare(`SELECT ${bad}`),e=>e.kind==='sqlite');
 }finally{db?.closeDeferred();server.closeAllConnections();await new Promise(r=>server.close(r))}
});
