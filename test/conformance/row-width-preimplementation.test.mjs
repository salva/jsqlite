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
for(const v of cap.variants){
 test(`row-width public native ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
  for(const [name,expected] of Object.entries(v.cases)){
   if(expected.error){assert.throws(()=>db.prepare(cap.sql[name]),e=>(e.sqliteCode===expected.error.code||e.code===expected.error.code)&&e.message.includes(expected.error.message));continue}
   const st=db.prepare(cap.sql[name]).statement;
   try{
    assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i).name),expected.columns);
    for(let i=0;i<expected.runs.length;i++){
     if(i)st.reset();st.clearBindings();if(cap.sql[name].includes('?1'))st.bind(1,cap.bindings[name][i]);
     const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,j)=>st.column(j)));
     assert.deepEqual(rows,expected.runs[i].rows.map(r=>r.map(decode)),`${name}/run${i}`);
     st.reset();const retained=[];while(await st.step()==='row')retained.push(Array.from({length:st.columnCount},(_,j)=>st.column(j)));
     assert.deepEqual(retained,expected.runs[i].resetRetainedRows.map(r=>r.map(decode)),`${name}/reset without rebinding ${i}`);
     if((name==='cover'||name==='real-cover'||name==='join')&&rows.length)assert.ok(privateAccounting(st).indexSeeks>0,`${name}: production selected seeks`);
    }
    st.reset();st.clearBindings();if(cap.sql[name].includes('?1'))assert.equal(await st.step(),'done',`${name}: cleared NULL bindings`);
   }finally{st.finalize()}
  }
 }));
}
for(const v of cap.variants.filter(v=>['before','small-a','small-b'].includes(v.state))){
 test(`row-width immutable producer and real planWhere ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
  const schema=loadSchemaGraph(db),t=schema.tables.get('t');
  assert.deepEqual(t.columns.map(c=>c.szEst),[1,1,1,26,251,5]);
  assert.equal(t.szTabRow,sqliteLogEst(v.state==='before'?1140n:400n));
  const noipk=schema.tables.get('noipk'),wr=schema.tables.get('wr');
  assert.equal(noipk.szTabRow,sqliteLogEst(96n));
  assert.equal(wr.szTabRow,sqliteLogEst(32n));
  assert.equal(schema.indexes.get('wx').szIdxRow,sqliteLogEst(44n));
  assert.equal(schema.indexes.get('wy').szIdxRow,sqliteLogEst(24n));
  assert.equal(schema.indexes.get('sqlite_autoindex_t_1').szIdxRow,sqliteLogEst(24n));
  const ta=schema.indexes.get('ta'),tb=schema.indexes.get('tb'),te=schema.indexes.get('te');
  if(v.state==='before'){
   assert.equal(ta.szIdxRow,sqliteLogEst(8n));assert.equal(tb.szIdxRow,sqliteLogEst(112n));assert.equal(te.szIdxRow,sqliteLogEst(8n));
  }else{
   assert.equal(t.szTabRow,sqliteLogEst(400n));assert.equal(ta.szIdxRow,sqliteLogEst(v.state==='small-a'?2n:200n));assert.equal(tb.szIdxRow,sqliteLogEst(v.state==='small-a'?200n:2n));
  }
  for(const sql of ['SELECT a FROM t WHERE a=1','SELECT x.a,y.a FROM t x CROSS JOIN t y WHERE x.id=1 AND y.a=x.a']){
   const resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
   const neededColumns=resolved.sources.map(s=>new Set([s.table.columns.find(c=>c.name==='a')]));
   const selection=planWhere(resolved,{neededColumns,orderBy:[]});
   for(const loop of selection.path.loops.filter(l=>l.kind==='index'))assert.equal(loop.indexRowSize,BigInt(loop.capability.index.szIdxRow),'real planWhere handoff, not fabricated loops');
   assert.ok(selection.path.loops.some(l=>l.kind==='index'),'production indexed path');
  }
 }));
}
// Real ordinary/joined compile entry, not helper-injected loops.
for(const v of cap.variants.filter(v=>['before','small-a','small-b','max-int'].includes(v.state))){
 test(`row-width chosen production roots ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
  const schema=loadSchemaGraph(db),database=btreeFromConnection(db);
  for(const name of ['cover','join']){
   const program=compileSelect(parseSql(cap.sql[name]).statement,schema,database,schema.encoding,10000,10000000,10000000,DEFAULT_PRIVATE_STATE_LIMITS,false);
   const expected=v.cases[name].runs[0].eqp.flatMap(detail=>{const match=/USING (?:COVERING )?INDEX (\w+)/.exec(detail);return match?[schema.indexes.get(match[1]).rootPage]:[]});
   assert.deepEqual(program.ops.filter(op=>op.code==='OpenIndex').map(op=>op.p1),expected,`${name}: actual chosen physical roots`);
  }
 }));
}
for(const v of cap.variants.filter(v=>['unknown-index','clamp','overflow','max-int','unknown-token','wr-table-name'].includes(v.state))){
 test(`row-width stat owner boundaries ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
  const schema=loadSchemaGraph(db),t=schema.tables.get('t'),ta=schema.indexes.get('ta');
  if(['clamp','overflow','unknown-index'].includes(v.state))assert.equal(t.szTabRow,sqliteLogEst(2n),'NULL/unknown idx fakeIdx table width');
  if(['clamp','overflow'].includes(v.state))assert.equal(ta.szIdxRow,sqliteLogEst(2n),'Atoi overflow/low clamp');
  if(v.state==='max-int')assert.equal(ta.szIdxRow,sqliteLogEst(2147483647n));
  if(v.state==='unknown-token')assert.equal(ta.szIdxRow,sqliteLogEst(20n),'upstream ignores junk, parses digit-prefix sz');
  if(v.state==='wr-table-name')assert.equal(schema.tables.get('wr').indexes.find(i=>i.origin==='primary-key').szIdxRow,sqliteLogEst(2n));
 }));
}

// Loader state transitions: use the actual immutable graph, not a parallel decoder.
for(const v of cap.variants.filter(v=>['cross','cross-partial','duplicate','duplicate-reversed'].includes(v.state))){
 test(`row-width global callback/order ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
  const schema=loadSchemaGraph(db),t=schema.tables.get('t'),named=schema.tables.get('noipk');
  const ix=schema.indexes.get(v.state==='cross'?'ta':v.state==='cross-partial'?'tp':'tb');
  assert.equal(t.nRowLogEst,200,'matched index owning table must NOT receive argv[0] count');
  assert.equal(t.hasStat1,false);
  assert.equal(named.nRowLogEst,v.state==='cross-partial'?200:sqliteLogEst(v.state==='duplicate'?8n:64n));
  assert.equal(named.hasStat1,v.state!=='cross-partial');
  assert.equal(ix.hasStat1,true);assert.equal(ix.szIdxRow,sqliteLogEst(16n));
  assert.deepEqual(ix.rowLogEst,(v.state.startsWith('duplicate')?[v.state==='duplicate'?8n:64n,4n,2n]:[64n,4n]).map(n=>sqliteLogEst(n)));
  assert.equal(ix.unordered,v.state==='duplicate-reversed','short second row resets flag but retains untouched slots/width');
 }));
}
for(const v of cap.variants.filter(v=>v.state.startsWith('hex-')||v.state==='hex')){
 test(`row-width GetInt32 ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
  const ix=loadSchemaGraph(db).indexes.get('ta');
  const bytes=v.state==='hex-max'?2147483647n:['hex-overflow','hex-long'].includes(v.state)?2n:['hex-signed','hex-negative'].includes(v.state)?8n:16n;
  assert.equal(ix.szIdxRow,sqliteLogEst(bytes));
 }));
}
const estLog=n=>n<=10n?0n:BigInt(sqliteLogEst(n))-33n;
// Production cost vectors: force physical identity via SQL INDEXED BY, not loop injection.
for(const v of cap.variants.filter(v=>['small-a','small-b','tie-small-a','tie-small-b','tie-equal','table-only-low','table-only-high'].includes(v.state))){
 test(`row-width production costs ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
  const schema=loadSchemaGraph(db),t=schema.tables.get('t');
  for(const joined of [false,true])for(const covering of [false,true]){
   const sql=joined?`SELECT x.id,y.${covering?'a':'c'} FROM t x CROSS JOIN t y INDEXED BY ta WHERE x.id=1 AND y.a=x.a`:`SELECT ${covering?'a':'c'} FROM t INDEXED BY ta WHERE a=1`;
   const resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
   const neededColumns=resolved.sources.map((source,i)=>new Set([source.table.columns.find(c=>c.name===(joined&&i===0?'id':covering?'a':'c'))]));
   const selected=planWhere(resolved,{neededColumns,orderBy:[]});const loop=selected.path.loops.at(-1),ix=schema.indexes.get('ta');
   const stats=ix.rowLogEst.map(BigInt);const ratio=15n*BigInt(ix.szIdxRow)/BigInt(t.szTabRow);
   let run=logEstAdd(estLog(stats[0]),stats[1]+1n+ratio);
   if(!covering)run=logEstAdd(run,stats[1]+16n);
   assert.equal(loop.setupCost,0n);assert.equal(loop.outputRows,stats[1]);assert.equal(loop.runCost,run,'source truncated LogEst ratio + seek + optional table lookup');
   assert.equal(loop.indexRowSize,BigInt(ix.szIdxRow));
   // Empty ORDER: each round publishes total, then biased unsorted for the NEXT round.
   let rows=0n,cost=0n,unsorted=0n;for(const l of selected.path.loops){let extension=l.runCost+rows;if(l.setupCost!==0n)extension=logEstAdd(l.setupCost,extension);cost=logEstAdd(extension,unsorted);unsorted=cost-2n;rows+=l.outputRows;}
   assert.equal(selected.path.rows,rows);assert.equal(selected.path.cost,cost);assert.equal(selected.path.unsortedCost,unsorted);
  }
  if(v.state.startsWith('table-only')){
   assert.equal(t.nRowLogEst,v.state==='table-only-low'?99:sqliteLogEst(65536n));
   assert.equal(t.szTabRow,sqliteLogEst(v.state==='table-only-low'?16n:1048576n));
   for(const sql of ['SELECT a FROM t NOT INDEXED','SELECT a FROM t WHERE id=1']){
    const resolved=expandAndResolveSelect(parseSql(sql).statement,schema),sel=planWhere(resolved,{neededColumns:[new Set([t.columns[1]])],orderBy:[]}),l=sel.path.loops[0];
    assert.equal(l.setupCost,0n);
    assert.equal(l.outputRows,l.kind==='rowid'?0n:BigInt(t.nRowLogEst));
    assert.equal(l.runCost,l.kind==='rowid'?logEstAdd(estLog(BigInt(t.nRowLogEst)),16n):BigInt(t.nRowLogEst)+16n);
   }
  }
 }));
}
for(const v of cap.variants.filter(v=>v.state.startsWith('tie-')||v.state.startsWith('scan-')||v.state.startsWith('table-only'))){
 test(`row-width production tie/full eligibility ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
  const schema=loadSchemaGraph(db),database=btreeFromConnection(db);
  for(const name of ['cover','tie','full','rowid']){
   const program=compileSelect(parseSql(cap.sql[name]).statement,schema,database,schema.encoding,10000,10000000,10000000,DEFAULT_PRIVATE_STATE_LIMITS,false);
   const roots=v.cases[name].runs[0].eqp.flatMap(detail=>{const m=/USING (?:COVERING )?INDEX (\w+)/.exec(detail);return m?[schema.indexes.get(m[1]).rootPage]:[]});
   assert.deepEqual(program.ops.filter(op=>op.code==='OpenIndex').map(op=>op.p1),roots,`${name}: native selected identity`);
  }
  if(v.state.startsWith('tie-')){
   const loops=['ta','tb'].map(ix=>{const resolved=expandAndResolveSelect(parseSql(`SELECT a FROM t INDEXED BY ${ix} WHERE a=1`).statement,schema);return planWhere(resolved,{neededColumns:[new Set([schema.tables.get('t').columns[1]])],orderBy:[]}).path.loops[0]});
   for(const field of ['setupCost','runCost','outputRows'])assert.equal(loops[0][field],loops[1][field],`equal ${field}: width must be independent tie input`);
   const resolved=expandAndResolveSelect(parseSql('SELECT a FROM t WHERE a=1').statement,schema),sel=planWhere(resolved,{neededColumns:[new Set([schema.tables.get('t').columns[1]])],orderBy:[]});
   // Post-runtime oracle correction: no ORDER candidates collapse at FindLesser, BEFORE width tie.
   assert.equal(sel.path.loops[0].capability.index.name,'tb',v.cases['aux-no-order'].runs[0].eqp.join(';'));
   const orderedResolved=expandAndResolveSelect(parseSql(cap.sql['aux-order']).statement,schema);
   const a=schema.tables.get('t').columns[1];
   const ordered=planWhere(orderedResolved,{neededColumns:[new Set([a])],orderBy:[{sourceOrdinal:0,column:a,descending:false,collation:'binary'}]});
   assert.equal(ordered.path.loops[0].capability.index.name,v.state==='tie-small-a'?'ta':'tb',v.cases['aux-order'].runs[0].eqp.join(';'));
   assert.equal(ordered.path.orderTermsSatisfied,1);
   assert.equal(sel.path.cost,logEstAdd(loops[0].runCost,0n));assert.equal(sel.path.unsortedCost,sel.path.cost-2n);
  }
  if(v.state.startsWith('scan-')){
   const resolved=expandAndResolveSelect(parseSql('SELECT a FROM t INDEXED BY ta').statement,schema),sel=planWhere(resolved,{neededColumns:[new Set([schema.tables.get('t').columns[1]])],orderBy:[]}),l=sel.path.loops[0],ix=schema.indexes.get('ta'),t=schema.tables.get('t');
   assert.equal(l.runCost,BigInt(ix.rowLogEst[0])+1n+15n*BigInt(ix.szIdxRow)/BigInt(t.szTabRow));
   assert.equal(l.setupCost,0n);assert.equal(l.outputRows,BigInt(ix.rowLogEst[0]));
  }
 }));
}

// Real two-loop discriminator: prior total gives52, prior biased unsorted gives51.
for(const v of cap.variants.filter(v=>v.state==='tie-equal')){
 test(`row-width joined per-round unsorted bias ${v.encoding}`,async()=>fixture(v,async db=>{
  const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(cap.sql['path-bias']).statement,schema);
  const neededColumns=resolved.sources.map((source,i)=>new Set([source.table.columns.find(c=>c.name===(i===0?'id':'a'))]));
  const selected=planWhere(resolved,{neededColumns,orderBy:[]});
  assert.deepEqual(selected.path.loops.map(l=>[l.kind,l.setupCost,l.runCost,l.outputRows]),[['rowid',0n,37n,0n],['index',0n,45n,33n]]);
  assert.equal(selected.path.loops[1].capability.index.name,'ta');
  assert.equal(logEstAdd(45n,37n-2n),51n);
  assert.equal(logEstAdd(45n,37n),52n,'incorrect prior-total recurrence must be distinguishable');
  assert.equal(selected.path.rows,33n);assert.equal(selected.path.cost,51n);assert.equal(selected.path.unsortedCost,49n);
  const program=compileSelect(parseSql(cap.sql['path-bias']).statement,schema,btreeFromConnection(db),schema.encoding,10000,10000000,10000000,DEFAULT_PRIVATE_STATE_LIMITS,false);
  const roots=v.cases['path-bias'].runs[0].eqp.flatMap(detail=>{const m=/USING (?:COVERING )?INDEX (\w+)/.exec(detail);return m?[schema.indexes.get(m[1]).rootPage]:[]});
  assert.deepEqual(program.ops.filter(op=>op.code==='OpenIndex').map(op=>op.p1),roots);
 }));
}
