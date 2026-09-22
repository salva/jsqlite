import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const expectedDigest='7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15';
const fixture=process.env.CHINOOK_DB;if(!fixture)throw new Error('CHINOOK_DB is required');
const utf8=fs.readFileSync(fixture);assert.equal(crypto.createHash('sha256').update(utf8).digest('hex'),expectedDigest);
const sql='WITH top AS(SELECT AlbumId,count(*) AS n FROM Track GROUP BY AlbumId ORDER BY n DESC LIMIT 3) SELECT a.Title,t.n FROM top t JOIN Album a ON a.AlbumId=t.AlbumId ORDER BY t.n DESC';

async function open(body,run){const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':body.length});r.end(body)});await new Promise((ok,no)=>server.listen(0,'127.0.0.1',e=>e?no(e):ok()));let db;try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));await run(db)}finally{try{db?.closeDeferred()}catch{}await new Promise((ok,no)=>server.close(e=>e?no(e):ok()))}}
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'jsqlite-cte-lead-'));
const bodies={utf8};
for(const [name,pragma] of [['utf16le','UTF-16le'],['utf16be','UTF-16be']]){const out=path.join(directory,`${name}.sqlite`);execFileSync('python3',['-c',`import sqlite3,sys\ns=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); d.execute("PRAGMA encoding='${pragma}'"); s.backup(d); d.close(); s.close()`,fixture,out]);bodies[name]=fs.readFileSync(out)}
for(const [encoding,body] of Object.entries(bodies))test(`B3 ${encoding} executes grouped limited CTE join`,async()=>open(body,async db=>{
 const statement=db.prepare(sql).statement;
 try{
  assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name),['Title','n']);
  const rows=[];
  while(await statement.step()==='row')rows.push([statement.columnText(0),statement.columnInteger(1)]);
  assert.deepEqual(rows,[['Greatest Hits',57n],['Minha Historia',34n],['Unplugged',30n]]);
 }finally{statement.finalize()}
 const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row');assert.equal(reuse.columnInteger(0),1n)}finally{reuse.finalize()}
}));
test.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
