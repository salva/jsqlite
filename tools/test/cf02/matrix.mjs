import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// Relocated original N CF02 matrix; only source selection is parameterized.
const root=fs.realpathSync(process.argv[3] ?? process.cwd());
const {open}=await import(pathToFileURL(root+'/src/index.ts').href);
const generation=JSON.parse(fs.readFileSync(root+'/test/fixtures/CURRENT.json')).generationId;
export const queries=[["Q0", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT n FROM c"], ["Q1", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT c.n FROM c"], ["Q2", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT a.n FROM c a"], ["Q3", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT wrong.n FROM c"], ["Q4", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT c.n FROM c a"], ["Q5", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT main.c.n FROM c"], ["Q6", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT n AS x,x FROM c"], ["Q7", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT wrong.n FROM c LIMIT 0"], ["Q8", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT wrong.n,missing FROM c"], ["Q9", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT n FROM c a JOIN c b ON a.n=b.n"], ["Q10", "WITH RECURSIVE c(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT EXISTS(SELECT wrong.n FROM c)"]];
if(process.argv[2]==='queries'){console.log(JSON.stringify(queries));process.exit(0);}
const stringify=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v instanceof Uint8Array?{hex:Buffer.from(v).toString('hex')}:v);
for(const enc of ['utf8','utf16le','utf16be']){
 const bytes=fs.readFileSync(`${root}/test/fixtures/generations/${generation}/generated/subquery-${enc}.db`);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);
 let db;try{db=await open('https://audit.invalid/db');}finally{globalThis.fetch=old;}
 try{for(const [id,sql] of queries){if(process.argv[2]&& !process.argv[2].split(',').includes(id))continue;let s,phase='prepare';try{
  s=db.prepare(sql).statement;const metadata=Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));phase='step';
  const runs=[];for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row'){if(rows.length>100)throw Error('probe row ceiling');rows.push(Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i)]));}runs.push(rows);s.reset();}
  console.log(stringify({enc,id,metadata,runs}));
 }catch(e){console.log(stringify({enc,id,phase,error:e.message,kind:e.kind,code:e.code}));}finally{s?.finalize();}}}finally{db.close();}
}
