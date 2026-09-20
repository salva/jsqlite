import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const spec=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-ordinary-scalars.spec.json')));
const native=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-ordinary-scalars.native.json')));
const files=spec.scope.publicFetchFixtures;

// Whole rows owned by sibling cards or requiring unrelated relational features stay
// excluded. Mixed rows below use a source-shaped owned projection and compare only
// the corresponding immutable oracle columns; they grant no credit to siblings.
const excluded=new Set([
  'case-upper-ascii-unicode','case-upper-null-blob',
  'case-like-order-blob','case-like-escape','case-like-bad-escape',
  'case-round','case-format-boundaries','case-format-null-missing',
  'case-variadic-limit-1000','case-variadic-over-limit-1001',
  'case-minmax-overload-discriminator',
]);
const mixed={
  'case-bound-params':{
    sql:'SELECT upper(?1),instr(?2,?3),quote(?4)',
    columns:[0,1,2],
    parameters:[
      {index:1,value:'aZé'},
      {index:2,value:Uint8Array.from([0x61,0,0x62])},
      {index:3,value:Uint8Array.from([0,0x62])},
      {index:4,value:Uint8Array.from([0,0xff])},
    ],
  },
  'case-composed':{
    sql:"SELECT quote(upper(trim(' az '))), instr(lower('X')||':'||7,':'), unicode(substr('éx',1,1))",
    columns:[0,1,2],
  },
  'case-variadic-zero':{sql:'SELECT hex(char())',columns:[2]},
  'case-fixture-columns-text':{
    sql:'SELECT id, typeof(v), upper(v), lower(v), quote(v) FROM scalar_values WHERE id=1 OR id=4 ORDER BY id',
    columns:[0,1,2,3,4],
  },
};
const selected=process.env.ONLY_CASE;
const ids=new Set(spec.cases.filter(c=>!excluded.has(c.id)&&(!selected||c.id===selected)).map(c=>c.id));
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
let count=0;
try{
  for(const encoding of Object.keys(files)){
    const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(encoding)}`));
    try{
      for(const observation of native.observations.filter(x=>x.encoding===encoding&&ids.has(x.id))){
        process.stderr.write(`${observation.id}/${encoding}\n`);
        const projection=mixed[observation.id];
        let phase='prepare',statement,caught;const rows=[];
        try{
          statement=db.prepare(projection?.sql??observation.sql).statement;
          for(const parameter of projection?.parameters??[])statement.bind(parameter.index,parameter.value);
          phase='step';
          while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>typed(statement,i)));
        }catch(error){caught={error,phase};}
        finally{statement?.finalize();}
        if(observation.error){
          assert.ok(caught,`${observation.id}/${encoding}: expected ${observation.error.phase} error`);
          assert.equal(caught.phase,observation.error.phase,`${observation.id}/${encoding}: error phase`);
          assert.equal(caught.error.kind,'sqlite',`${observation.id}/${encoding}: error kind`);
          assert.equal(caught.error.code,observation.error.resultCode,`${observation.id}/${encoding}: result code`);
          assert.equal(caught.error.code&0xff,observation.error.primaryCode,`${observation.id}/${encoding}: primary code`);
          assert.equal(caught.error.extendedCode,observation.error.extendedCode,`${observation.id}/${encoding}: extended code`);
          assert.equal(caught.error.message,observation.error.message,`${observation.id}/${encoding}: error message`);
        }else{
          if(caught)throw caught.error;
          const expected=projection?.columns
            ? observation.rows.map(row=>projection.columns.map(index=>row[index]))
            : observation.rows;
          assert.deepEqual(rows,expected,`${observation.id}/${encoding}`);
        }
        count++;
      }
    }finally{db.closeDeferred();}
  }
// Pinned 3.53.4 sqlite3QuoteValue uses `%!0.17g` for manifest REAL. Values are
// public number bindings so even integral values cannot be folded to INTEGER.
{
  const encoding='UTF-8',db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(encoding)}`));
  try{
    const vectors=[
      [1,'1.0'],[-0,'0.0'],[0.1,'0.1'],[0.30000000000000004,'0.30000000000000004'],
      [9007199254740992,'9007199254740992.0'],[Number.MIN_VALUE,'4.9406564584124654e-324'],
      [Number.MAX_VALUE,'1.7976931348623157e+308'],[Infinity,'9.0e+999'],[-Infinity,'-9.0e+999'],
    ];
    const statement=db.prepare('SELECT typeof(?1),quote(?1)').statement;
    for(const [input,expected] of vectors){statement.bind(1,input);assert.equal(await statement.step(),'row');assert.equal(statement.columnText(0),'real');assert.equal(statement.columnText(1),expected);assert.equal(await statement.step(),'done');statement.reset();}
    statement.finalize();
  }finally{db.closeDeferred();}
}
// quote() rejects expansion before constructing oversized TEXT/BLOB strings.
{
  const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/${encodeURIComponent('UTF-8')}`),{limits:{maxResultBytes:8,maxWorkUnits:10000}});
  try{
    for(const value of ["''''",Uint8Array.from([1,2,3])]){
      const statement=db.prepare('SELECT quote(?1)').statement;statement.bind(1,value);
      await assert.rejects(()=>statement.step(),error=>error?.kind==='limit'&&error.message==='string or blob too big');assert.throws(()=>statement.finalize());
    }
  }finally{db.closeDeferred();}
}
// Web Crypto limits one getRandomValues request to 65,536 bytes. SQLite's
// randomblob() accepts larger results, so retain a public regression across chunks.
{
  const encoding='UTF-8',db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(encoding)}`));
  try{
    const statement=db.prepare('SELECT typeof(randomblob(65537)),length(randomblob(65537))').statement;
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnText(0),'blob');assert.equal(statement.columnInteger(1),65537n);
    assert.equal(await statement.step(),'done');statement.finalize();
  }finally{db.closeDeferred();}
}
}finally{await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({outcome:'pass',observations:count,cases:ids.size}));
