import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=fs.realpathSync(process.argv[2]);
const {open}=await import(pathToFileURL(root+'/src/index.ts').href);
// Only SQL and bind inputs are admitted from native capture, never results.
const cases=JSON.parse(fs.readFileSync(0,'utf8'));
const generation=JSON.parse(fs.readFileSync(root+'/test/fixtures/CURRENT.json')).generationId;
const records=[];
for(const enc of ['utf8','utf16le','utf16be']){
 const bytes=fs.readFileSync(`${root}/test/fixtures/generations/${generation}/generated/subquery-${enc}.db`);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);
 let db;try{db=await open('https://fixture.invalid/cf01-paired');}finally{globalThis.fetch=old;}
 try{for(const item of cases.filter(c=>c.enc===enc)){
  const s=db.prepare(item.sql).statement;
  try{
   const metadata=Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return [m.name,m.declaredType,m.database,m.table,m.origin];});
   const runs=[];
   for(const bindings of item.bindings){
    for(const [index,value] of Object.entries(bindings))s.bind(Number(index),BigInt(value));
    const rows=[];let code=101,error=null,reset=0;
    try{
     while(await s.step()==='row'){
      if(rows.length>=100)throw Error('original witness row ceiling');
      rows.push(Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i)]));
     }
    }catch(e){code=e.code;error=e.message;}
    try{s.reset();}catch(e){reset=e.code;}
    runs.push({rows,bindings,code,error,reset});
   }
   records.push({enc,sql:item.sql,metadata,runs});
  }finally{s.finalize();}
 }}finally{db.close();}
}
console.log(JSON.stringify(records,(_,v)=>typeof v==='bigint'?v.toString():v instanceof Uint8Array?{hex:Buffer.from(v).toString('hex')}:v));
