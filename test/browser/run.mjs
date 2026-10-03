// Development-only bounded real-browser runner. Never serves SQL/native requests.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {startFixtureServer} from '../conformance/fixture-server.mjs';
const root=process.cwd();
if(!process.env.SAIVAGE_CARD_WORK_ROOT)throw Error('SAIVAGE_CARD_WORK_ROOT required');
const work=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'browser-e2e');fs.mkdirSync(work,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p));
const cases=[],evidence=[];
const current=json('test/fixtures/CURRENT.json');
const generation=`test/fixtures/generations/${current.generationId}`;
const catalog=json(`${generation}/catalog.json`);
const bridge=await startFixtureServer(path.resolve('test/fixtures'));
const files=new Map();
function register(p,expected){const b=fs.readFileSync(p);if(expected?.sha256&&hash(b)!==expected.sha256)throw Error(`fixture digest ${p}`);if(expected?.bytes&&b.length!==expected.bytes)throw Error(`fixture length ${p}`);const id=files.size;files.set(`/db/${id}`,b);evidence.push({path:p,bytes:b.length,sha256:hash(b),encoding:b.readUInt32BE(56)});return `/db/${id}`}
function fixture(id,expected){const f=catalog.semantic.fixtures.find(f=>f.id===id);if(!f)throw Error(`unknown fixture ${id}`);register(`${generation}/${f.path}`,{sha256:expected??f.sha256,bytes:f.bytes});return `/fixture/${bridge.token}/${id}`}
function capture(name){const p=`test/conformance/cases/${name}.json`;const b=fs.readFileSync(p);evidence.push({path:p,sha256:hash(b)});return JSON.parse(b)}
function addNative(name,ids,resolve){const d=capture(name);for(const id of ids){const c=d.cases.find(c=>c.id===id);if(!c)throw Error(id);const native=c.native;cases.push({id:`${name}/${id}`,kind:'capture',url:resolve(c),sql:c.sql,columns:native.columns,rows:native.first?.rows??native.runs?.[0]?.rows,provenance:{capture:name,id,source:d.source,assertion:c.provenance??{file:c.sourceFile,case:c.sourceCase}},...(native.runs?.[0].terminalCode!==undefined&&native.runs[0].terminalCode!==101?{error:{kind:'sqlite',code:native.runs[0].terminalCode,message:native.runs[0].errorMessage}}:{})})}}
addNative('stage3-aggregate-group',['empty-count','numeric-types','encoding-utf8','encoding-utf16le','encoding-utf16be'],c=>fixture(c.fixture,c.fixtureSha256));
addNative('stage3-subquery-view',['derived-basic'],c=>fixture(c.fixture,c.fixtureSha256));
addNative('stage3-multisource-select',['comma-order','duplicate-names'],()=>register('test/conformance/fixtures/multisource-inner-oracle.db'));
const wm=json('test/fixtures/special-window/manifest.json');
addNative('stage3-special-window',['window1-7.3','window1-5.1'],c=>register(`test/fixtures/special-window/${c.setup}.db`,wm.fixtures[`${c.setup}.db`]));
const prepareCapture=capture('stage3-special-window');const pc=prepareCapture.cases.find(c=>c.id==='window1-7.1.1');cases.push({id:'prepare/window1-7.1.1',kind:'prepare-error',url:register(`test/fixtures/special-window/${pc.setup}.db`,wm.fixtures[`${pc.setup}.db`]),sql:pc.sql,error:{kind:'sqlite',code:pc.native.prepareCode,message:pc.native.errorMessage},provenance:{capture:'stage3-special-window',source:prepareCapture.source,file:pc.sourceFile,case:pc.sourceCase,bodySha256:pc.sourceBodySha256}});
const index=capture('stage3-advanced-index');for(const v of index.variants){const c=v.cases.find(c=>c.id==='wr-primary-exact');cases.push({id:`index/${v.id}/${c.id}`,kind:'capture',url:register(v.fixture.path,v.fixture),sql:c.sql,bindings:c.bindings,rows:c.rows,provenance:{capture:'stage3-advanced-index',id:c.id,source:index.source}})}
const empty=fixture('empty');
// Valid header/schema; only t1 root btree flags are corrupted, discovered on step.
const corruptSource=catalog.semantic.fixtures.find(f=>f.id==='subquery-utf8');const corruptPath=`${generation}/${corruptSource.path}`;const corrupt=Buffer.from(fs.readFileSync(corruptPath));if(hash(corrupt)!==corruptSource.sha256)throw Error('corrupt fixture source digest');const pageSize=corrupt.readUInt16BE(16)===1?65536:corrupt.readUInt16BE(16);corrupt[pageSize]=0;files.set('/corrupt-root',corrupt);evidence.push({path:corruptPath,sourceSha256:corruptSource.sha256,mutation:{offset:pageSize,value:0},sha256:hash(corrupt),provenance:'btree.c btreeInitPage invalid page flags; t1 rootpage 2'});cases.push({id:'corrupt/t1-root-flags',kind:'corrupt-step',url:'/corrupt-root',sql:'SELECT a FROM t1',error:{kind:'sqlite',code:11},provenance:'pinned btree.c btreeInitPage; SQLITE_CORRUPT on invalid page flags, header/schema remain intact'});
const budgets=captureBudget();
function captureBudget(){const p='test/browser/budget-native.json';evidence.push({path:p,sha256:hash(fs.readFileSync(p))});return json(p)}
for(const c of budgets.cases)cases.push({...c,id:`budget/${c.id}`,kind:'capture',url:fixture('subquery-utf8'),openOptions:{limits:{maxPrivateBytes:c.id==='budget-composed'?300:150}}});
const j=json('test/browser/json-native.json');evidence.push({path:'test/browser/json-native.json',sha256:hash(fs.readFileSync('test/browser/json-native.json'))});for(const c of j.cases)cases.push({...c,id:`json/${c.id}`,kind:'capture',url:empty});
if(process.env.JSQLITE_CHINOOK){const d=capture('audit-chinook-b1-b5');const c=d.executions.find(c=>c.fixture==='chinook'&&c.id==='b1-between');cases.push({id:'chinook/b1-between',kind:'capture',url:register(process.env.JSQLITE_CHINOOK,json('test/fixtures/public/chinook.json')),sql:c.sql,columns:c.native.columns.map(name=>({name})),rows:c.native.rows,provenance:{capture:'audit-chinook-b1-b5',sourceId:d.sourceId,id:c.id}})}
for(const encoding of ['utf8','utf16le','utf16be'])cases.push({id:`lifecycle/${encoding}`,kind:'lifecycle',url:fixture(`encoding-${encoding}`),provenance:'api.md lifecycle; main.c close; vdbeapi.c reset/finalize/clear; browser adaptation assertions, not SQL compatibility credit'});
cases.push({id:'cte/with1-3.4',kind:'capture',url:empty,sql:'WITH q(x) AS (VALUES(1)), q2 AS (WITH q(x) AS (VALUES(2)) SELECT x FROM q) SELECT x FROM q2',rows:[[{type:'integer',value:'2'}]],columns:[{name:'x',declaredType:null,database:null,table:null,origin:null}],provenance:'test/with1.test 3.4; existing cte-execution.test.mjs independently pinned lexical discriminator'});
const loop='WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<100000) SELECT sum(x) FROM q';
for(const [id,sql,openOptions,stepOptions,error,abort]of [
 ['work',loop,{}, {maxWorkUnits:100},{kind:'limit'},false],
 ['deadline',loop,{}, {timeoutMs:0},{kind:'timeout'},false],
 ['abort-yield',loop,{}, {},{kind:'cancelled'},true],
 ['rows','VALUES(1),(2)',{limits:{maxRows:1}}, {},{kind:'limit'},false],
 ['result',"SELECT printf('%100s','x')",{limits:{maxResultBytes:32}}, {},{kind:'limit'},false],
 ['private','SELECT a FROM t1 ORDER BY b',{limits:{maxPrivateEntries:1}}, {},{kind:'limit'},false],
 ['private-key','SELECT a FROM t1 ORDER BY b',{limits:{maxPrivateKeyBytes:1}}, {},{kind:'limit'},false],
 ['private-bytes','SELECT a FROM t1 ORDER BY b',{limits:{maxPrivateBytes:1}}, {},{kind:'limit'},false],
 ['private-shared', 'SELECT a FROM (SELECT a,b FROM t1 ORDER BY b LIMIT 4) ORDER BY b DESC',{limits:{maxPrivateBytes:150}}, {},{kind:'limit'},false],
])cases.push({id:`control/${id}`,kind:'control',url:id.startsWith('private')?fixture('subquery-utf8'):empty,sql,openOptions,stepOptions,error,abort,provenance:'api.md bounded-work/lifecycle browser controls; not native work-count parity'});
cases.push({id:'open/stream-truncated',kind:'open-error',url:'/truncated',error:{kind:'transport'}},{id:'open/file-limit',kind:'open-error',url:empty,openOptions:{limits:{maxFileBytes:1}},error:{kind:'limit'}},{id:'open/http',kind:'open-error',url:'/missing',error:{kind:'transport'}},{id:'open/malformed',kind:'open-error',url:'/malformed',error:{kind:'sqlite'}});
const dist=fs.readdirSync('dist',{recursive:true}).filter(p=>p.endsWith('.js')).sort().map(p=>({path:`dist/${p}`,sha256:hash(fs.readFileSync(`dist/${p}`))}));
// Exact allowlist static server + existing immutable fixture server proxy, same origin.
const staticFiles=new Map([['/assertions.mjs',fs.readFileSync('test/browser/assertions.mjs')],...dist.map(f=>[`/${f.path}`,fs.readFileSync(f.path)])]);
const requests=[];
const server=http.createServer((req,res)=>{requests.push({url:req.url,method:req.method});if(req.method!=='GET'){res.writeHead(405).end();return}
 if(req.url.startsWith(`/fixture/${bridge.token}/`)){http.get({host:'127.0.0.1',port:bridge.port,path:req.url},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)}).on('error',()=>res.destroy());return}
 const b=staticFiles.get(req.url)??files.get(req.url);if(b){res.writeHead(200,{'Content-Type':staticFiles.has(req.url)?'text/javascript':'application/vnd.sqlite3','Content-Length':b.length,'Cache-Control':'no-store'});res.end(b);return}
 if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'"});res.end('<!doctype html><title>jsqlite real browser test</title>');return}
 if(req.url==='/truncated'){res.writeHead(200,{'Content-Length':10000});res.write('SQLite format 3\0');setTimeout(()=>res.destroy(),20);return}
 if(req.url==='/malformed'){res.writeHead(200);res.end('not sqlite');return}res.writeHead(404).end();});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;const report={schema:'jsqlite-browser-e2e/1',command:process.argv,selection:{filter:process.env.JSQLITE_BROWSER_CASE??null,chinook:!!process.env.JSQLITE_CHINOOK},sourceId:json('reference/sqlite/manifest.json').sqliteSourceId,current,dist,evidence,declared:cases.length,results:[]};
function save(){fs.writeFileSync(path.join(work,'report.json'),JSON.stringify({...report,requests},null,2)+'\n')}
try{
 const tooling=process.env.JSQLITE_PLAYWRIGHT?pathToFileURL(path.resolve(process.env.JSQLITE_PLAYWRIGHT)).href:import.meta.url;
 const playwrightVersion=createRequire(tooling)('playwright/package.json').version;
 const pw=await import(process.env.JSQLITE_PLAYWRIGHT?tooling:'playwright');
 browser=await pw.chromium.launch({headless:true});report.browser={name:'chromium',version:browser.version(),playwright:playwrightVersion};
 for(const c of cases){if(process.env.JSQLITE_BROWSER_CASE&&!c.id.includes(process.env.JSQLITE_BROWSER_CASE))continue;const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();let watchdog;const start=Date.now();const errors=[];page.on('pageerror',e=>errors.push(String(e)));await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  try{await page.goto(origin,{timeout:5000});const result=page.evaluate(async c=>{const {run}=await import('/assertions.mjs');try{await run(c);return{ok:true}}catch(e){return{ok:false,error:{name:e.name,message:e.message,stack:e.stack,kind:e.kind,code:e.code,secondary:e.secondary}}}},{...c,url:origin+c.url});
   const r=await Promise.race([result,new Promise((_,reject)=>watchdog=setTimeout(()=>reject(Error('case watchdog 15000ms')),15000))]);report.results.push({id:c.id,provenance:c.provenance,status:r.ok?'pass':'fail',error:r.error,pageErrors:errors,elapsedMs:Date.now()-start});
  }catch(e){report.results.push({id:c.id,status:e.message.includes('watchdog')?'timeout':'fail',error:String(e),elapsedMs:Date.now()-start})}finally{clearTimeout(watchdog);await context.close();save()}
 }
 console.log(JSON.stringify({browser:report.browser,declared:report.declared,executed:report.results.length,results:report.results.map(({id,status,error})=>({id,status,error})),report:path.join(work,'report.json')},null,2));if(report.results.some(r=>r.status!=='pass'))process.exitCode=1;
}finally{await browser?.close();await new Promise(r=>server.close(r));await new Promise(r=>bridge.server.close(r));save()}
