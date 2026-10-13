import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
const {open}=await import(process.env.JSON_ROWID_SOURCE?pathToFileURL(process.env.JSON_ROWID_SOURCE).href:'../../src/index.ts');
const root=new URL('../fixtures/',import.meta.url);
const g=JSON.parse(fs.readFileSync(new URL('CURRENT.json',root))).generationId;
const bytes=fs.readFileSync(process.env.JSON_ROWID_DB??new URL(`generations/${g}/generated/select4-t1.db`,root));
const cases=[
 ["SELECT t.rowid,j.rowid,j._rowid_,j.oid FROM t1 t CROSS JOIN json_each('[10,20]') j WHERE t.rowid<3",[[1n,0n,0n,0n],[1n,1n,1n,1n],[2n,0n,0n,0n],[2n,1n,1n,1n]]],
 ["SELECT t.rowid,j.rowid FROM t1 t LEFT JOIN json_each('[]') j ON 1 WHERE t.rowid<3",[[1n,null],[2n,null]]],
 ["SELECT t.rowid,count(j.rowid) FROM t1 t LEFT JOIN json_each('[]') j ON 1 GROUP BY t.rowid HAVING t.rowid<3",[[1n,0n],[2n,0n]]],
 ["SELECT sum(j.rowid),sum(j._rowid_),sum(j.oid) FROM t1 t CROSS JOIN json_each('[10,20]') j",[[31n,31n,31n]]],
 ["SELECT j.rowid,count(*) FROM t1 t CROSS JOIN json_each('[10,20]') j GROUP BY j.rowid",[[0n,31n],[1n,31n]]],
 ["SELECT sum(t.rowid),sum(t._rowid_),sum(t.oid) FROM t1 t CROSS JOIN json_each('[10,20]') j",[[992n,992n,992n]]],
 ["SELECT count(j.rowid),sum(j.rowid) FROM t1 t LEFT JOIN json_each('[]') j ON 1",[[0n,null]]],
 ["SELECT count(*) FILTER (WHERE j.rowid=1) FROM t1 t CROSS JOIN json_each('[10,20]') j",[[31n]]],
 ["SELECT j._rowid_,count(*) FROM t1 t CROSS JOIN json_each('[10,20]') j GROUP BY j._rowid_ HAVING j.oid=1",[[1n,31n]]],
];
for(const [sql,want] of cases)test(sql,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://fixture.invalid/rowid');}finally{globalThis.fetch=old;}
 let s;try{s=db.prepare(sql).statement;for(let pass=0;pass<2;pass++){
  const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const value=s.column(i);assert.equal(s.columnType(i),value===null?'null':'integer');return value;}));
  assert.deepEqual(rows,want,sql);if(!pass)s.reset();
 }}finally{try{s?.finalize();}finally{db.close();}}
});
