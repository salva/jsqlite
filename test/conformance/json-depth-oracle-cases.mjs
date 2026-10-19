import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
const receipt=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-b-depth-native.json',import.meta.url),'utf8'));
const header=(type,n,wide)=>wide?[0xe0+type,0,0,n>>8,n&255]:n<=11?[n*16+type]:n<=255?[0xc0+type,n]:[0xd0+type,n>>8,n&255];
function document({depth,shape,leaf,wide,text}){
 let b=text?{null:'null',integer:'1',array:'[]',object:'{}'}[leaf]:Uint8Array.from({null:[0],integer:[0x13,49],array:[11],object:[12]}[leaf]);
 for(let i=0;i<depth;i++){
  const obj=shape==='object'||shape==='mixed'&&i%2===1;
  if(text)b=obj?'{"a":'+b+'}':'['+b+']';
  else{const h=header(obj?12:11,b.length+(obj?2:0),wide),n=new Uint8Array(h.length+(obj?2:0)+b.length);n.set(h);if(obj)n.set([23,97],h.length);n.set(b,h.length+(obj?2:0));b=n}
 }return b;
}
// Explicit per-file shape/depth scheduling keeps every original receipt row and
// statement lifecycle intact under the integration runner's unchanged 30s limit.
export function registerDepthOracle(enc,shape,depth){
 assert.ok(['utf8','utf16le','utf16be'].includes(enc));
 assert.ok(['array','object','mixed'].includes(shape));
 assert.ok([999,1000,1001].includes(depth));
 const rows=receipt.rows.filter(r=>r.enc===enc);
 assert.equal(rows.length,432);
 assert.equal(rows.filter(r=>r.case.shape===shape).length,144);
 const selected=rows.filter(r=>r.case.shape===shape&&r.case.depth===depth);
 assert.equal(selected.length,48);
 test(`pinned depth admission versus render ${enc} ${shape} depth ${depth}`,async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  for(const item of selected){
   const s=db.prepare('SELECT '+item.expression).statement,label=JSON.stringify([item.case,item.expression]);
   try{
    s.bind(1,document(item.case));
    for(let repeat=0;repeat<2;repeat++){
     let error;const state=await s.step().catch(e=>{error=e});
     if(item.result.error){assert.equal(error?.kind,'sqlite',label);assert.equal(error?.code,item.result.code,label);assert.equal(error?.message,item.result.error,label);await assert.rejects(s.step(),e=>e===error);assert.throws(()=>s.reset(),e=>e===error)}
     else{
      assert.equal(error,undefined,label);assert.equal(state,'row',label);assert.equal(s.columnType(0),item.result.type,label);
      if(item.result.type==='text'){const raw=new TextEncoder().encode(s.column(0));assert.equal(raw.length,item.result.bytes,label);assert.equal(createHash('sha256').update(raw).digest('hex'),item.result.sha256,label)}
      else assert.equal(s.column(0),BigInt(item.result.value),label);
      assert.equal(await s.step(),'done');s.reset();
     }
    }
    s.bind(1,'null');assert.equal(await s.step(),'row');assert.equal(await s.step(),'done');s.reset();
   }finally{s.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});}
