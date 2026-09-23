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
 finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
async function values(db,sql){const statement=db.prepare(sql).statement,rows=[];try{while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return rows;}finally{statement.finalize();}}

// Expected rows were captured from pinned SQLite 3.53.4 source ID
// 2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc.
test('grouped IN retains every matching source row like the OR control',async()=>withDb(async db=>{
 const expected=[[1n,10n],[2n,1n]];
 assert.deepEqual(await values(db,'SELECT AlbumId,count(*) FROM Track WHERE AlbumId=1 OR AlbumId=2 GROUP BY AlbumId ORDER BY AlbumId'),expected,'OR control');
 assert.deepEqual(await values(db,'SELECT AlbumId,count(*) FROM Track WHERE AlbumId IN(1,2) GROUP BY AlbumId ORDER BY AlbumId'),expected,'IN must not advance or overwrite the aggregate producer cursor');
}));

test('GROUP BY resolves a result alias expression after source-name lookup misses',async()=>withDb(async db=>{
 const expected=[['2021',83n],['2022',83n],['2023',83n],['2024',83n],['2025',80n]];
 assert.deepEqual(await values(db,"SELECT substr(InvoiceDate,1,4),count(*) FROM Invoice GROUP BY substr(InvoiceDate,1,4) ORDER BY 1"),expected,'expression control');
 assert.deepEqual(await values(db,"SELECT substr(InvoiceDate,1,4) AS y,count(*) FROM Invoice GROUP BY y ORDER BY y"),expected,'resolveOrderGroupBy alias fallback');
}));

test('aggregate predicate scalar ORDER/LIMIT subquery retains its destination',async()=>withDb(async db=>{
 assert.deepEqual(await values(db,'SELECT AlbumId FROM Album ORDER BY AlbumId LIMIT 1'),[[1n]],'plain scalar producer control');
 assert.deepEqual(await values(db,'SELECT COUNT(*) FROM Track WHERE AlbumId=(SELECT MIN(AlbumId) FROM Album)'),[[10n]],'aggregate scalar producer control');
 assert.deepEqual(await values(db,'SELECT COUNT(*) FROM Track WHERE AlbumId=(SELECT AlbumId FROM Album ORDER BY AlbumId LIMIT 1)'),[[10n]],'ORDER/LIMIT scalar destination must survive outer predicate execution');
}));
