import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';

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
const observations=[];
try{
  for(const encoding of Object.keys(files)){
    const url=`http://127.0.0.1:${port}/${token}/${encodeURIComponent(encoding)}`;
    const db=await openFixture(new Request(url));
    try{
      for(const registration of absent){
        const argc=Math.min(...registration.effectiveScalarArities.map(x=>x.minimum));
        const args=Array(argc).fill('NULL').join(',');
        const sql=`SELECT "${registration.name}"(${args})`;
        let outcome;
        try{
          const result=db.prepare(sql);
          result.statement?.finalize();
          outcome={kind:'unexpected-success'};
        }catch(error){
          outcome={kind:error?.kind??null,code:error?.code??null,message:error?.message??String(error)};
        }
        assert.notEqual(outcome.kind,'unexpected-success',`${encoding} ${registration.name} unexpectedly implemented`);
        assert.match(outcome.message,/no such function|not implemented|temporarily unsupported|unsupported/i);
        observations.push({encoding,name:registration.name,sql,outcome});
      }
    }finally{db.closeDeferred();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
assert.equal(observations.length,Object.keys(files).length*absent.length);
assert.deepEqual([...new Set(observations.map(x=>x.name))].sort(),absent.map(x=>x.name).sort());
console.log(JSON.stringify({publicFetchFixtures:Object.keys(files).length,absentRegistrations:absent.length,observations:observations.length,outcome:'honest-unsupported-no-ts-credit'}));
