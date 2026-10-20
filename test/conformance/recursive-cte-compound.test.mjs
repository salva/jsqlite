import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const prefix='WITH RECURSIVE q(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<3) ';
const arm='SELECT q.x FROM q JOIN t ON t.x=q.x';
const cases=[
 [prefix+arm+' UNION SELECT x FROM u ORDER BY 1',[[1n],[2n],[3n],[4n]]],
 [prefix+arm+' UNION ALL SELECT x FROM u ORDER BY 1',[[1n],[2n],[2n],[3n],[3n],[4n]]],
 [prefix+arm+' UNION ALL SELECT x FROM u',[[1n],[2n],[3n],[2n],[3n],[4n]]],
 [prefix+arm+' UNION '+arm+' UNION SELECT x FROM u ORDER BY 1 DESC LIMIT 2 OFFSET 1',[[3n],[2n]]],
 [prefix+arm+' UNION ALL '+arm+' ORDER BY 1',[[1n],[1n],[2n],[2n],[3n],[3n]]],
 [prefix+'SELECT x FROM u UNION ALL '+arm+' ORDER BY 1',[[1n],[2n],[2n],[3n],[3n],[4n]]],
 ['WITH RECURSIVE q(x) AS(SELECT 1 WHERE 0 UNION ALL SELECT x+1 FROM q WHERE x<3) '+arm+' UNION SELECT x FROM u ORDER BY 1',[[2n],[3n],[4n]]],
 ['WITH RECURSIVE q(x) AS(VALUES(NULL) UNION ALL SELECT x FROM q LIMIT 1) SELECT q.x FROM q LEFT JOIN t ON t.x=q.x UNION ALL SELECT x FROM q ORDER BY 1',[[null],[null]]],
 ['WITH RECURSIVE q(x) AS(VALUES(\'a\' COLLATE NOCASE),(\'A\'),(\'b\') UNION ALL SELECT x FROM q LIMIT 3) SELECT q.x FROM q LEFT JOIN t ON 0 UNION SELECT x FROM q ORDER BY 1', [['a'],['b']]],
 [prefix+arm+' UNION ALL SELECT x FROM q LIMIT 0',[]],
];
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`recursive compound retained arms ${encoding}`,{timeout:60000},async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(`../fixtures/recursive-join/${encoding}-corrected.sqlite`,import.meta.url)));let db;
 try{db=await open('https://fixture.invalid/compound');
 for(const [sql,expected] of cases){const s=db.prepare(sql).statement;try{for(let run=0;run<2;run++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));assert.deepEqual(rows,expected,sql);s.reset();}}finally{s.finalize();}}
 const bound=db.prepare('WITH RECURSIVE q(x) AS(VALUES(?1) UNION ALL SELECT x+1 FROM q WHERE x<?2) '+arm+' UNION SELECT x FROM u ORDER BY 1 LIMIT ?3').statement;
 try{for(const start of [1n,3n]){bound.bind(1,start);bound.bind(2,3n);bound.bind(3,2n);const rows=[];while(await bound.step()==='row')rows.push(bound.column(0));assert.deepEqual(rows,start===1n?[1n,2n]:[2n,3n]);bound.reset();}}finally{bound.finalize();}
 for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){const s=db.prepare(cases[0][0]).statement;try{await assert.rejects(s.step(options),e=>e.kind===kind);assert.throws(()=>s.reset(),e=>e.kind===kind);assert.equal(await s.step(),'row');}finally{s.finalize();}}
 const lazy=db.prepare('WITH RECURSIVE q(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<100000) '+arm+' UNION ALL SELECT x FROM u LIMIT 0').statement;try{assert.equal(await lazy.step({maxWorkUnits:20}),'done');}finally{lazy.finalize();}
 assert.throws(()=>db.prepare(prefix+arm+' UNION SELECT x,x FROM u'),e=>e.kind==='sqlite'&&e.code===1&&/same number/.test(e.message));
 const limited=await open('https://fixture.invalid/compound',{limits:{maxPrivateEntries:1}});const st=limited.prepare(cases[0][0]).statement;try{await assert.rejects(st.step(),e=>e.kind==='limit');assert.throws(()=>st.reset(),e=>e.kind==='limit');}finally{st.finalize();limited.closeDeferred();}
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});
