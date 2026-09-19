import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {open,JSQLiteError} from '../../src/index.ts';

const root=path.resolve('test/fixtures/special-window');
const server=http.createServer((req,res)=>{const file=path.join(root,'matrix.db'),stat=fs.statSync(file);res.writeHead(200,{'Content-Length':stat.size});fs.createReadStream(file).pipe(res)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
after(()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
const request=()=>new Request(`http://127.0.0.1:${server.address().port}/special-window-source-only`);
const sql='SELECT id,lead(id) OVER (ORDER BY id),row_number() OVER (ORDER BY id) FROM t ORDER BY id';

async function scalarAdmission(db){const statement=db.prepare('SELECT 1').statement;try{assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n)}finally{statement.finalize()}}

test('special-window source-only private lifecycle control',async()=>{
 let db=await open(request(),{limits:{maxPrivateEntries:1}}),statement=db.prepare(sql).statement,first;
 try{
  await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>{first=error;return error instanceof JSQLiteError&&error.kind==='limit'});
  assert.throws(()=>statement.reset(),error=>error===first,'reset reports the retained first error');
 }finally{try{statement.finalize()}catch{}db.closeDeferred()}
 db=await open(request());statement=db.prepare(sql).statement;
 try{
  const controller=new AbortController();controller.abort('source-only cancellation');
  await assert.rejects(statement.step({signal:controller.signal}),error=>error instanceof JSQLiteError&&error.kind==='cancelled');
  assert.throws(()=>statement.reset(),error=>error instanceof JSQLiteError&&error.kind==='cancelled');
  assert.equal(await statement.step(),'row','acknowledged cancellation restarts without replaying a public row');
 }finally{statement.finalize();db.closeDeferred()}
});

test('special-window source-only context rejection is atomic',async()=>{
 const db=await open(request());
 try{
  for(const sql of [
   'SELECT id FROM t WHERE rank() OVER (ORDER BY id)',
   'SELECT id FROM t GROUP BY nth_value(id,1) OVER (ORDER BY id)',
  ]){
   assert.throws(()=>db.prepare(sql),error=>error instanceof JSQLiteError&&error.kind==='sqlite'&&error.message.startsWith('misuse of window function'));
   await scalarAdmission(db);
  }
 }finally{db.closeDeferred()}
});
