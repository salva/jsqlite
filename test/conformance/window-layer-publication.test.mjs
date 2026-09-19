import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {open} from '../../src/index.ts';

const fixture=new URL('../fixtures/special-window/matrix.db',import.meta.url);
const server=http.createServer((_req,res)=>{const stat=fs.statSync(fixture);res.writeHead(200,{'Content-Length':stat.size});fs.createReadStream(fixture).pipe(res)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
after(()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
const request=()=>new Request(`http://127.0.0.1:${server.address().port}/matrix.db`);

async function rows(sql){
  const db=await open(request());let statement;
  try{statement=db.prepare(sql).statement;const result=[];while(await statement.step()==='row')result.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return result}
  finally{try{statement?.finalize()}catch{}try{db.closeDeferred()}catch{}}
}

test('partition drain publishes every row for one bounded following layer',async()=>{
  const actual=await rows('SELECT id,last_value(n) OVER (PARTITION BY p ORDER BY k,id ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM t ORDER BY id');
  assert.equal(actual.length,5,'a completed partition drain must not lose all rows');
  assert.deepEqual(actual,[[1n,null],[2n,null],[3n,40n],[4n,40n],[5n,50n]]);
});

test('four incompatible/coerced window layers preserve payload and nonzero publication',async()=>{
  const actual=await rows(`SELECT id,
    rank() OVER (PARTITION BY p ORDER BY k,id),
    lead(n) OVER (PARTITION BY p ORDER BY id),
    last_value(n) OVER (PARTITION BY p ORDER BY k,id ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING),
    sum(id) OVER (PARTITION BY p ORDER BY n,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    FROM t ORDER BY id`);
  assert.equal(actual.length,5,'nested incompatible producers must publish, not collapse to zero rows');
  assert.deepEqual(actual,[[1n,1n,null,null,3n],[2n,2n,null,null,2n],[3n,1n,40n,40n,3n],[4n,2n,null,40n,7n],[5n,1n,null,50n,5n]]);
});

test('declared collation is inherited and explicit collation overrides it',async()=>{
  assert.deepEqual(await rows(`SELECT id,
    sum(id) OVER (PARTITION BY p),
    sum(id) OVER (PARTITION BY p COLLATE BINARY)
    FROM t ORDER BY id`),[[1n,3n,1n],[2n,3n,2n],[3n,7n,7n],[4n,7n,7n],[5n,5n,5n]]);
});
