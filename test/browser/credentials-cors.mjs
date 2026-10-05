// Development-only real Chromium cross-origin credentials/CORS assertions.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {closeTestServer} from '../conformance/close-test-server.mjs';
const bytes=fs.readFileSync('examples/browser/chinook.sqlite');
assert.equal(createHash('sha256').update(bytes).digest('hex'),'7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15');
const requests=[];let origin;
const dbServer=http.createServer((q,r)=>{
 requests.push({method:q.method,url:q.url,cookie:q.headers.cookie??null,header:q.headers['x-review']??null,origin:q.headers.origin??null});
 if(q.url==='/seed'){r.writeHead(200,{'Set-Cookie':'review=secret; Path=/; SameSite=Lax'});r.end('seed');return;}
 if(q.url!=='/denied'){
  r.setHeader('Access-Control-Allow-Origin',origin);r.setHeader('Access-Control-Allow-Credentials','true');
  r.setHeader('Access-Control-Allow-Headers','x-review');r.setHeader('Access-Control-Allow-Methods','GET');
 }
 if(q.method==='OPTIONS'){r.writeHead(204);r.end();return;}
 r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes);
});
const app=http.createServer((q,r)=>{
 if(q.url==='/'){r.setHeader('Content-Type','text/html');r.end('<!doctype html><title>credentials review</title>');return;}
 if(!q.url.startsWith('/dist/')||q.url.includes('..')){r.writeHead(404);r.end();return;}
 const p=path.resolve('.'+q.url);
 try{r.setHeader('Content-Type','text/javascript');r.end(fs.readFileSync(p));}catch{r.writeHead(404);r.end();}
});
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
let browser;
try{
 await listen(app);origin=`http://127.0.0.1:${app.address().port}`;await listen(dbServer);
 const remote=`http://127.0.0.1:${dbServer.address().port}`;
 if(!process.env.JSQLITE_PLAYWRIGHT)throw Error('JSQLITE_PLAYWRIGHT must identify retained development-only Playwright tooling');
 const pw=await import(pathToFileURL(process.env.JSQLITE_PLAYWRIGHT));
 browser=await pw.chromium.launch({headless:true});const page=await browser.newPage();
 // Same-site different-port origins: deliberately seed a cookie that would be
 // sent by credentials=include; CORS still applies between these two origins.
 await page.goto(remote+'/seed');await page.goto(origin);
 const result=await page.evaluate(async remote=>{
  const {open}=await import('/dist/index.js');
  async function query(route,options){const db=await open(new Request(remote+route),options);let st;try{st=db.prepare('SELECT count(*) AS n FROM Track').statement;const meta=st.columnMetadata(0);if(await st.step()!=='row')throw Error('missing row');const value=st.column(0);if(await st.step()!=='done')throw Error('missing done');return {value:String(value),type:typeof value,name:meta.name};}finally{try{st?.finalize();}finally{db.closeDeferred();}}}
  const omitted=await query('/omit');
  const included=await query('/include',{fetchOptions:{credentials:'include',headers:{'x-review':'explicit'}}});
  let error;try{await query('/denied');}catch(e){error={kind:e.kind};}
  const reused=await query('/reuse');return {omitted,included,error,reused};
 },remote);
 for(const key of ['omitted','included','reused'])assert.deepEqual(result[key],{value:'3503',type:'bigint',name:'n'});
 assert.deepEqual(result.error,{kind:'transport'});
 assert.equal(requests.find(q=>q.url==='/omit').cookie,null);
 assert.equal(requests.find(q=>q.url==='/reuse').cookie,null);
 assert.equal(requests.find(q=>q.method==='GET'&&q.url==='/include').cookie,'review=secret');
 assert.equal(requests.find(q=>q.method==='GET'&&q.url==='/include').header,'explicit');
 assert.ok(requests.some(q=>q.method==='OPTIONS'&&q.url==='/include'));
 console.log(JSON.stringify({result:'PASS',browser:browser.version(),requests,assertions:8},null,2));
}finally{try{await browser?.close();}finally{await closeTestServer(app);await closeTestServer(dbServer);}}
