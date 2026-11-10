import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
for(const encoding of ['utf8','utf16le','utf16be'])test(`CF03 ordinary ALL destinations ${encoding}`,async()=>{
 const g=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${g}/generated/subquery-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/cf03');}finally{globalThis.fetch=old;}
 async function check(sql,want,binds=[]){const s=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){binds.forEach((v,i)=>s.bind(i+1,v));const rows=[];while(await s.step()==='row')rows.push([s.columnType(0),s.column(0)]);assert.deepEqual(rows,want,sql);s.reset();}}finally{s.finalize();}}
 try{
  await check('SELECT count(*) AS n FROM t1 UNION ALL SELECT count(*) FROM t1',[['integer',4n],['integer',4n]]);
  for(const [child,want] of [
   ["SELECT count(*) FROM t1 UNION ALL SELECT json_extract('bad','$') FROM t1",4n],
   ['SELECT a FROM t1 WHERE 0 GROUP BY a UNION ALL SELECT count(*) FROM t1',4n],
   ['SELECT count(*) FROM t1 HAVING count(*)<0 UNION ALL SELECT count(*) FROM t1',4n],
   ['SELECT count(*) FROM t1 UNION ALL SELECT count(*) FROM t1 LIMIT 0',null],
   ['SELECT count(*) FROM t1 UNION ALL SELECT count(*) FROM t1 LIMIT -1 OFFSET 1',4n],
   ['SELECT count(*) FROM t1 UNION ALL SELECT count(*) FROM t1 LIMIT 1 OFFSET 2',null],
  ]){
   await check(`SELECT (${child})`,[[want===null?'null':'integer',want]]);
   await check(`SELECT EXISTS(${child})`,[['integer',want===null?0n:1n]]);
  }
  for(const [expr,type,value] of [['1.25','real',1.25],["'é'",'text','é'],["x'00ff'",'blob',new Uint8Array([0,255])],['NULL','null',null]]){
   await check(`SELECT (SELECT ${expr} FROM t1 GROUP BY a UNION ALL SELECT count(*) FROM t1)`,[[type,value]]);
  }
  await check('SELECT (SELECT count(*)+?1 FROM t1 UNION ALL SELECT ?2 FROM t1 LIMIT ?3 OFFSET ?4)',[['integer',9n]],[5n,17n,1n,0n]);
  // EXISTS elides EList evaluation, Mem does not; later-arm errors stop only
  // after an accepted first row. Preparation still validates unused arms.
  await check("SELECT EXISTS(SELECT json_extract('bad','$') FROM t1 GROUP BY a UNION ALL SELECT count(*) FROM t1)",[['integer',1n]]);
  const s=db.prepare("SELECT (SELECT a FROM t1 WHERE 0 GROUP BY a UNION ALL SELECT json_extract('bad','$') FROM t1)").statement;
  try{for(let cycle=0;cycle<2;cycle++){let saved;await assert.rejects(()=>s.step(),e=>{saved=e;return e.kind==='sqlite'&&e.message==='malformed JSON';});assert.throws(()=>s.reset(),e=>e===saved);}}finally{s.finalize();}
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM t1 UNION ALL SELECT missing FROM t1)'),e=>e.kind==='sqlite');
  await check('SELECT (SELECT count(*) FROM t1 AS i WHERE i.a=o.a UNION ALL SELECT count(*) FROM t1) FROM t1 AS o',Array.from({length:4},()=>['integer',1n]));
 }finally{db.close();}
});
