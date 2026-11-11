// N-d71 original setup matrix and E A8 shared cases; no native answers as input.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.argv[2];
const {open}=await import(pathToFileURL(`${root}/src/index.ts`));
const queries=JSON.parse(fs.readFileSync(0,'utf8'));
const generation=JSON.parse(fs.readFileSync(`${root}/test/fixtures/CURRENT.json`)).generationId;
const stringify=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v instanceof Uint8Array?{hex:Buffer.from(v).toString('hex')}:v);
for(const enc of ['utf8','utf16le','utf16be'])for(const c of queries){
 const {id,sql}=c;
 const fixture=c.fixture==='subquery'?`subquery-${enc}`:`storage-p4096${enc==='utf8'?'':'-'+enc}`;
 const bytes=fs.readFileSync(`${root}/test/fixtures/generations/${generation}/generated/${fixture}.db`);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);
 let db;try{db=await open('https://audit.invalid/db');}finally{globalThis.fetch=old;}
 let s,phase='prepare';
 try{
  s=db.prepare(sql).statement;
  c.bindings?.forEach((v,i)=>s.bind(i+1,typeof v==='number'?BigInt(v):v));
  const metadata=Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));
  const runs=[];
  for(let cycle=0;cycle<2;cycle++){
   const rows=[];let code=101,error=null;
   phase='step';
   try{while(await s.step()==='row'){
    if(rows.length>=100)throw Error('probe row ceiling');
    rows.push(Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i)]));
   }}catch(e){if(e.kind!=='sqlite')throw e;code=e.code;error=e.message;}
   let reset=0;try{s.reset();}catch(e){if(e.kind!=='sqlite')throw e;reset=e.code;}
   runs.push({rows,code,error,reset});
  }
  console.log(stringify({enc,id,...(c.fixture==='subquery'?{metadata}:{}),runs}));
 }catch(e){if(e.kind!=='sqlite')throw e;console.log(stringify({enc,id,phase,error:e.message,code:e.code}));}
 finally{try{s?.finalize();}catch(e){if(e.kind!=='sqlite')throw e;}db.close();}
}
