import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';

const expectedDigest='7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15';
const fixture=process.env.CHINOOK_DB;
if(!fixture)throw new Error('CHINOOK_DB is required');
const body=fs.readFileSync(fixture);
assert.equal(crypto.createHash('sha256').update(body).digest('hex'),expectedDigest,'public Chinook fixture digest');

async function withDb(run){
 const server=http.createServer((_request,response)=>{response.writeHead(200,{'Content-Length':body.length});response.end(body)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/Chinook_Sqlite.sqlite`));await run(db);}
 finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
async function values(db,sql){const statement=db.prepare(sql).statement,rows=[];try{while(await statement.step({maxWorkUnits:200000})==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return rows;}finally{statement.finalize();}}

const sql='SELECT a.Title AS album,COUNT(*) AS tracks,ROUND(SUM(t.Milliseconds)/60000.0,1) AS total_minutes,ROUND(AVG(t.UnitPrice),2) AS average_price,SUM(CASE WHEN t.Milliseconds>300000 THEN 1 ELSE 0 END) AS tracks_over_5_minutes FROM Album a JOIN Track t ON t.AlbumId=a.AlbumId WHERE a.AlbumId BETWEEN 1 AND 20 GROUP BY a.AlbumId,a.Title HAVING COUNT(*)>=5 ORDER BY total_minutes DESC,album LIMIT 10';
const expected=[['Big Ones',15n,73.5,0.99,8n],['Alcohol Fueled Brewtality Live! [Disc 1]',13n,67.7,0.99,6n],['Audioslave',14n,65.5,0.99,5n],['Chemical Wedding',11n,61.6,0.99,5n],['Jagged Little Pill',13n,57.5,0.99,2n],['Facelift',12n,54.2,0.99,3n],['Out Of Exile',12n,53.7,0.99,1n],['Body Count',17n,53.2,0.99,5n],['Warner 25 Anos',14n,48.4,0.99,1n],['The Best Of Billy Cobham',8n,44.7,0.99,3n]];
test('aggregate join producer consumes shared WHERE candidates before grouping',async()=>withDb(async db=>{
 const statement=db.prepare(sql).statement,rows=[],start=performance.now();
 try{while(await statement.step({maxWorkUnits:200000})==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
 const accounting=privateAccounting(statement);console.log(JSON.stringify({elapsedMs:performance.now()-start,accounting,metadata:Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i))}));
 assert.deepEqual(rows,expected,'typed pinned 3.53.4 rows');
 assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name),['album','tracks','total_minutes','average_price','tracks_over_5_minutes']);
 assert.ok(accounting.plannerCandidates>0,'aggregate source must consume shared WHERE candidates');
 assert.ok(accounting.plannerPaths>0,'aggregate source must consume shared WHERE path solver');
 assert.ok(accounting.indexSeeks+accounting.tableSeeks>0,'selected source access must seek rather than Cartesian scans');
 assert.deepEqual(accounting,{plannerCandidates:4,plannerPaths:2,indexSeeks:0,indexNext:0,tableSeeks:3503,tableNext:3503,residualTests:7006,sorterRows:222,inProbes:0,orBranchStarts:0,orBranchRoots:[],orDuplicateSkips:0},'phase-linked selected producer accounting');
 assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i)),[
 {name:'album',declaredType:'NVARCHAR(160)',database:'main',table:'Album',origin:'Title'},
 ...['tracks','total_minutes','average_price','tracks_over_5_minutes'].map(name=>({name,declaredType:null,database:null,table:null,origin:null}))]);
 // A second execution rebuilds the selected producer and grouping state.
 statement.reset();const replay=[];while(await statement.step({maxWorkUnits:200000})==='row')replay.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
 assert.deepEqual(replay,expected);assert.deepEqual(privateAccounting(statement),accounting);
 statement.reset();assert.equal(await statement.step({maxWorkUnits:200000}),'row');statement.reset();const afterYield=[];while(await statement.step({maxWorkUnits:200000})==='row')afterYield.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));assert.deepEqual(afterYield,expected);

 }finally{statement.finalize()}
}));
