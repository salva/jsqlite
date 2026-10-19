import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-a-json-encoding-native.json',import.meta.url)));
assert.equal(native.version,'3.53.4');
assert.equal(native.sourceId,'2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc');
export function encodingCorpus(enc){
 assert.ok(['utf8','utf16le','utf16be'].includes(enc));
 test(`complete native encoding corpus ${enc}`,async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 const failures=[];
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  for(const [suite,data] of Object.entries(native.suites)){
   const rows=data.inputs;
   for(let i=0;i<rows.length;i++){
    const row=rows[i],binding=row.storage==='text'?Buffer.from(row.hex,'hex').toString('utf8'):Uint8Array.from(Buffer.from(row.hex,'hex'));
    for(const [kind,expected] of Object.entries(data.encodings[enc][i])){
     const sql=kind==='validation'?data.sql:kind==='render'?'SELECT hex(json(?1)),hex(jsonb(?1))':"SELECT json_type(?1),typeof(json_extract(?1,'$')),hex(json(jsonb(?1)))";
     const s=db.prepare(sql).statement;
     try{
      s.bind(1,binding);assert.deepEqual(expected.metadata.map((_,j)=>s.columnMetadata(j).name),expected.metadata);
      for(const observation of expected.steps){
       if(observation.error){await assert.rejects(s.step(),e=>e.kind==='sqlite'&&e.message===observation.error);assert.throws(()=>s.reset(),e=>e.kind==='sqlite');}
       else{
        assert.equal(await s.step(),'row');
        const values=observation.values.map((_,j)=>{const type=s.columnType(j),v=s.column(j);return {type,value:v===null?null:type==='blob'?Buffer.from(v).toString('hex'):String(v)}});
        assert.deepEqual(values,observation.values);s.reset();
       }
      }
     }catch(e){failures.push({suite,index:i,kind,hex:row.hex,message:e.message});}
     finally{try{s.finalize()}catch{}}
    }
   }
  }
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r));}
 fs.writeFileSync(new URL(`../../docs/research/card-r-a-json-encoding-${enc}-failures.json`,import.meta.url),JSON.stringify(failures,null,2));
 assert.equal(failures.length,0,JSON.stringify(failures.slice(0,3)));
});
}
