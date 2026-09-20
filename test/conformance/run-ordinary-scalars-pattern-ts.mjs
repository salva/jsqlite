import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const spec=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-ordinary-scalars.spec.json')));
const native=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-ordinary-scalars.native.json')));
const files=spec.scope.publicFetchFixtures;
const ids=new Set(['case-like-order-blob','case-like-escape','case-like-bad-escape']);
const server=http.createServer((req,res)=>{
  const encoding=Object.keys(files).find(x=>req.url===`/${encodeURIComponent(x)}`);
  if(!encoding)return res.writeHead(404).end();
  const fixture=path.join(root,files[encoding]),stat=fs.statSync(fixture);
  res.writeHead(200,{'Content-Length':stat.size});fs.createReadStream(fixture).pipe(res);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
function typed(statement,index){
  const type=statement.columnType(index),value=statement.column(index);
  if(type==='null')return{type};
  if(type==='integer')return{type,value:String(value)};
  if(type==='real')return{type,value:Number(value).toString()};
  if(type==='blob')return{type,hex:Buffer.from(value).toString('hex')};
  return{type,utf8Hex:Buffer.from(new TextEncoder().encode(value)).toString('hex'),value};
}
async function scalar(db,sql,bindings=[],options){
  const statement=db.prepare(sql).statement;
  try{
    bindings.forEach((value,index)=>statement.bind(index+1,value));
    assert.equal(await statement.step(options),'row');
    return statement.column(0);
  }finally{try{statement.finalize()}catch{}}
}
let observations=0,boundaries=0;
try{
  for(const encoding of Object.keys(files)){
    const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(encoding)}`));
    try{
      for(const observation of native.observations.filter(x=>x.encoding===encoding&&ids.has(x.id))){
        let phase='prepare',statement,caught;const rows=[];
        try{
          statement=db.prepare(observation.sql).statement; phase='step';
          while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>typed(statement,i)));
        }catch(error){caught={error,phase};}
        finally{
          // A failed step is the statement's saved error. finalize() must repeat it;
          // retain the first error rather than allowing cleanup to mask it.
          try{statement?.finalize()}catch(error){if(!caught)caught={error,phase:'finalize'};else assert.equal(error.message,caught.error.message);}
        }
        if(observation.error){
          assert.ok(caught);assert.equal(caught.phase,observation.error.phase);
          assert.equal(caught.error.kind,'sqlite');assert.equal(caught.error.code,observation.error.resultCode);
          assert.equal(caught.error.extendedCode,observation.error.extendedCode);assert.equal(caught.error.message,observation.error.message);
        }else{if(caught)throw caught.error;assert.deepEqual(rows,observation.rows);}
        observations++;
      }
      // Source-shaped patternCompare boundaries through the public Fetch API.
      assert.equal(await scalar(db,"SELECT 'abcd' GLOB 'a[b-d][^x]d'"),1n);boundaries++;
      assert.equal(await scalar(db,"SELECT 'a%b' LIKE 'a!%b' ESCAPE '!'"),1n);boundaries++;
      assert.equal(await scalar(db,'SELECT ?1 LIKE ?2',['ab\0tail','ab%']),1n);boundaries++;
      assert.equal(await scalar(db,'SELECT NULL LIKE ?1',['%']),null);boundaries++;
      await assert.rejects(async()=>scalar(db,'SELECT ?1 LIKE ?2',['x','x'.repeat(50001)]),e=>e.kind==='sqlite'&&e.code===1&&e.message==='LIKE or GLOB pattern too complex');boundaries++;
      await assert.rejects(async()=>scalar(db,'SELECT ?1 LIKE ?2',['a'.repeat(4000),'%b%'],{maxWorkUnits:40}),e=>e.kind==='limit'&&e.message==='statement exceeds maxWorkUnits');boundaries++;
      const controller=new AbortController();controller.abort();
      await assert.rejects(async()=>scalar(db,"SELECT 'abc' GLOB '*'",[],{signal:controller.signal}),e=>e.kind==='cancelled');boundaries++;
      await assert.rejects(async()=>scalar(db,"SELECT 'abc' LIKE '%'",[],{timeoutMs:0}),e=>e.kind==='timeout');boundaries++;
    }finally{db.closeDeferred();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({outcome:'pass',observations,boundaries}));
