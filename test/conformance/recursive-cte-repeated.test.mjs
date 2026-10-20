import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const prefix='WITH RECURSIVE q(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<3) ';
// select.c tag-select-0484: one retained CteUse producer, independent OpenDup readers.
const cases=[
 [prefix+'SELECT a.x,b.x FROM q a JOIN q b ON a.x=b.x ORDER BY a.x,b.x',[[1n,1n],[2n,2n],[3n,3n]]],
 [prefix+'SELECT a.x,b.x FROM q a CROSS JOIN q b ORDER BY a.x,b.x LIMIT 4 OFFSET 1',[[1n,2n],[1n,3n],[2n,1n],[2n,2n]]],
 [prefix+'SELECT a.x,b.x FROM q a LEFT JOIN q b ON a.x=b.x AND b.x<3 ORDER BY a.x',[[1n,1n],[2n,2n],[3n,null]]],
 [prefix+'SELECT b.x,a.x FROM q b LEFT JOIN q a ON a.x=b.x AND a.x<2 ORDER BY b.x',[[1n,1n],[2n,null],[3n,null]]],
 [prefix+'SELECT a.x,count(b.x) FROM q a LEFT JOIN q b ON a.x=b.x AND b.x<3 GROUP BY a.x ORDER BY a.x',[[1n,1n],[2n,1n],[3n,0n]]],
 [prefix+'SELECT a.x,(SELECT b.x) FROM q a LEFT JOIN q b ON a.x=b.x AND b.x<2 ORDER BY a.x',[[1n,1n],[2n,null],[3n,null]]],
 ['WITH RECURSIVE q(x) AS(SELECT 1 WHERE 0 UNION ALL SELECT x+1 FROM q WHERE x<3) SELECT a.x,b.x FROM q a LEFT JOIN q b ON a.x=b.x',[]],
 ['WITH RECURSIVE q(x) AS(VALUES(NULL) UNION ALL SELECT x FROM q LIMIT 1) SELECT a.x,b.x FROM q a LEFT JOIN q b ON a.x=b.x',[[null,null]]],
 ['WITH RECURSIVE q(x) AS(VALUES(1),(1) UNION ALL SELECT x+1 FROM q WHERE x<2) SELECT a.x,count(b.x) FROM q a JOIN q b ON a.x=b.x GROUP BY a.x ORDER BY a.x',[[1n,4n],[2n,4n]]],
 ['WITH RECURSIVE q(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<8 ORDER BY 1 DESC LIMIT 3 OFFSET 1) SELECT a.x,b.x FROM q a JOIN q b ON a.x=b.x ORDER BY a.x DESC LIMIT 2',[[4n,4n],[3n,3n]]],
];
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`recursive shared producer readers ${encoding}`,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(`../fixtures/recursive-join/${encoding}-corrected.sqlite`,import.meta.url)));let db;
 try{db=await open('https://fixture.invalid/repeated');
 for(const [sql,expected] of cases){const s=db.prepare(sql).statement;try{for(let run=0;run<2;run++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));assert.deepEqual(rows,expected,sql);s.reset();}}finally{s.finalize();}}
 const s=db.prepare(cases[0][0]).statement;try{assert.deepEqual([s.columnMetadata(0),s.columnMetadata(1)],[0,1].map(()=>({name:'x',declaredType:null,database:null,table:null,origin:null})));}finally{s.finalize();}
 const bound=db.prepare('WITH RECURSIVE q(x) AS(VALUES(?1) UNION ALL SELECT x+1 FROM q WHERE x<?2) SELECT a.x,b.x FROM q a JOIN q b ON a.x=b.x ORDER BY a.x').statement;
 try{for(const start of [1n,3n]){bound.bind(1,start);bound.bind(2,3n);const rows=[];while(await bound.step()==='row')rows.push([bound.column(0),bound.column(1)]);assert.deepEqual(rows,start===1n?[[1n,1n],[2n,2n],[3n,3n]]:[[3n,3n]]);bound.reset();}}finally{bound.finalize();}
 for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){const s=db.prepare(cases[0][0]).statement;try{await assert.rejects(s.step(options),e=>e.kind===kind);assert.throws(()=>s.reset(),e=>e.kind===kind);assert.equal(await s.step(),'row');}finally{s.finalize();}}
 const long=db.prepare('WITH RECURSIVE q(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<100000) SELECT a.x,b.x FROM q a JOIN q b ON a.x=b.x').statement;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),0);try{await assert.rejects(long.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.throws(()=>long.reset(),e=>e.kind==='cancelled');}finally{clearTimeout(timer);long.finalize();}
 const limited=await open('https://fixture.invalid/repeated',{limits:{maxPrivateEntries:1}});const st=limited.prepare(cases[0][0]).statement;try{await assert.rejects(st.step(),e=>e.kind==='limit');assert.throws(()=>st.reset(),e=>e.kind==='limit');}finally{st.finalize();limited.closeDeferred();}
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});
