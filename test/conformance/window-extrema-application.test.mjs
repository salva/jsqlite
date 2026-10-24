import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {open} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';
import {privateAccounting} from './public-api-adapter.mjs';

// Public execution must reach the packed VM facade, not merely an equivalent
// ordered-row adapter. Instrument only existing owners; preserve their behavior.
test('bounded extrema enrolls packed insert/Last/Column/prefix Delete owners',async()=>{
 const names=['insert','last','column','seekBound','deleteCurrent'];
 const originals=new Map(names.map(name=>[name,PrivateKeyVmCursor.prototype[name]]));
 const calls=new Map(names.map(name=>[name,0]));
 for(const name of names)PrivateKeyVmCursor.prototype[name]=async function(...args){
  if(this.info.totalFieldCount===2){calls.set(name,calls.get(name)+1);assert.ok(this.arena);assert.ok(this.cursor)}
  return originals.get(name).apply(this,args);
 };
 const server=await startFixtureServer('test/fixtures');let db;
 try{
  db=await open(new Request(`http://127.0.0.1:${server.port}/fixture/${server.token}/expr-relational`));
  const stmt=db.prepare('SELECT min(x) OVER (ORDER BY x DESC ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1 WHERE x>=29').statement;
  try{for(let pass=0;pass<2;pass++){
   const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));
   assert.deepEqual(rows,[31n,30n,29n]);assert.equal(privateAccounting(stmt).ownedBytes,0);stmt.reset();
  }}finally{stmt.finalize()}
  for(const name of names)assert.ok(calls.get(name)>0,`packed ${name} must be consumed`);
 }finally{
  for(const [name,fn] of originals)PrivateKeyVmCursor.prototype[name]=fn;
  db?.closeDeferred();await new Promise((r,j)=>server.server.close(e=>e?j(e):r()));
 }
});

test('window.c application index selects newest typed tie and slides after eviction',async()=>{
 const server=await startFixtureServer('test/fixtures');let db;
 try{
  db=await open(new Request(`http://127.0.0.1:${server.port}/fixture/${server.token}/expr-relational`));
  for(const fn of ['min','max'])for(const reversed of [false,true]){
   const expr=`CASE x WHEN 31 THEN ${reversed?'1.0':'1'} WHEN 30 THEN ${reversed?'1':'1.0'} ELSE 2 END`;
   const sql=`SELECT x,${fn}(${expr}) OVER (ORDER BY x DESC ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1 WHERE x>=29 ORDER BY x DESC`;
   const stmt=db.prepare(sql).statement;
   try{
    for(let replay=0;replay<2;replay++){
     const rows=[];while(await stmt.step()==='row')rows.push([stmt.column(0),stmt.columnType(1),stmt.column(1)]);
     assert.deepEqual(rows,[[31n,reversed?'real':'integer',reversed?1:1n],[30n,reversed?'integer':'real',reversed?1n:1],[29n,fn==='max'?'integer':reversed?'integer':'real',fn==='max'?2n:reversed?1n:1]]);
     assert.equal(privateAccounting(stmt).ownedBytes,0);stmt.reset();
    }
   }finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((r,j)=>server.server.close(e=>e?j(e):r()))}
});

test('application cursor ties, collation, NULL, ordinary callback and cleanup in all encodings',async()=>{
 const server=http.createServer((req,res)=>{const file=`test/fixtures/aggregate-window/${req.url.slice(1)}.db`;res.writeHead(200,{'Content-Length':fs.statSync(file).size});fs.createReadStream(file).pipe(res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const name of ['typed','typed-utf-16le','typed-utf-16be']){
  const db=await open(new Request(`http://127.0.0.1:${server.address().port}/${name}`));
  try{for(const fn of ['min','max'])for(const reversed of [false,true]){
   const expression=`CASE i WHEN 1 THEN ${reversed?'1.0':'1'} WHEN 2 THEN ${reversed?'1':'1.0'} ELSE NULL END`;
   const stmt=db.prepare(`SELECT i,${fn}(${expression}) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t`).statement;
   try{for(let pass=0;pass<2;pass++){
    assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(1),reversed?'real':'integer');
    if(pass===0){stmt.reset();assert.equal(privateAccounting(stmt).ownedBytes,0);assert.equal(await stmt.step(),'row')}
    assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(1),reversed?'integer':'real');
    assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(1),reversed?'integer':'real');
    assert.equal(await stmt.step(),'done');assert.equal(privateAccounting(stmt).ownedBytes,0);stmt.reset();
   }}finally{stmt.finalize()}
   const ordinary=db.prepare(`SELECT ${fn}(${expression}) FROM t`).statement;
   try{assert.equal(await ordinary.step(),'row');assert.equal(ordinary.columnType(0),reversed?'real':'integer')}finally{ordinary.finalize()}
  }
  for(const fn of ['min','max']){
   const stmt=db.prepare(`SELECT i,${fn}(t COLLATE NOCASE) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t`).statement;
   try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(1));assert.deepEqual(rows,['A','a','a'])}finally{stmt.finalize()}
  }
  // EXCLUDE uses the source full-scan callback owner: equal values keep the
  // first representation, unlike the ordinary sliding application index.
  for(const exclusion of ['CURRENT ROW','GROUP','TIES','NO OTHERS']){
   const stmt=db.prepare(`SELECT i,min(CASE i WHEN 1 THEN 1 WHEN 2 THEN 1.0 ELSE 2 END) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE ${exclusion}) FROM t`).statement;
   try{const rows=[];while(await stmt.step()==='row')rows.push([stmt.columnType(1),stmt.column(1)]);assert.deepEqual(rows,exclusion==='CURRENT ROW'||exclusion==='GROUP'?[['null',null],['integer',1n],['real',1]]:[['integer',1n],['integer',1n],['real',1]],exclusion)}finally{stmt.finalize()}
  }
  for(const expression of ["'é'", "x'00ff'", "NULL"]){
   const stmt=db.prepare(`SELECT min(${expression}) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t`).statement;
   try{let count=0;while(await stmt.step()==='row'){
    count++;assert.equal(stmt.columnType(0),expression==='NULL'?'null':expression.startsWith('x')?'blob':'text');
    assert.deepEqual(stmt.column(0),expression==='NULL'?null:expression.startsWith('x')?new Uint8Array([0,255]):'é');
   }assert.equal(count,3);assert.equal(privateAccounting(stmt).ownedBytes,0)}finally{stmt.finalize()}
  }
  // Throw at the application's inverse Delete, after insertion/publication.
  const original=PrivateKeyVmCursor.prototype.deleteCurrent,error=new Error('application delete witness');
  PrivateKeyVmCursor.prototype.deleteCurrent=async function(options,control){if(this.info.totalFieldCount===2)throw error;return original.call(this,options,control)};
  const failing=db.prepare('SELECT min(i) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t').statement;
  try{await assert.rejects(async()=>{while(await failing.step()==='row'){}},e=>e===error||e.cause===error);assert.equal(privateAccounting(failing).ownedBytes,0);assert.throws(()=>failing.reset())}
  finally{PrivateKeyVmCursor.prototype.deleteCurrent=original;failing.finalize()}
  }finally{db.closeDeferred()}
 }}finally{await new Promise(r=>server.close(r))}
});
