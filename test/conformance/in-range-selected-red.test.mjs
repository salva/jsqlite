import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture, privateAccounting} from './public-api-adapter.mjs';

const native=JSON.parse(fs.readFileSync(new URL('./cases/in-range-stat-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));

for(const variant of native.variants){
 test(`selected composite IN access ${variant.encoding}/${variant.state}`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   for(const name of ['in-composite','in-composite-unforced','in-composite-scan','in-null']){
    const statement=db.prepare(native.sql[name]).statement;
    try{
     native.parameters[name].forEach((value,i)=>statement.bind(i+1,value));
     const rows=[];
     while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
     assert.deepEqual(rows,variant.cases[name].rows.map(row=>row.map(decode)),`${name}: pinned typed result`);
     const count=privateAccounting(statement);
     if(name==='in-composite-scan')assert.ok(count.tableNext>0,`${name}: scan control`);
     else assert.ok(count.indexSeeks>=(name==='in-null'?1:2),`${name}: selected probes (not scan-equivalent)`);
    }finally{statement.finalize()}
   }
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}

// Source-owned restart for an inner level must not advance the outer level;
// the LEFT null-row path executes only after all non-NULL RHS probes finish.
for(const variant of native.variants){
 test(`joined LEFT composite IN restart ${variant.encoding}/${variant.state}`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   const sql='SELECT x.id,y.id FROM t x LEFT JOIN t y INDEXED BY t_ab ON y.a IN (x.a,x.a,NULL) AND y.b>=13 AND y.b<15 AND y.id=x.id WHERE x.id IN (12,13,14,214) ORDER BY x.id,y.id';
   const statement=db.prepare(sql).statement;
   try{
    const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);
    assert.deepEqual(rows,[[12n,null],[13n,13n],[14n,14n],[214n,214n]]);
    assert.ok(privateAccounting(statement).indexSeeks>=3,'joined selected probes, not a scan');
   }finally{statement.finalize()}
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}

// A selected prefix seek must reach its physical root; NOT INDEXED must not
// open that root even if its header is malformed (all encoding/state fixtures).
for(const variant of native.variants){
 test(`composite IN selected/off-path corrupt index ${variant.encoding}/${variant.state}`,async()=>{
  const original=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  const broken=Buffer.from(original);
  const pageSize=original.readUInt16BE(16)||65536;
  // The frozen SQLite schema has t_ab at page 5 in all six variants.
  assert.equal(pageSize,4096);
  broken[(5-1)*pageSize]=0;
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':broken.length});r.end(broken)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/corrupt`));
   const scan=db.prepare(native.sql['in-composite-scan']).statement;
   try{native.parameters['in-composite-scan'].forEach((value,i)=>scan.bind(i+1,value));const rows=[];while(await scan.step()==='row')rows.push(Array.from({length:scan.columnCount},(_,i)=>scan.column(i)));assert.deepEqual(rows,variant.cases['in-composite-scan'].rows.map(row=>row.map(decode)));assert.equal(privateAccounting(scan).indexSeeks,0)}finally{scan.finalize()}
   const selected=db.prepare(native.sql['in-composite']).statement;
   try{native.parameters['in-composite'].forEach((value,i)=>selected.bind(i+1,value));await assert.rejects(async()=>{while(await selected.step()==='row'){}},error=>error.kind==='sqlite'&&error.code===11, 'selected root must report corruption')}finally{assert.throws(()=>selected.finalize(),error=>error.kind==='sqlite'&&error.code===11)}
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}

// The in-memory RHS set must charge work inside the duplicate-elimination
// primitive rather than treating a potentially quadratic walk as one opcode.
for(const variant of native.variants){
 test(`composite IN private RHS work bound ${variant.encoding}/${variant.state}`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   // The RHS set is ordered/deduplicated before the first selected seek;
   // a large duplicate walk must still stop within the operation budget.
   const sql=`SELECT id FROM t INDEXED BY t_ab WHERE a IN (${Array(180).fill('1').join(',')}) AND b>=13 AND b<15 ORDER BY id`;
   const st=db.prepare(sql).statement;
   await assert.rejects(async()=>{while(await st.step({maxWorkUnits:400})==='row'){}},error=>error.kind==='limit'&&/maxWorkUnits/.test(error.message));
   assert.equal(privateAccounting(st).indexSeeks,0,'set construction stops before selected seek');
   assert.throws(()=>st.finalize(),error=>error.kind==='limit');
   const control=db.prepare('SELECT id FROM t INDEXED BY t_ab WHERE a IN (1) AND b>=13 AND b<15 ORDER BY id').statement;
   try{const rows=[];while(await control.step()==='row')rows.push(control.column(0));assert.ok(rows.length>0)}finally{control.finalize()}
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}

for(const variant of native.variants){
 test(`two-slot joined selected IN ${variant.encoding}/${variant.state}`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   for(const [sql,expected] of [
    ['SELECT id,a,b FROM t INDEXED BY t_ab WHERE a IN (1,1.0,NULL,2) AND b IN (13,14,14,NULL) ORDER BY id',[[13n,1n,13n],[14n,2n,14n],[214n,1n,14n],[1002n,1n,13n],[1003n,1n,14n]]],
    ['SELECT x.id,y.id FROM t x LEFT JOIN t y INDEXED BY t_ab ON y.a IN (x.a,x.a,NULL) AND y.b IN (13,14,14,NULL) AND y.id=x.id WHERE x.id IN (12,13,14,214) ORDER BY x.id,y.id',[[12n,null],[13n,13n],[14n,14n],[214n,214n]]],
    ['SELECT id,a,b FROM t WHERE a IN (1,1.0,NULL,2) AND b IN (13,14,14,NULL) ORDER BY id',[[13n,1n,13n],[14n,2n,14n],[214n,1n,14n],[1002n,1n,13n],[1003n,1n,14n]]]
   ]){
    const st=db.prepare(sql).statement;
    try{const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));assert.deepEqual(rows,expected);assert.ok(privateAccounting(st).indexSeeks>=3,'two-slot selected seeks')}finally{st.finalize()}
   }
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}

// codeINTerm's RHS Btree iterates keys in affinity/collation order rather than
// SQL list order. Frozen fixtures are read-only; oracle captured independently
// using pinned SQLite 3.53.4 on the same six database images.
for(const variant of native.variants){
 test(`two-slot selected unsorted RHS physical traversal ${variant.encoding}/${variant.state}`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   const st=db.prepare('SELECT id,a,b FROM t INDEXED BY t_ab WHERE a IN (2,1,1.0,NULL) AND b IN (14,13,14,NULL)').statement;
   try{const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1),st.column(2)]);
    assert.deepEqual(rows,[[13n,1n,13n],[1002n,1n,13n],[214n,1n,14n],[1003n,1n,14n],[14n,2n,14n]]);
    assert.ok(privateAccounting(st).indexSeeks>=3);
   }finally{st.finalize()}
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}

// Independently checked against manifest-pinned SQLite 3.53.4 read-only
// advanced-index fixtures: covering m_abc (a,b,c) with three ephemeral RHS
// cursors; codeINTerm/WhereEnd advance them from innermost to outermost.
for(const encoding of ['utf8','utf16le','utf16be']){
 test(`three-slot selected IN and rebind ${encoding}`,async()=>{
  const bytes=fs.readFileSync(new URL(`./fixtures/advanced-index-${encoding}.db`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   const sql='SELECT id,a,b,c FROM m INDEXED BY m_abc WHERE a IN (?1,?2,NULL) AND b IN (3,2,1) AND c IN (5,4,3,2,1,NULL)';
   const st=db.prepare(sql).statement;
   try{
    for(const [params,ids] of [[[2,1],[1n,2n,3n,4n]],[[3,1],[1n,2n,3n,5n]]]){
     params.forEach((value,i)=>st.bind(i+1,value));
     const rows=[];while(await st.step()==='row')rows.push([0,1,2,3].map(i=>st.column(i)));
     assert.deepEqual(rows.map(row=>row[0]),ids);
     assert.ok(privateAccounting(st).indexSeeks>=12,'three selected equality-slot probes');
     st.reset();
    }
   }finally{st.finalize()}
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}

for(const encoding of ['utf8','utf16le','utf16be']){
 test(`three-slot joined LEFT selected IN ${encoding}`,async()=>{
  const bytes=fs.readFileSync(new URL(`./fixtures/advanced-index-${encoding}.db`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   const sql='SELECT x.id,y.id FROM m x LEFT JOIN m y INDEXED BY m_abc ON y.a IN (x.a,x.a,NULL) AND y.b IN (3,2,1) AND y.c IN (5,4,3,2,1,NULL) AND y.id=x.id WHERE x.id IN (1,2,3,4,5) ORDER BY x.id,y.id';
   const st=db.prepare(sql).statement;
   try{const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);
    assert.deepEqual(rows,[[1n,1n],[2n,2n],[3n,3n],[4n,4n],[5n,5n]]);
    assert.ok(privateAccounting(st).indexSeeks>=15,'joined three-slot selected seeks');
   }finally{st.finalize()}
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}

// ix_ab_desc has NOCASE DESC on b. Pinned 3.53.4 returns the following
// no-ORDER rows from each read-only index-planner encoding fixture.
for(const encoding of ['utf8','utf16le','utf16be']){
 test(`descending selected IN and inclusive/exclusive range ${encoding}`,async()=>{
  const bytes=fs.readFileSync(new URL(`./fixtures/index-planner-${encoding}.db`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   const expected=[[2n,1n,'beta'],[1n,1n,'Alpha'],[5n,2n,'gamma'],[4n,2n,'ALPHA']];
   for(const sql of ["SELECT rowid,a,b FROM t INDEXED BY ix_ab_desc WHERE a IN (2,1,NULL) AND b IN ('alpha','beta','gamma')","SELECT rowid,a,b FROM t INDEXED BY ix_ab_desc WHERE a IN (2,1,NULL) AND b>='a' AND b<'z'"]){
    const st=db.prepare(sql).statement;
    try{const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1),st.column(2)]);
     assert.deepEqual(rows,expected);
     assert.ok(privateAccounting(st).indexSeeks>=2,'selected DESC access');
     assert.equal(privateAccounting(st).tableNext,0,'not scan-equivalent');
    }finally{st.finalize()}
   }
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}
