import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import {EphemeralIndexCursor} from '../../src/internal/private-state.ts';
import {open} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';
import {privateAccounting} from './public-api-adapter.mjs';

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
  // Throw at the application's inverse Delete, after insertion/publication.
  const original=EphemeralIndexCursor.prototype.deleteCurrent,error=new Error('application delete witness');
  EphemeralIndexCursor.prototype.deleteCurrent=async function(control){if(this.keyInfo.totalFieldCount===2)throw error;return original.call(this,control)};
  const failing=db.prepare('SELECT min(i) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t').statement;
  try{await assert.rejects(async()=>{while(await failing.step()==='row'){}},e=>e===error||e.cause===error);assert.equal(privateAccounting(failing).ownedBytes,0);assert.throws(()=>failing.reset())}
  finally{EphemeralIndexCursor.prototype.deleteCurrent=original;failing.finalize()}
  }finally{db.closeDeferred()}
 }}finally{await new Promise(r=>server.close(r))}
});
