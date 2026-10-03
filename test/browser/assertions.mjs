// Browser-only assertions: no Node imports, native backend, or Fetch mocks.
import {open, JSQLiteError} from '/dist/index.js';
const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)};
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
function tag(v){if(v===null)return{type:'null'};if(typeof v==='bigint')return{type:'integer',value:String(v)};if(typeof v==='number'){const b=new ArrayBuffer(8);new DataView(b).setFloat64(0,v,false);return{type:'real',ieee754be:hex(new Uint8Array(b))}}if(typeof v==='string')return{type:'text',utf8Hex:hex(new TextEncoder().encode(v))};return{type:'blob',hex:hex(v)}}
function checkError(e,expected){if(!(e instanceof JSQLiteError))throw e;for(const [k,v]of Object.entries(expected))eq(e[k],v,`error ${k}`);return e}
async function rejects(fn,expected){try{await fn()}catch(e){return checkError(e,expected)}throw Error('expected rejection')}
function throws(fn,expected){try{fn()}catch(e){return checkError(e,expected)}throw Error('expected throw')}
async function rows(s,options){const out=[];while(await s.step(options)==='row')out.push(Array.from({length:s.columnCount},(_,i)=>{const t=tag(s.column(i));eq(s.columnType(i),t.type,'storage class');return t}));return out}
// Exhaust cleanup; the original assertion/execution failure always remains primary.
async function owned(c,fn){let db,s,primary;try{db=await open(c.url,c.openOptions);await fn(db,x=>s=x,()=>db=null)}catch(e){primary=e}finally{for(const clean of [()=>s?.finalize(),()=>db?.closeDeferred()])try{clean()}catch(e){if(!primary)primary=e;else(primary.secondary??=[]).push(String(e))}}if(primary)throw primary}
export async function run(c){
 if(c.kind==='capture')return owned(c,async(db,own)=>{const s=db.prepare(c.sql).statement;own(s);for(const [i,v]of (c.bindings??[]).entries())s.bind(i+1,typeof v==='number'&&Number.isInteger(v)?BigInt(v):v);
  if(c.columns)eq(Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);const e=c.columns[i];const r={name:m.name};for(const k of Object.keys(e))if(k!=='name')r[k]=m[k==='declType'?'declaredType':k];return r}),c.columns,'ordered metadata');
  if(c.error){const e=await rejects(()=>rows(s),c.error);eq(throws(()=>s.reset(),c.error),e,'saved reset error');s.reset();}else{eq(await rows(s),c.rows,'ordered typed rows');s.reset();eq(await rows(s),c.rows,'reset rows')}s.finalize();own(null);});
 if(c.kind==='prepare-error')return owned(c,async(db)=>{throws(()=>db.prepare(c.sql),c.error);const p=db.prepare('SELECT 1').statement;try{eq(await rows(p),[[{type:'integer',value:'1'}]],'prepare failure leaves connection usable')}finally{p.finalize()}});
 if(c.kind==='open-error'){await rejects(()=>open(c.url,c.openOptions),c.error);return}
 if(c.kind==='lifecycle')return owned(c,async(db,own,release)=>{const s=db.prepare('SELECT ?1 AS v, ?2 AS v, ?3 AS n, ?4 AS b, ?5 AS t').statement;own(s);eq(Array.from({length:5},(_,i)=>s.columnMetadata(i).name),['v','v','n','b','t'],'duplicate metadata');const b=new Uint8Array([0,255]);s.bind(1,9223372036854775807n);s.bind(2,1.5);s.bind(3,null);s.bind(4,b);s.bind(5,'A\0😀é');b[0]=9;
  const expected=[[{type:'integer',value:'9223372036854775807'},{type:'real',ieee754be:'3ff8000000000000'},{type:'null'},{type:'blob',hex:'00ff'},{type:'text',utf8Hex:'4100f09f9880c3a9'}]];
  eq(await rows(s),expected,'bind copies');s.reset();s.reset();eq(await rows(s),expected,'retained bindings');s.reset();s.clearBindings();eq(await rows(s),[[{type:'null'},{type:'null'},{type:'null'},{type:'null'},{type:'null'}]],'clear');throws(()=>db.close(),{kind:'sqlite',code:5});s.reset();db.closeDeferred();throws(()=>db.prepare('SELECT 1'),{kind:'misuse'});eq(await rows(s),[[{type:'null'},{type:'null'},{type:'null'},{type:'null'},{type:'null'}]],'zombie statement');s.finalize();own(null);throws(()=>s.finalize(),{kind:'misuse'});throws(()=>db.prepare('SELECT 1'),{kind:'misuse'}); release();
 });
 if(c.kind==='control')return owned(c,async(db,own)=>{const s=db.prepare(c.sql).statement;own(s);const controller=new AbortController();let delivered=false;let timer;
  try{const options={...c.stepOptions};if(c.abort){options.signal=controller.signal;timer=setTimeout(()=>{delivered=true;controller.abort()},0)}const pending=rows(s,options);if(c.abort)throws(()=>db.prepare('SELECT 1'),{kind:'misuse'});const e=await rejects(()=>pending,c.error);if(c.abort)eq(delivered,true,'host abort delivered');const saved=throws(()=>s.reset(),c.error);if(saved!==e)throw Error('reset replaced primary error');s.reset();const probe=db.prepare('SELECT 1');eq(await rows(probe.statement),[[{type:'integer',value:'1'}]],'connection reusable');probe.statement.finalize();s.finalize();own(null)}finally{clearTimeout(timer)}});
 throw Error(`unknown kind ${c.kind}`);
}
