import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {Mem} from '../../src/internal/mem.ts';
const directory=process.env.SELECT_IN_NATIVE_DIR;
assert.ok(directory,'SELECT_IN_NATIVE_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
// Observe only the real prefix consumers, not producer MakeRecord affinity.
// Source-derived locations tolerate unrelated line movement; fail closed if the
// owning calls change. This seam neither replaces execution nor changes values.
const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8').split('\n');
const sites=['value.applyAffinity(op.affinities[index]!', 'case "IndexPrefixEnd": {'];
const frames=sites.map(site=>{
 const lines=source.flatMap((line,i)=>line.includes(site)&&(site.startsWith('case')||!line.includes('case'))?[i+1]:[]);
 assert.equal(lines.length,1,site);return `vdbe.ts:${lines[0]}:`;
});
const decode=cell=>cell.type==='null'?null:cell.type==='integer'?BigInt(cell.value):cell.type==='real'?Buffer.from(cell.ieee754be,'hex').readDoubleBE():cell.type==='text'?Buffer.from(cell.utf8Hex,'hex').toString('utf8'):cell.type==='blob'?new Uint8Array(Buffer.from(cell.hex,'hex')):assert.fail(cell.type);
for(const variant of capture.variants)test(`${variant.encoding}: SELECT-IN producer owns affinity before seek and prefix end`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db;
 const original=Mem.prototype.applyAffinity;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const name of ['affinity-forced','affinity-joined','affinity-joined-or']){
   const oracle=variant.cases[name];assert.ok(oracle,name);
   const observed=[[],[]];
   Mem.prototype.applyAffinity=function(affinity,...args){
    const stack=new Error().stack;
    frames.forEach((frame,i)=>{if(stack.includes(frame))observed[i].push(affinity)});
    return original.call(this,affinity,...args);
   };
   const statement=db.prepare(oracle.sql).statement;
   try{
    for(let run=0;run<2;run++){
     const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
     // SQL has no ORDER BY: compare typed multisets, retaining duplicates.
     const key=row=>JSON.stringify(row,(_,v)=>typeof v==='bigint'?{integer:String(v)}:v);
     assert.deepEqual(rows.map(key).sort(),oracle.rows.map(row=>key(row.map(decode))).sort(),name);
     assert.ok(privateAccounting(statement).inProbes>0,name);
     statement.reset();
    }
    for(let i=0;i<observed.length;i++){
     assert.ok(observed[i].length>0,`${name}: ${sites[i]} executed`);
     if(name!=='affinity-joined-or')assert.ok(observed[i].every(a=>a==='blob'),`${name}: duplicate affinity ${observed[i]}`);
     else {
      assert.ok(observed[i].includes('blob'),`${name}: SELECT-IN branch suppressed affinity`);
      assert.ok(observed[i].some(a=>a!=='blob'),`${name}: ordinary range/equality affinity retained`);
     }
    }
   }finally{Mem.prototype.applyAffinity=original;statement.finalize()}
  }
 }finally{Mem.prototype.applyAffinity=original;db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
