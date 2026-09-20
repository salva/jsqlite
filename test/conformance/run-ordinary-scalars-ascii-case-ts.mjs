import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const spec=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-ordinary-scalars.spec.json'),'utf8'));
const native=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-ordinary-scalars.native.json'),'utf8'));
const wanted=new Set(['case-upper-ascii-unicode','case-upper-null-blob']);
const files=spec.scope.publicFetchFixtures;
const server=http.createServer((req,res)=>{
  const encoding=Object.keys(files).find(x=>req.url===`/${encodeURIComponent(x)}`);
  if(!encoding){res.writeHead(404).end();return;}
  const fixture=path.join(root,files[encoding]); const stat=fs.statSync(fixture);
  res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':stat.size,'Content-Encoding':'identity'});
  fs.createReadStream(fixture).pipe(res);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
function typed(statement,index){const type=statement.columnType(index),value=statement.column(index);if(type==='null')return {type};if(type==='integer')return {type,value:String(value)};if(type==='real')return {type,value:Number(value).toString()};if(type==='blob')return {type,hex:Buffer.from(value).toString('hex')};return {type,utf8Hex:Buffer.from(new TextEncoder().encode(value)).toString('hex'),value};}
let observations=0;
try{
  for(const encoding of Object.keys(files)){
    const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(encoding)}`));
    try{
      for(const testCase of spec.cases.filter(x=>wanted.has(x.id)&&x.encodings.includes(encoding))){
        const expected=native.observations.find(x=>x.id===testCase.id&&x.encoding===encoding);
        assert.ok(expected,`${testCase.id}/${encoding} native observation`);
        const prepared=db.prepare(testCase.sql),statement=prepared.statement,rows=[];
        while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>typed(statement,i)));
        statement.finalize(); assert.deepEqual(rows,expected.rows,`${testCase.id}/${encoding}`); observations++;
      }
    }finally{db.closeDeferred();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
assert.equal(observations,4);
console.log(JSON.stringify({outcome:'pass',publicFetchFixtures:3,observations,families:['upper','lower'],coverage:['no-FROM','ASCII-byte-only','BLOB-to-TEXT','embedded-NUL','NULL']}));
