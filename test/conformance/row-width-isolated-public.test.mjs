import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,logEstAdd} from '../../src/internal/where-plan.ts';
import {compileSelect} from '../../src/internal/select-compiler.ts';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
async function fixture(v,fn){
 const bytes=fs.readFileSync(new URL(`../../${v.fixture}`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));await fn(db)}finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
}
// Isolate ordinary cases so an earlier cross-scope join failure cannot hide
// later REAL/collation/metadata/reset assertions. Original suite remains intact.
for(const v of cap.variants)for(const name of ['cover','noncover','real-cover','scan','wr','expression','tie','full','invalid']){
 test(`isolated width public ${v.encoding}/${v.state}/${name}`,async()=>fixture(v,async db=>{
  const expected=v.cases[name];
  if(expected.error){assert.throws(()=>db.prepare(cap.sql[name]),e=>(e.sqliteCode===expected.error.code||e.code===expected.error.code)&&e.message.includes(expected.error.message));return}
  const st=db.prepare(cap.sql[name]).statement;
  try{
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i).name),expected.columns);
   for(let i=0;i<expected.runs.length;i++){
    if(i)st.reset();st.clearBindings();if(cap.sql[name].includes('?1'))st.bind(1,cap.bindings[name][i]);
    const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,j)=>st.column(j)));
    assert.deepEqual(rows,expected.runs[i].rows.map(r=>r.map(decode)),`${name}/run${i}`);
    st.reset();const retained=[];while(await st.step()==='row')retained.push(Array.from({length:st.columnCount},(_,j)=>st.column(j)));
    assert.deepEqual(retained,expected.runs[i].resetRetainedRows.map(r=>r.map(decode)));
    if(name==='real-cover'&&rows.length)assert.ok(privateAccounting(st).indexSeeks>0);
   }
   st.reset();st.clearBindings();if(cap.sql[name].includes('?1'))assert.equal(await st.step(),'done');
  }finally{st.finalize()}
 }));
}

for(const v of cap.variants.filter(v=>['before','small-a','small-b'].includes(v.state)))
 test(`isolated real cost/access ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
  const schema=loadSchemaGraph(db),table=schema.tables.get('t'),index=schema.indexes.get('tc');
  for(const columns of [['id','c'],['id','c','tag']]){
   const sql=`SELECT ${columns.join(',')} FROM t INDEXED BY tc WHERE c>=?1`;
   const resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
   const neededColumns=[new Set(columns.map(name=>table.columns.find(c=>c.name===name)))];
   const selection=planWhere(resolved,{neededColumns,orderBy:[]}),loop=selection.path.loops[0];
   assert.equal(loop.capability.index,index);assert.equal(loop.indexRowSize,BigInt(index.szIdxRow));
   assert.equal(loop.setupCost,0n);
   const rows=BigInt(index.rowLogEst[0])-20n,logSize=BigInt(index.rowLogEst[0])<=10n?0n:BigInt(sqliteLogEst(BigInt(index.rowLogEst[0]))-33);
   const indexed=logEstAdd(logSize,rows+1n+15n*BigInt(index.szIdxRow)/BigInt(table.szTabRow));
   assert.equal(loop.outputRows,rows);assert.equal(loop.runCost,columns.length===2?indexed:logEstAdd(indexed,rows+16n));
   assert.equal(loop.capability.needsTableLookup,columns.length===3);
   const database=btreeFromConnection(db),program=compileSelect(parseSql(sql).statement,schema,database,schema.encoding,10000,10000000,10000000,DEFAULT_PRIVATE_STATE_LIMITS,false);
   assert.ok(program.ops.some(op=>op.code==='OpenIndex'&&op.p1===index.rootPage));
  }
 }));
