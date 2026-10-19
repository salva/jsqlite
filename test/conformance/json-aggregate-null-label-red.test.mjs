import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

// json.c:jsonObjectStep invokes jsonAppendSqlValue only for a non-NULL label.
for (const name of ['json_group_object','jsonb_group_object']) {
 test(`${name} NULL-label placeholders preserve inverse order without value admission`, async()=>{
  const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));
  let db;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
   async function rows(sql){const s=db.prepare(sql).statement,out=[];try{while(await s.step()==='row'){const value=s.column(0);out.push(value instanceof Uint8Array?Buffer.from(value).toString('hex').toUpperCase():value)}return out}finally{try{s.finalize()}catch{}}}
   const output=expr=>name.startsWith('jsonb')?`hex(${expr})`:expr;
   const empty=name.startsWith('jsonb')?'0C':'{}';
   for(const value of ['1',"x'ff'","x'0f'","zeroblob(10000)"])
    assert.deepEqual(await rows(`SELECT ${output(`${name}(NULL,${value})`)} FROM t1 WHERE x=0`),[empty]);
   // NULL first, middle, last: retain every row for xInverse, never its BLOB.
   for(const ignored of [0,1,2]) {
    const label=`CASE WHEN x%3=${ignored} THEN NULL ELSE x END`;
    const value=`CASE WHEN x%3=${ignored} THEN x'ff' ELSE x END`;
    const expected=Array.from({length:6},(_,i)=>{
     const members=Array.from({length:Math.min(i+1,2)},(_,j)=>i-Math.min(i,1)+j).filter(x=>x%3!==ignored);
     if(!name.startsWith('jsonb'))return `{${members.map(x=>`"${x}":${x}`).join(',')}}`;
     // Each one-digit name/value is 0x17 ASCII digit / 0x13 ASCII digit.
     return (members.length?`${(members.length*4).toString(16)}C`:'0C')+members.map(x=>`17${(48+x).toString(16)}13${(48+x).toString(16)}`).join('');
    });
    assert.deepEqual(await rows(`SELECT ${name}(${label},${value}) OVER (ORDER BY x ROWS 1 PRECEDING) FROM t1 WHERE x<6 ORDER BY x`),expected);
   }
   // Admission is skipped, not SQL evaluation: the scalar producer still fails.
   await assert.rejects(rows(`SELECT ${name}(NULL,json('!')) FROM t1 WHERE x=0`),e=>e.message==='malformed JSON');
   await assert.rejects(rows(`SELECT ${name}('k',x'ff') FROM t1 WHERE x=0`),e=>e.message==='JSON cannot hold BLOB values');
   assert.deepEqual(await rows(`SELECT ${output(`${name}(NULL,x'ff')`)} FROM t1 WHERE 0`),[empty]);
  } finally {try{db?.closeDeferred()}finally{await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}}
 });
}
