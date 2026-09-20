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
let observations=0,boundaries=0,sourceDiscriminators=0,compositions=0,lifecycle=0;
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

      // Pinned func.c patternCompare discriminators. Keep these public-API based:
      // they exercise parser reversal, Function dispatch and database decoding too.
      const sourceCases=[
        ["SELECT 'ab' LIKE 'a_'",1n], ["SELECT 'ab' LIKE 'a%'",1n],
        ["SELECT 'Æ' LIKE 'æ'",0n], ["SELECT 'Z' LIKE 'z'",1n],
        ["SELECT 'abc' GLOB 'a?c'",1n], ["SELECT 'abcd' GLOB 'a*d'",1n],
        ["SELECT 'b' GLOB '[a-c]'",1n], ["SELECT 'd' GLOB '[^a-c]'",1n],
        ["SELECT ']' GLOB '[]]'",1n], ["SELECT '-' GLOB '[-a]'",1n],
        ["SELECT 'b' GLOB '[c-a]'",0n], ["SELECT 'a' GLOB '[abc'",0n],
        ["SELECT 'a' GLOB '[]'",0n], ["SELECT '[' GLOB '['",0n],
        ["SELECT 'a%b' LIKE 'a%%b' ESCAPE '%'",1n],
        ["SELECT 'a_b' LIKE 'a__b' ESCAPE '_'",1n],
        ["SELECT 'a%b' LIKE 'aé%b' ESCAPE 'é'",1n],
        ["SELECT 'é' LIKE '_'",1n], ["SELECT 'é' GLOB '?'",1n],
        ["SELECT NULL GLOB '*'",null], ["SELECT 'x' LIKE NULL",null],
        ["SELECT 'ab' LIKE 'ab' || char(0) || '%'",1n],
      ];
      for(const [sql,expected] of sourceCases){assert.equal(await scalar(db,sql),expected,sql);sourceDiscriminators++;}
      assert.equal(await scalar(db,"SELECT ?1 GLOB ?2",['b','[a-c]']),1n);sourceDiscriminators++;
      assert.equal(await scalar(db,"SELECT ?1 LIKE ?2 ESCAPE ?3",['a%b','a!%b','!']),1n);sourceDiscriminators++;
      assert.equal(await scalar(db,"SELECT ?1 LIKE ?2 ESCAPE ?3",['a%b','a!%b','!\0tail']),1n);sourceDiscriminators++;
      assert.equal(await scalar(db,"SELECT ?1 LIKE ?2",[new Uint8Array([0x61,0x62,0x63]),'a%']),encoding==='UTF-8'?1n:0n);sourceDiscriminators++;

      // Error ownership: arity is prepare-time resolution; ESCAPE validation and
      // pattern limits are step-time function errors with SQLite's exact shape.
      for(const [sql,message] of [["SELECT like('x')","wrong number of arguments to function like()"],["SELECT glob('x','x','x')","wrong number of arguments to function glob()"]]){
        assert.throws(()=>db.prepare(sql),e=>e.kind==='sqlite'&&e.code===1&&e.extendedCode===1&&e.message===message);sourceDiscriminators++;
      }
      for(const escape of ['', 'ab']){
        let statement=db.prepare("SELECT 'x' LIKE 'x' ESCAPE ?1").statement,caught;
        statement.bind(1,escape);try{await statement.step()}catch(error){caught=error}
        assert.ok(caught);assert.deepEqual({kind:caught.kind,code:caught.code,extendedCode:caught.extendedCode,message:caught.message},{kind:'sqlite',code:1,extendedCode:1,message:'ESCAPE expression must be a single character'});
        assert.throws(()=>statement.reset(),e=>e===caught);statement.bind(1,'!');assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);statement.finalize();lifecycle++;
      }
      assert.equal(await scalar(db,"SELECT 'x' LIKE 'x' ESCAPE NULL"),null);sourceDiscriminators++;

      // Represented caller compositions over physical columns through Fetch.
      assert.deepEqual(await scalar(db,"SELECT count(*) FROM users WHERE name LIKE '%a%'"),2n);compositions++;
      assert.equal(await scalar(db,"SELECT name LIKE ?1 FROM users WHERE id=1",['A%']),1n);compositions++;
      assert.equal(await scalar(db,"SELECT u.name GLOB 'A*' FROM users u JOIN users v ON u.id=v.id WHERE v.id=1"),1n);compositions++;
      assert.equal(await scalar(db,"SELECT name LIKE '%a%' FROM (SELECT name FROM users WHERE id=3)"),1n);compositions++;

      // A failed pattern invocation retains first-error identity through reset,
      // then the same statement/context route is reusable with rebound values.
      {const statement=db.prepare('SELECT ?1 LIKE ?2').statement;statement.bind(1,'x');statement.bind(2,'x'.repeat(50001));let first;
       try{await statement.step()}catch(error){first=error}assert.ok(first);await assert.rejects(()=>statement.step(),e=>e===first);assert.throws(()=>statement.reset(),e=>e===first);
       statement.bind(1,'abc');statement.bind(2,'a%');assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);statement.finalize();lifecycle++;}
      // Adversarial wildcard search must hit translated work accounting rather
      // than recurse/hang; timeout-zero independently checks the deadline path.
      await assert.rejects(()=>scalar(db,'SELECT ?1 LIKE ?2',['a'.repeat(12000),'%a%a%a%a%b'],{maxWorkUnits:8}),e=>e.kind==='limit'&&e.message==='statement exceeds maxWorkUnits');sourceDiscriminators++;

    }finally{db.closeDeferred();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({outcome:'pass',observations,boundaries,sourceDiscriminators,compositions,lifecycle}));
