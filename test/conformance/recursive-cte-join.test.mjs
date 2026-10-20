import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
// Exact common-checkpoint native capture (3.53.4), physical table consumer.
const root=new URL('../fixtures/recursive-join/',import.meta.url).pathname;
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`recursive physical join ${encoding}`,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(fs.readFileSync(`${root}/${encoding}-corrected.sqlite`));let db;
 try{
 db=await open('https://fixture.invalid/recursive');
 const prefix='WITH RECURSIVE r(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM r WHERE x<3) ';
 for(const [tail,expected] of [
  ['SELECT t.x FROM r JOIN t ON r.x=t.x',[[1n],[2n],[3n]]],
  ['SELECT sum(t.x) FROM r JOIN t ON r.x=t.x',[[6n]]],
  ['SELECT t.x,count(*) FROM r JOIN t ON r.x=t.x GROUP BY t.x HAVING count(*)>0 ORDER BY t.x',[[1n,1n],[2n,1n],[3n,1n]]],
  ['SELECT sum(t.x) FROM r JOIN t ON r.x=t.x WHERE t.x>8',[[null]]],
 ]){const s=db.prepare(prefix+tail).statement;try{if(tail==='SELECT t.x FROM r JOIN t ON r.x=t.x')assert.deepEqual(s.columnMetadata(0),{name:'x',declaredType:'INTEGER',database:'main',table:'t',origin:'x'});if(tail.startsWith('SELECT sum'))assert.deepEqual(s.columnMetadata(0),{name:'sum(t.x)',declaredType:null,database:null,table:null,origin:null});for(let run=0;run<2;run++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));assert.deepEqual(rows,expected);s.reset();}}finally{s.finalize();}}
 const companions=[
 ['WITH RECURSIVE r(x) AS (VALUES(?1) UNION ALL SELECT x+1 FROM r WHERE x<?2) SELECT sum(t.x) FROM r JOIN t ON r.x=t.x',[1n,3n],[[6n]]],
 ['WITH RECURSIVE r(x) AS (VALUES(1),(1) UNION ALL SELECT x+1 FROM r WHERE x<2) SELECT t.x FROM r JOIN t ON r.x=t.x ORDER BY t.x',[],[[1n],[1n],[2n],[2n]]],
 ['WITH RECURSIVE r(x) AS (VALUES(1),(1) UNION SELECT x+1 FROM r WHERE x<2) SELECT sum(t.x) FROM r JOIN t ON r.x=t.x',[],[[3n]]],
 ['WITH RECURSIVE r(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM r WHERE x<8 LIMIT 3 OFFSET 1) SELECT t.x FROM r JOIN t ON r.x=t.x ORDER BY t.x DESC LIMIT 1 OFFSET 1',[],[[2n]]],
 ['WITH RECURSIVE r(x) AS (SELECT 1 WHERE 0 UNION ALL SELECT x+1 FROM r WHERE x<2) SELECT sum(t.x) FROM r JOIN t ON r.x=t.x',[],[[null]]],
 ['WITH RECURSIVE r(x) AS (VALUES(NULL) UNION ALL SELECT x FROM r LIMIT 1) SELECT count(*) FROM r JOIN t ON r.x=t.x',[],[[0n]]],
 ];
 for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){const st=db.prepare(prefix+'SELECT sum(t.x) FROM r JOIN t ON r.x=t.x').statement;try{await assert.rejects(st.step(options),e=>e.kind===kind);assert.throws(()=>st.reset(),e=>e.kind===kind);assert.equal(await st.step(),'row');assert.equal(st.column(0),6n);}finally{st.finalize();}}
 const limited=await open('https://fixture.invalid/recursive',{limits:{maxPrivateEntries:1}});const bounded=limited.prepare(prefix+'SELECT sum(t.x) FROM r JOIN t ON r.x=t.x').statement;let first;
 try{await assert.rejects(bounded.step(),e=>{first=e;return e.kind==='limit';});assert.throws(()=>bounded.reset(),e=>e===first);}finally{bounded.finalize();limited.closeDeferred();}
 const longSql='WITH RECURSIVE r(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM r WHERE x<100000) SELECT sum(t.x) FROM r JOIN t ON r.x=t.x';
 const long=db.prepare(longSql).statement,controller=new AbortController();let fired=false;const timer=setTimeout(()=>{fired=true;controller.abort();},0);
 try{await assert.rejects(long.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.equal(fired,true);assert.throws(()=>long.reset(),e=>e.kind==='cancelled');}finally{clearTimeout(timer);long.finalize();}
 companions.push([prefix+'SELECT sum(t.x) FROM r RIGHT JOIN t ON r.x=t.x',[],[[6n]]]);
 for(const [sql,binds,expected] of companions){const s=db.prepare(sql).statement;try{for(let pass=0;pass<2;pass++){binds.forEach((value,i)=>s.bind(i+1,value));const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));assert.deepEqual(rows,expected,sql);s.reset();}}finally{s.finalize();}}
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});
