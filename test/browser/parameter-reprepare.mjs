// Development-only browser integration; no native/canonical conformance credit.
// prepare.c sqlite3Reprepare: reconstruct before swap/transfer/reset. Exercise
// the actual saved-SQL public handle through Fetch, not a replacement mock.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {browserLedger} from './parameter-reprepare-ledger.mjs';
import {pathToFileURL} from 'node:url';
const root=process.env.SAIVAGE_CARD_WORK_ROOT;
assert(root,'SAIVAGE_CARD_WORK_ROOT required for reports');
const dist=process.env.JSQLITE_REPREPARE_DIST??path.resolve('dist');
const reportDir=path.join(root,'browser-reprepare');fs.mkdirSync(reportDir,{recursive:true});
fs.rmSync(path.join(reportDir,'report.json'),{force:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.end('<!doctype html><title>parameter reprepare</title>');return}
 let filename;
 if(url.pathname.startsWith('/dist/')){
  const relative=url.pathname.slice(6);
  if(relative.includes('..')){res.writeHead(400).end();return}
  filename=path.join(dist,relative);res.setHeader('Content-Type','text/javascript');
 }else if(/^\/fixture\/(UTF-8|UTF-16le|UTF-16be)$/.test(url.pathname)){
  filename=path.resolve('docs/research/card-s-h',url.pathname.slice(9)+'.db');
 }else{res.writeHead(404).end();return}
 try{const bytes=fs.readFileSync(filename);res.setHeader('Content-Length',bytes.length);res.end(bytes)}catch{res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 const pw=await import(pathToFileURL(process.env.JSQLITE_PLAYWRIGHT??'/opt/saivage-jsqlite2/node_modules/playwright/index.mjs'));
 browser=await pw.chromium.launch({headless:true,...(process.env.JSQLITE_CHROMIUM?{executablePath:process.env.JSQLITE_CHROMIUM}:{})});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
 const report=await page.evaluate(async()=>{
  const {open}=await import('/dist/index.js');
  const check=(ok,message)=>{if(!ok)throw Error(message)};
  const equal=(a,b,message)=>check(JSON.stringify(a)===JSON.stringify(b),message);
  const misuse=fn=>{try{fn()}catch(e){check(e.kind==='misuse','expected misuse');return}throw Error('expected rejection')};
  const results=[];let active=-1;
  try{
  for(const [index,encoding] of ['UTF-8','UTF-16le','UTF-16be'].entries()){
   active=index;
   const db=await open(new Request(location.origin+'/fixture/'+encoding));let s;
   try{
    const sql='SELECT id,id,r,b FROM t WHERE a=:value ORDER BY id; SELECT 7';
    const prepared=db.prepare(sql);s=prepared.statement;
    const tail=prepared.tail,offset=prepared.tailOffset;
    equal(tail,' SELECT 7','exact tail');check(offset===new TextEncoder().encode(sql.slice(0,sql.indexOf(';')+1)).length,'exact tail byte offset');
    check(s.parameterCount===1&&s.parameterIndex(':value')===1,'parameter discovery');
    const metadata=[s.columnMetadata(0),s.columnMetadata(1)];
    equal(metadata,[0,1].map(()=>({name:'id',declaredType:'INTEGER',database:'main',table:'t',origin:'id'})),'exact declared/origin metadata');
    const another=s.columnMetadata(0);
    check(another!==metadata[0]&&Object.isFrozen(another),'fresh immutable metadata record');
    const expr=db.prepare('SELECT :scalar').statement;
    try{equal(expr.columnMetadata(0),{name:':scalar',declaredType:null,database:null,table:null,origin:null},'unavailable expression metadata is NULL')}finally{expr.finalize()}
    const runs=[];
    for(const value of [0n,99n,0n,98n]){
     s.bind(':value',value);check(await s.step()==='row','partial row');
     const first=s.columnInteger(0);check(first===s.columnInteger(1),'partial duplicate');
     s.reset();misuse(()=>s.columnType(0));s.bind(':value',value);
     let count=0,last=null;
     while(await s.step()==='row'){
      check(s.columnType(0)==='integer'&&s.columnType(1)==='integer','integer classes');
      const id=s.columnInteger(0);check(id===s.columnInteger(1),'duplicate projection');
      if(last!==null)check(last<id,'strict ordering');else check(id===first,'restart at first');
      last=id;count++;
     }
     check(count===(value===0n?900:1),'cardinality');
     equal([s.columnMetadata(0),s.columnMetadata(1)],metadata,'stable metadata');
     check(await s.step()==='done','repeat DONE');misuse(()=>s.columnType(0));s.reset();
     runs.push({binding:String(value),count,first:String(first)});
    }
    db.closeDeferred();
    misuse(()=>db.prepare('SELECT 7'));
    s.clearBindings();check(await s.step()==='done','cleared NULL matches no rows');s.reset();
    s.bind(':value',99n);check(await s.step()==='row','recompile on deferred-close handle');
    check(await s.step()==='done','rare done');s.finalize();const dead=s;s=null;
    misuse(()=>dead.bind(':value',0n));misuse(()=>dead.finalize());
    results.push({encoding,tail,offset,metadata,runs,deferredClose:true});
   }finally{if(s){s.finalize();db.closeDeferred()}}
  }
  return {results};
  }catch(error){return {results,failure:{index:active,error:String(error)}}}
 });
 const ledger=browserLedger(['UTF-8','UTF-16le','UTF-16be'],report.results,report.failure);
 fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify({browser:browser.version(),...ledger},null,2)+'\n');
 console.log(JSON.stringify({browser:browser.version(),...ledger}));
 assert.equal(ledger.passed,3,'all browser encoding assertions must pass');
}catch(error){
 const file=path.join(reportDir,'report.json');
 if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(browserLedger(['UTF-8','UTF-16le','UTF-16be'],[],{error:String(error)}),null,2)+'\n');
 throw error;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
