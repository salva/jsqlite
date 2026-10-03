import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';

// The capture is independently produced with the manifest-pinned native library.
// This test never substitutes native counters for production-private evidence.
test('resolved ORDER consumption agrees with pinned native through public execution',async()=>{
 const work=process.env.SAIVAGE_CARD_WORK_ROOT;
 assert.ok(work,'card-local native capture is required');
 const capture=JSON.parse(fs.readFileSync(path.join(work,'r2-native','capture.json'),'utf8'));
 const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url),'utf8'));
 assert.equal(capture.sourceId,pin.sqliteSourceId);
 const root=path.join(work,'r2-public'),generation='r2-order',dir=path.join(root,'generations',generation);
 fs.mkdirSync(dir,{recursive:true});
 const fixtures=capture.variants.map((v,i)=>{const name=`order-${i}.sqlite`;fs.copyFileSync(v.fixture,path.join(dir,name));return{id:`order-${i}`,path:name,bytes:fs.statSync(v.fixture).size};});
 fs.writeFileSync(path.join(root,'CURRENT.json'),JSON.stringify({generationId:generation}));
 fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify({semantic:{fixtures}}));
 const bridge=await startFixtureServer(root),failures=[],evidence=[];
 const cell=v=>v===null?{type:'null'}:typeof v==='bigint'?{type:'integer',value:String(v)}:typeof v==='number'?{type:'real',ieee754be:(()=>{const b=Buffer.alloc(8);b.writeDoubleBE(v);return b.toString('hex');})()}:typeof v==='string'?{type:'text',utf8Hex:Buffer.from(v).toString('hex')}:{type:'blob',hex:Buffer.from(v).toString('hex')};
 try{for(const [i,variant] of capture.variants.entries()){
  const db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/order-${i}`));
  try{for(const c of variant.cases){let statement;try{
   statement=db.prepare(c.sql).statement;const runs=[];
   for(let replay=0;replay<2;replay++){
    if(replay)await statement.reset();
    const native=c.runs[replay];statement.clearBindings();native.params.forEach((v,j)=>statement.bind(j+1,BigInt(v)));
    for(let j=0;j<c.metadata.length;j++){const meta=statement.columnMetadata(j);assert.equal(meta.name,c.metadata[j].name);assert.equal(meta.declaredType,c.metadata[j].declaredType);}
    const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,j)=>cell(statement.column(j))));
    const accounting=privateAccounting(statement);runs.push({rows,accounting});
    const needsSorter=c.sql.includes('NULLS LAST')&&c.sql.includes('ASC')||c.sql.includes('NULLS FIRST')&&c.sql.includes('DESC')||c.sql.includes(' AS ')||c.sql.startsWith('SELECT k');
    if(needsSorter&&!c.sql.includes('ORDER BY 1'))assert.ok(accounting.sorterRows>0,c.sql);
    if(c.sql.includes('FROM t NOT INDEXED'))assert.equal(accounting.sorterRows,0,c.sql);
    if(c.sql.includes('INDEXED BY t_a ORDER'))assert.equal(accounting.indexNext,4,c.sql);
    try{assert.deepEqual(rows,native.rows);}catch{failures.push({encoding:variant.encoding,sql:c.sql,replay,expected:native.rows,actual:rows,accounting});}
   }
   evidence.push({encoding:variant.encoding,sql:c.sql,runs});
  }catch(error){failures.push({encoding:variant.encoding,sql:c.sql,error:{name:error.name,message:error.message,code:error.code}});}finally{if(statement)await statement.finalize();}}
  for(const native of variant.errors){
   let error;try{const result=db.prepare(native.sql);result.statement?.finalize();}catch(caught){error=caught;}
   assert.ok(error,native.sql);assert.equal(error.code,native.code);assert.equal(error.message,native.message);
  }
  }finally{db.closeDeferred();}
 }}finally{await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()));}
 fs.writeFileSync(path.join(work,'r2-public','evidence.json'),JSON.stringify({evidence,failures},null,2));
 console.log(`Native/public comparison: ${evidence.length} prepared cases; ${failures.length} failed executions/errors`);
 console.log(JSON.stringify(failures.slice(0,3)));
 assert.equal(failures.length,0,'ORDER consumption differs from pinned native');
});
