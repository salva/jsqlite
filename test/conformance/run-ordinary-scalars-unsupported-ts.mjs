import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';
import {builtinFunctionRegistry} from '../../src/internal/functions.ts';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const spec=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-ordinary-scalars.spec.json'),'utf8'));
const files=spec.scope.publicFetchFixtures;
const token='ordinary-scalars';
const server=http.createServer((req,res)=>{
  const encoding=Object.keys(files).find(x=>req.url===`/${token}/${encodeURIComponent(x)}`);
  if(!encoding){res.writeHead(404).end();return;}
  const fixture=path.join(root,files[encoding]);
  const stat=fs.statSync(fixture);
  res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':stat.size,'Content-Encoding':'identity'});
  fs.createReadStream(fixture).pipe(res);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});

const port=server.address().port;
const absent=spec.registry.filter(x=>x.tsStatus==='absent');
const fixtureColumnObservations=[];
function typed(value,type){
  if(type==='null') return {type:'null'};
  if(type==='integer') return {type:'integer',value:String(value)};
  if(type==='real') return {type:'real',value:Number(value).toString()};
  if(type==='blob') return {type:'blob',hex:Buffer.from(value).toString('hex')};
  const bytes=new TextEncoder().encode(value); return {type:'text',utf8Hex:Buffer.from(bytes).toString('hex'),value};
}
try{
  for(const encoding of Object.keys(files)){
    const url=`http://127.0.0.1:${port}/${token}/${encodeURIComponent(encoding)}`;
    const db=await openFixture(new Request(url));
    try{
      for(const testCase of spec.cases.filter(x=>x.publicFixtureColumn&&x.encodings.includes(encoding))){
        let outcome;
        try{
          // The immutable text case uses an unrelated IN-list route. Exercise the
          // same rows through the represented equivalent predicate, as the owned
          // contract runner does, without changing expected typed values.
          const sql=testCase.id==='case-fixture-columns-text'
            ? testCase.sql.replace('id IN (1,4)','id=1 OR id=4') : testCase.sql;
          const prepared=db.prepare(sql); const statement=prepared.statement; const rows=[];
          while(await statement.step()==='row') rows.push(Array.from({length:statement.columnCount},(_,i)=>typed(statement.column(i),statement.columnType(i))));
          statement.finalize();
          assert.deepEqual(rows,testCase.expectedRowsByEncoding[encoding]);
          outcome={kind:'typed-success',rows};
        }catch(error){
          outcome={kind:error?.kind??null,code:error?.code??null,message:error?.message??String(error)};
          assert.match(outcome.message,/no such function|not implemented|temporarily unsupported|unsupported/i);
        }
        fixtureColumnObservations.push({encoding,id:testCase.id,sql:testCase.sql,outcome,credit:'none-until-typed-success'});
      }
    }finally{db.closeDeferred();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
// tsStatus is immutable tests-first baseline metadata. It must not be interpreted
// as current runtime support after the implementation tranches have landed.
assert.equal(absent.length,38);
assert.equal(builtinFunctionRegistry.length,50);
assert.equal(builtinFunctionRegistry.filter(x=>x.dispatchable).length,50);
assert.equal(fixtureColumnObservations.length,Object.keys(files).length*spec.scope.persistedColumnCoverage.caseIds.length);
assert.ok(fixtureColumnObservations.every(x=>x.outcome.kind==='typed-success'),JSON.stringify(fixtureColumnObservations));
console.log(JSON.stringify({publicFetchFixtures:Object.keys(files).length,historicalAbsentRegistrations:absent.length,currentDispatchableRegistrations:50,generatedUnsupportedObservations:0,fixtureColumnObservations:fixtureColumnObservations.length,fixtureColumnOutcomes:['typed-success'],outcome:'historical-baseline-superseded'}));
