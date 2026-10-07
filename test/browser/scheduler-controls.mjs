// Development-only scheduler control probes in real Chromium,
// public Fetch/open/prepare/step and typed accessors. Served VM instrumentation
// only counts dispatch/work and snapshots the lowered program (no replay).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {startFixtureServer} from '../conformance/fixture-server.mjs';
const root=process.env.SAIVAGE_CARD_WORK_ROOT;
assert(root,'SAIVAGE_CARD_WORK_ROOT required');
const dir=path.join(root,'scheduler-red');fs.mkdirSync(dir,{recursive:true});
const dist=process.env.JSQLITE_SCHEDULER_DIST??path.resolve('dist');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bridge=await startFixtureServer(path.resolve('test/fixtures'));
const original=fs.readFileSync(path.join(dist,'internal/vdbe.js'),'utf8');
assert(original.includes('const op = this.#program.ops[this.#pc++]'));
const observed=original.replaceAll('this.#work++','(globalThis.__probe.work++, this.#work++)').replace('const op = this.#program.ops[this.#pc++]','globalThis.__probe.program = this.#program.ops; globalThis.__probe.perPC[this.#pc] = (globalThis.__probe.perPC[this.#pc]??0)+1; const op = this.#program.ops[this.#pc++]');
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.end('<!doctype html><title>scheduler red</title>');return;}
 if(req.url.startsWith('/dist/')){const p=req.url.slice(6);if(p.includes('..')){res.writeHead(400).end();return;}try{const b=p==='internal/vdbe.js'?observed:fs.readFileSync(path.join(dist,p));res.setHeader('Content-Type','text/javascript');res.end(b);}catch{res.writeHead(404).end();}return;}
 if(req.url.startsWith('/fixture/')){http.get({host:'127.0.0.1',port:bridge.port,path:req.url},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});return;}
 res.writeHead(404).end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 const pw=await import(pathToFileURL(process.env.JSQLITE_PLAYWRIGHT??'/opt/saivage-jsqlite2/node_modules/playwright/index.mjs'));
 browser=await pw.chromium.launch({headless:true});const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const report=await page.evaluate(async({url})=>{
  const {open}=await import('/dist/index.js');
  const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]))};
  const error=async(fn,kind)=>{try{await fn()}catch(e){eq(e.kind,kind);return e}throw Error('missing '+kind)};
  const results=[];
  const loop='WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<10000) SELECT sum(x),count(*) FROM q';
  for(const encoding of ['utf8','utf16le','utf16be']){
   const db=await open(new Request(url+'encoding-'+encoding));
   for(const [family,sql,binding] of [
    ['main',loop,null],
    ['private',"SELECT ?1 UNION SELECT ?1",'x'.repeat(200000)],
    ['scalar','SELECT hex(?1)',new Uint8Array(200000)],
    ['function','SELECT json_pretty(?1)','['+Array(10000).fill('1').join(',')+']']
   ]){
    const {statement:s}=db.prepare(sql);if(binding!==null)s.bind(1,binding);
    globalThis.__probe={work:0,perPC:{},program:null};
    const c=new AbortController();const reason={family};const t=setTimeout(()=>c.abort(reason),0);
    const pending=s.step({signal:c.signal});
    await error(()=>Promise.resolve().then(()=>s.reset()),'misuse');
    await error(()=>Promise.resolve().then(()=>s.finalize()),'misuse');
    await error(()=>Promise.resolve().then(()=>db.prepare('SELECT 1')),'misuse');
    const e=await error(()=>pending,'cancelled');eq(e.cause,reason);clearTimeout(t);
    const again=await error(()=>s.step(),'cancelled');if(e!==again)throw Error('error identity');
    await error(()=>Promise.resolve().then(()=>s.reset()),'cancelled');
    await error(()=>s.step({maxWorkUnits:10}),'limit');await error(()=>Promise.resolve().then(()=>s.reset()),'limit');
    await error(()=>s.step({timeoutMs:1}),'timeout');await error(()=>Promise.resolve().then(()=>s.reset()),'timeout');
    globalThis.__probe={work:0,perPC:{},program:null};eq(await s.step(),'row');
    const type=s.columnType(0);if(family==='main'){eq(type,'integer');eq(String(s.columnInteger(0)),'50005000');eq(String(s.columnInteger(1)),'10000');}
    if(family==='private'){eq(type,'text');eq(s.columnText(0).length,200000);}
    if(family==='scalar'){eq(type,'text');eq(s.columnText(0).length,400000);}
    if(family==='function'){eq(type,'text');eq(JSON.parse(s.columnText(0)).length,10000);}
    const work=globalThis.__probe.work;const perPC={...globalThis.__probe.perPC};s.reset();if(family==='main'){globalThis.__probe={work:0,perPC:{},program:null};eq(await s.step(),'row');eq(globalThis.__probe.work,work);eq(globalThis.__probe.perPC,perPC);}s.finalize();results.push({encoding,family,type});
   }
   const typed=db.prepare("SELECT 1.0,NULL,x'00ff',1").statement;eq(await typed.step(),'row');eq([0,1,2,3].map(i=>typed.columnType(i)),['real','null','blob','integer']);eq(typed.columnReal(0),1);eq([...typed.columnBlob(2)],[0,255]);typed.finalize();db.close();
  }
  const NativeChannel=globalThis.MessageChannel;let live=0,maxLive=0;
  globalThis.MessageChannel=class extends NativeChannel{constructor(){super();live+=2;maxLive=Math.max(maxLive,live);for(const p of [this.port1,this.port2]){const close=p.close.bind(p);p.close=()=>{live--;close()}}}};
  for(const fallback of [false,true]){
   if(fallback)globalThis.MessageChannel=undefined;
   const db=await open(new Request(url+'empty'));const s=db.prepare(loop).statement;globalThis.__probe={work:0,perPC:{},program:null};
   let ticks=0;const interval=setInterval(()=>ticks++,5);eq(await s.step(),'row');clearInterval(interval);if(ticks===0)throw Error('fairness');eq(live,0);s.finalize();db.close();results.push({family:fallback?'fallback':'resource',ticks,live,maxLive});
  }
  globalThis.MessageChannel=NativeChannel;
  const db=await open(new Request(url+'storage-p4096'));const s=db.prepare('SELECT t FROM storage_values WHERE i=0').statement;
  globalThis.__probe={work:0,perPC:{},program:null};const c=new AbortController();setTimeout(()=>c.abort('overflow'),0);
  await error(()=>s.step({signal:c.signal}),'cancelled');await error(()=>Promise.resolve().then(()=>s.reset()),'cancelled');
  await error(()=>s.step({maxWorkUnits:11}),'limit');await error(()=>Promise.resolve().then(()=>s.reset()),'limit');eq(await s.step(),'row');eq(s.columnType(0),'text');if(s.columnText(0).length<=4096)throw Error('overflow');s.finalize();db.close();results.push({family:'overflow'});
  return results;
 },{url:`http://127.0.0.1:${server.address().port}/fixture/${bridge.token}/`});
 console.log(JSON.stringify({browser:browser.version(),results:report}));
 fs.writeFileSync(path.join(root,'scheduler-green','controls.json'),JSON.stringify({browser:browser.version(),results:report},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));await new Promise(r=>bridge.server.close(r));}
