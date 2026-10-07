// Development-only red latency probe. No scheduler replacement; real Chromium,
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
  const sql='WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<10000) SELECT sum(x), count(*) FROM q';
  const db=await open(new Request(url));const runs=[];
  const nativeTimer=globalThis.setTimeout;
  for(let run=0;run<3;run++){
   globalThis.__probe={work:0,perPC:{},program:null};const delays=[];
   globalThis.setTimeout=(fn,ms,...args)=>{const start=performance.now();return nativeTimer(()=>{delays.push(performance.now()-start);fn(...args)},ms)};
   let ticks=0;const pulse=setInterval(()=>ticks++,5);
   const {statement:s}=db.prepare(sql);const start=performance.now();const first=await s.step();
   const rows=[{type:s.columnType(0),integer:String(s.columnInteger(0))},{type:s.columnType(1),integer:String(s.columnInteger(1))}];
   const end=await s.step();const elapsed=performance.now()-start;
   clearInterval(pulse);globalThis.setTimeout=nativeTimer;s.finalize();
   const sorted=delays.slice().sort((a,b)=>a-b),quantile=p=>sorted[Math.floor((sorted.length-1)*p)];
   runs.push({first,end,rows,elapsedMs:elapsed,timerYields:delays.length,awaitedTimerMs:delays.reduce((a,b)=>a+b,0),delays:{min:sorted[0],p50:quantile(.5),p95:quantile(.95),max:sorted.at(-1)},ticks,...globalThis.__probe});
  }
  db.close();return {sql,runs};
 },{url:`http://127.0.0.1:${server.address().port}/fixture/${bridge.token}/empty`});
 report.browser=browser.version();report.originalVdbeSha256=sha(original);report.observedVdbeSha256=sha(observed);
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,(_key,value)=>typeof value==='bigint'?{$bigint:String(value)}:value,2));
 for(const r of report.runs){assert.equal(r.first,'row');assert.equal(r.end,'done');assert.deepEqual(r.rows,[{type:'integer',integer:'50005000'},{type:'integer',integer:'10000'}]);assert.deepEqual(r.perPC,report.runs[0].perPC);assert.equal(r.work,report.runs[0].work);console.log(JSON.stringify({...r,program:undefined,perPC:undefined}));}
 // Gap criterion measures actual host suspension, not CPU/JIT subtraction.
 assert(report.runs.every(r=>r.timerYields>500&&r.awaitedTimerMs/r.elapsedMs>.5),'current timer suspension must dominate this substantial path');
 console.log('RED CONFIRMED: repeated timer suspension dominates; exact typed rows/work/per-PC stable. '+path.join(dir,'report.json'));
}finally{await browser?.close();await new Promise(r=>server.close(r));await new Promise(r=>bridge.server.close(r));}
