import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {open,JSQLiteError} from '../../src/index.ts';

const root=path.resolve('test/fixtures/aggregate-window');
async function server(){const s=http.createServer((req,res)=>{const file=path.join(root,'w2rows.db'),st=fs.statSync(file);res.writeHead(200,{'Content-Length':st.size});fs.createReadStream(file).pipe(res)});await new Promise((r,j)=>s.listen(0,'127.0.0.1',e=>e?j(e):r()));return s}
const request=s=>new Request(`http://127.0.0.1:${s.address().port}/window-private`);
const sql='SELECT a, sum(d) OVER (ORDER BY d ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM t1';
async function failure(s,limits,options,messages){const db=await open(request(s),{limits});const statement=db.prepare(sql).statement;let first;try{await assert.rejects(async()=>{while(await statement.step(options)==='row'){}},e=>{first=e;return e instanceof JSQLiteError&&e.kind==='limit'&&messages.includes(e.message)});assert.throws(()=>statement.reset(),e=>e===first)}finally{try{statement.finalize()}catch{}db.closeDeferred()}}

test('ordinal 44 validates aggregate-window private controls through public APIs',async()=>{const s=await server();try{
 await failure(s,{maxPrivateEntries:1},undefined,['sorter exceeds entry limit','ephemeral index exceeds entry limit']);
 await failure(s,{maxPrivateKeyBytes:1},undefined,['sorter key exceeds byte limit','ephemeral key exceeds byte limit']);
 await failure(s,{maxPrivateBytes:8},undefined,['sorter exceeds total byte limit','ephemeral index exceeds total byte limit']);
 await failure(s,{maxRows:1},undefined,['statement exceeds maxRows']);
 await failure(s,{}, {maxWorkUnits:1},['statement exceeds maxWorkUnits']);
 const db=await open(request(s)),statement=db.prepare(sql).statement,controller=new AbortController();controller.abort();await assert.rejects(statement.step({signal:controller.signal}),e=>e instanceof JSQLiteError&&e.kind==='cancelled');assert.throws(()=>statement.reset(),e=>e instanceof JSQLiteError&&e.kind==='cancelled');assert.equal(await statement.step(),'row','step after acknowledged cancellation restarts without replayed public row');statement.finalize();db.closeDeferred();
 const timed=await open(request(s)),timedStatement=timed.prepare(sql).statement;await assert.rejects(timedStatement.step({timeoutMs:0}),e=>e instanceof JSQLiteError&&e.message==='statement execution timed out');try{timedStatement.finalize()}catch{}timed.closeDeferred();
}finally{await new Promise((r,j)=>s.close(e=>e?j(e):r()))}});
