import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const prefix='WITH RECURSIVE q(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<3) ';
const cases=[
 [prefix+'SELECT q.x,t.x FROM q LEFT JOIN t ON q.x=t.x AND t.x<3 ORDER BY q.x',[[1n,1n],[2n,2n],[3n,null]]],
 [prefix+'SELECT t.x,q.x FROM t LEFT JOIN q ON t.x=q.x AND q.x<3 ORDER BY t.x',[[1n,1n],[2n,2n],[3n,null]]],
 [prefix+'SELECT t.x,q.x FROM t LEFT JOIN q ON t.x=q.x AND q.x<2 WHERE q.x IS NULL ORDER BY t.x',[[2n,null],[3n,null]]],
 [prefix+'SELECT t.x,q.x FROM t LEFT JOIN q ON t.x=q.x WHERE q.x<2 ORDER BY t.x',[[1n,1n]]],
 ['WITH RECURSIVE q(x) AS(SELECT 1 WHERE 0 UNION ALL SELECT x+1 FROM q WHERE x<3) SELECT t.x,q.x FROM t LEFT JOIN q ON t.x=q.x ORDER BY t.x',[[1n,null],[2n,null],[3n,null]]],
 ['WITH RECURSIVE q(x) AS(VALUES(NULL) UNION ALL SELECT x FROM q LIMIT 1) SELECT q.x,t.x FROM q LEFT JOIN t ON q.x=t.x',[[null,null]]],
 ['WITH RECURSIVE q(x) AS(VALUES(1),(1) UNION ALL SELECT x+1 FROM q WHERE x<2) SELECT t.x,q.x FROM t LEFT JOIN q ON t.x=q.x ORDER BY t.x,q.x',[[1n,1n],[1n,1n],[2n,2n],[2n,2n],[3n,null]]],
 ['WITH RECURSIVE q(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<8 ORDER BY 1 DESC LIMIT 3 OFFSET 1) SELECT t.x,q.x FROM t LEFT JOIN q ON t.x=q.x ORDER BY t.x DESC LIMIT 2',[[3n,3n],[2n,2n]]],
 [prefix+'SELECT t.x,count(q.x) FROM t LEFT JOIN q ON t.x=q.x AND q.x<3 GROUP BY t.x ORDER BY t.x',[[1n,1n],[2n,1n],[3n,0n]]],
 [prefix+'SELECT t.x,(SELECT q.x) FROM t LEFT JOIN q ON t.x=q.x AND q.x<2 ORDER BY t.x',[[1n,1n],[2n,null],[3n,null]]],
];
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`recursive LEFT retained source ${encoding}`,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(`../fixtures/recursive-join/${encoding}-corrected.sqlite`,import.meta.url)));let db;
 try{db=await open('https://fixture.invalid/left');
 for(const [index,[sql,expected]] of cases.entries()){
  const s=db.prepare(sql).statement;
  try{if(index<2)for(let i=0;i<2;i++)assert.deepEqual(s.columnMetadata(i),{name:'x',declaredType:(index===i)?null:'INTEGER',database:(index===i)?null:'main',table:(index===i)?null:'t',origin:(index===i)?null:'x'});
   for(let run=0;run<2;run++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));assert.deepEqual(rows,expected,sql);s.reset();}
  }finally{s.finalize();}
 }
 const sql='WITH RECURSIVE q(x) AS(VALUES(?1) UNION ALL SELECT x+1 FROM q WHERE x<?2) SELECT t.x,q.x FROM t LEFT JOIN q ON t.x=q.x ORDER BY t.x';
 const bound=db.prepare(sql).statement;
 try{for(const start of [1n,3n]){bound.bind(1,start);bound.bind(2,3n);const rows=[];while(await bound.step()==='row')rows.push([bound.column(0),bound.column(1)]);assert.deepEqual(rows,start===1n?[[1n,1n],[2n,2n],[3n,3n]]:[[1n,null],[2n,null],[3n,3n]]);bound.reset();}}finally{bound.finalize();}
 for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){const s=db.prepare(cases[1][0]).statement;try{await assert.rejects(s.step(options),e=>e.kind===kind);assert.throws(()=>s.reset(),e=>e.kind===kind);assert.equal(await s.step(),'row');}finally{s.finalize();}}
 const long=db.prepare('WITH RECURSIVE q(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<100000) SELECT t.x,q.x FROM t LEFT JOIN q ON t.x=q.x').statement;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),0);
 try{await assert.rejects(long.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.throws(()=>long.reset(),e=>e.kind==='cancelled');}finally{clearTimeout(timer);long.finalize();}
 const limited=await open('https://fixture.invalid/left',{limits:{maxPrivateEntries:1}});const st=limited.prepare(cases[1][0]).statement;try{await assert.rejects(st.step(),e=>e.kind==='limit');assert.throws(()=>st.reset(),e=>e.kind==='limit');}finally{st.finalize();limited.closeDeferred();}
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});
