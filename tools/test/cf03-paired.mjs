import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=fs.realpathSync(process.argv[2]);
const {open}=await import(pathToFileURL(root+'/src/index.ts').href);
const cases=JSON.parse(fs.readFileSync(0,'utf8'));
const generation=JSON.parse(fs.readFileSync(root+'/test/fixtures/CURRENT.json')).generationId;
const json=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v);
for(const enc of ['utf8','utf16le','utf16be']){
 const bytes=fs.readFileSync(`${root}/test/fixtures/generations/${generation}/generated/subquery-${enc}.db`);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);
 let db;try{db=await open('https://fixture.invalid/cf03-paired');}finally{globalThis.fetch=old;}
 try{for(const [label,sql] of cases){
  const s=db.prepare(sql).statement;
  try{
   const m=s.columnMetadata(0),metadata=[m.name,m.declaredType,m.database,m.table,m.origin];
   const runs=[];
   for(let cycle=0;cycle<2;cycle++){
    const rows=[];let result;
    try{
     while(await s.step()==='row'){
      if(rows.length>=100)throw Error('original witness row ceiling');
      rows.push([s.columnType(0),s.column(0)]);
     }
     result={rows,code:101};s.reset();
    }catch(e){
     result={rows,code:e.code,phase:'step',kind:e.kind,error:e.message};
     let saved;try{s.reset();}catch(reset){saved=reset;}
     if(saved!==e)throw Error('reset did not preserve original step error');
    }
    runs.push(result);
   }
   console.log(json({enc,label,metadata,runs}));
  }finally{s.finalize();}
 }}finally{db.close();}
}
