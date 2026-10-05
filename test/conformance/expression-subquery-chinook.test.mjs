import {closeTestServer} from './close-test-server.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const expectedDigest='7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15';
const fixture=process.env.CHINOOK_DB;
if(!fixture)throw new Error('CHINOOK_DB is required');
const body=fs.readFileSync(fixture);
assert.equal(crypto.createHash('sha256').update(body).digest('hex'),expectedDigest,'public Chinook fixture digest');

async function withDb(run){
 const server=http.createServer((_request,response)=>{response.writeHead(200,{'Content-Length':body.length});response.end(body)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/Chinook_Sqlite.sqlite`));await run(db);}
 finally{try{db?.closeDeferred()}catch{}await closeTestServer(server);}
}

async function all(statement){const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return rows;}

test('B2 aggregate consumes a zero-source derived producer',async()=>withDb(async db=>{
 const sql='SELECT count(*) FROM (SELECT 1 AS x)';let statement=db.prepare(sql).statement;
 try{
  assert.equal(statement.columnCount,1);
  assert.deepEqual(statement.columnMetadata(0),{name:'count(*)',declaredType:null,database:null,table:null,origin:null});
  assert.deepEqual(await all(statement),[[1n]]);
  statement.reset();assert.deepEqual(await all(statement),[[1n]],'reset rebuilds producer and accumulator state');
 }finally{statement.finalize();}
 // Finalization restores connection admission.
 statement=db.prepare(sql).statement;
 try{assert.deepEqual(await all(statement),[[1n]]);}finally{statement.finalize();}
}));

test('A1 independent aggregate scalar subqueries own disjoint registers and cursors',async()=>withDb(async db=>{
 const sql='SELECT (SELECT count(*) FROM Genre),(SELECT count(*) FROM MediaType)';let statement=db.prepare(sql).statement;
 try{
  assert.equal(statement.columnCount,2);assert.deepEqual(Array.from({length:2},(_,i)=>statement.columnMetadata(i)),[
   {name:'(SELECT count(*) FROM Genre)',declaredType:null,database:null,table:null,origin:null},
   {name:'(SELECT count(*) FROM MediaType)',declaredType:null,database:null,table:null,origin:null},
  ]);
  assert.deepEqual(await all(statement),[[25n,5n]]);
  statement.reset();assert.deepEqual(await all(statement),[[25n,5n]],'reset keeps child aggregate state isolated');
 }finally{statement.finalize();}
 statement=db.prepare('SELECT (SELECT count(*) FROM Genre),(SELECT count(*) FROM MediaType),(SELECT count(*) FROM Genre)').statement;
 try{assert.deepEqual(await all(statement),[[25n,5n,25n]],'three independent destinations do not alias');}finally{statement.finalize();}
}));

test('C5 SELECT-list aggregate subquery retains qualified outer ownership',async()=>withDb(async db=>{
 const sql='SELECT Name,(SELECT COUNT(*) FROM Album a WHERE a.ArtistId=ar.ArtistId) FROM Artist ar WHERE ar.ArtistId=1';
 let statement=db.prepare(sql).statement;
 try{
  assert.deepEqual(Array.from({length:2},(_,i)=>statement.columnMetadata(i)),[
   // Pinned sqlite3_column_decltype on this identical C5 SQL returns the
   // catalog's exact type span, not the former reconstructed token spacing.
   {name:'Name',declaredType:'NVARCHAR(120)',database:'main',table:'Artist',origin:'Name'},
   {name:'(SELECT COUNT(*) FROM Album a WHERE a.ArtistId=ar.ArtistId)',declaredType:null,database:null,table:null,origin:null},
  ]);
  assert.deepEqual(await all(statement),[['AC/DC',2n]]);
  statement.reset();assert.deepEqual(await all(statement),[['AC/DC',2n]],'qualified correlation reruns after reset');
 }finally{statement.finalize();}
 statement=db.prepare('SELECT Name,(SELECT COUNT(*) FROM Album a WHERE a.ArtistId=ar.ArtistId)+(SELECT COUNT(*) FROM Album b WHERE b.ArtistId=ar.ArtistId) FROM Artist ar WHERE ar.ArtistId=1').statement;
 try{assert.deepEqual(await all(statement),[['AC/DC',4n]],'independent correlated aggregate destinations compose');}finally{statement.finalize();}
}));

test('B4 aggregate consumer reruns the correlated inner-join EXISTS and restores admission',async()=>withDb(async db=>{
 const sql='SELECT count(*) FROM Track t WHERE EXISTS(SELECT 1 FROM InvoiceLine il JOIN Invoice i ON i.InvoiceId=il.InvoiceId WHERE il.TrackId=t.TrackId)';
 let statement=db.prepare(sql).statement;
 try{
  assert.deepEqual(statement.columnMetadata(0),{name:'count(*)',declaredType:null,database:null,table:null,origin:null});
  assert.deepEqual(await all(statement),[[1984n]]);
  statement.reset();assert.deepEqual(await all(statement),[[1984n]],'reset rebuilds once-only join keys and reruns the outer probe');
 }finally{statement.finalize();}
 // Completion and finalization restore connection admission.
 statement=db.prepare('SELECT (SELECT count(*) FROM Genre)').statement;
 try{assert.deepEqual(await all(statement),[[25n]]);}finally{statement.finalize();}
}));
