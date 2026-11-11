// Relocated l-e CF06 public driver: SQL only, never native answers.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.argv[2];
const {open}=await import(pathToFileURL(`${root}/src/index.ts`));
const queries=JSON.parse(fs.readFileSync(0,'utf8'));
const generation=JSON.parse(fs.readFileSync(`${root}/test/fixtures/CURRENT.json`)).generationId;
const stringify=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v instanceof Uint8Array?{hex:Buffer.from(v).toString('hex')}:v);
for(const enc of ['utf8','utf16le','utf16be']){
 const bytes=fs.readFileSync(`${root}/test/fixtures/generations/${generation}/generated/subquery-${enc}.db`);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);
 let db;try{db=await open('https://audit.invalid/db');}finally{globalThis.fetch=old;}
 try{for(const [id,sql] of queries){let s;
  try{
   s=db.prepare(sql).statement;
   const metadata=Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));
   const runs=[];
   for(let cycle=0;cycle<2;cycle++){
    const rows=[];let status;
    while((status=await s.step())==='row'){
     if(rows.length>=100)throw Error('probe row ceiling');
     rows.push(Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i)]));
    }
    if(status!=='done')throw Error('expected DONE');
    runs.push(rows);s.reset();
   }
   console.log(stringify({enc,id,metadata,runs}));
  }finally{s?.finalize();}
 }}finally{db.close();}
}
