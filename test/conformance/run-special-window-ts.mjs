import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {open} from '../../src/index.ts';

const contract=JSON.parse(fs.readFileSync(new URL('./cases/stage3-special-window.json',import.meta.url)));
const allocation=JSON.parse(fs.readFileSync(new URL('./cases/stage3-special-window.spec.json',import.meta.url)));
const controls=new Map(allocation.cases.map(c=>[c.id,c]));
const root=path.resolve('test/fixtures/special-window');
const fixtureManifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const selected=process.env.JSQLITE_SPECIAL_WINDOW_CASE?contract.cases.filter(c=>c.id===process.env.JSQLITE_SPECIAL_WINDOW_CASE):contract.cases;
const executable=selected.filter(c=>c.kind!=='source-only');

function tag(v){if(v===null)return{type:'null'};if(typeof v==='bigint')return{type:'integer',value:String(v)};if(typeof v==='number'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return{type:'real',ieee754be:b.toString('hex')}}if(typeof v==='string')return{type:'text',utf8Hex:Buffer.from(v).toString('hex')};return{type:'blob',hex:Buffer.from(v).toString('hex')}}
function fixture(c){const suffix=c.encoding==='UTF-16le'?'-utf-16le':c.encoding==='UTF-16be'?'-utf-16be':'';return `${c.setup}${suffix}.db`}
function verifyFixture(name){const expected=fixtureManifest.fixtures[name];assert.ok(expected,`fixture identity missing: ${name}`);const bytes=fs.readFileSync(path.join(root,name));assert.equal(bytes.length,expected.bytes,`${name} byte length`);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected.sha256,`${name} database hash`);const code=bytes.readUInt32BE(56),encoding=code===1?'UTF-8':code===2?'UTF-16le':code===3?'UTF-16be':null;assert.equal(encoding,expected.encoding,`${name} physical encoding`)}
for(const name of new Set(executable.map(fixture)))verifyFixture(name);

const token=crypto.randomBytes(18).toString('hex');
const bridge=http.createServer((req,res)=>{const name=req.url===`/${token}`?decodeURIComponent(req.headers['x-fixture']||''):'';if(!/^[a-z0-9-]+\.db$/.test(name)){res.writeHead(404);return res.end()}const file=path.join(root,name);if(!fs.existsSync(file)){res.writeHead(404);return res.end()}const stat=fs.statSync(file);res.writeHead(200,{'Content-Length':stat.size,'Content-Type':'application/vnd.sqlite3'});fs.createReadStream(file).pipe(res)});
await new Promise((resolve,reject)=>bridge.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
after(()=>new Promise((resolve,reject)=>bridge.close(error=>error?reject(error):resolve())));
const request=name=>new Request(`http://127.0.0.1:${bridge.address().port}/${token}`,{headers:{'x-fixture':name}});
const columns=statement=>Array.from({length:statement.columnCount},(_,i)=>{const m=statement.columnMetadata(i);return{name:m.name,declType:m.declaredType}});
const equivalentName=(a,b)=>a.replace(/\s+/g,'')===b.replace(/\s+/g,'');

async function collect(statement,run,options){const rows=[];if(run.terminalCode===101){while(await statement.step(options)==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>tag(statement.column(i))));assert.deepEqual(rows,run.rows,JSON.stringify(rows));return}await assert.rejects(async()=>{while(await statement.step(options)==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>tag(statement.column(i))))},error=>options?.maxWorkUnits!==undefined?error?.kind==='limit'&&error?.message==='statement exceeds maxWorkUnits':error?.kind==='sqlite'&&error?.code===run.terminalCode&&error?.message===run.errorMessage);assert.deepEqual(rows,run.rows)}
function bindRun(statement,c,index){if(c.id==='ntile-parameter-reset')statement.bind(1,index===0?2n:3n)}

for(const c of executable)test(`special-window ${c.id}`,async()=>{let db,statement;try{db=await open(request(fixture(c)));if(c.native.prepareCode!==0){assert.throws(()=>db.prepare(c.sql),error=>error?.kind==='sqlite'&&error?.code===c.native.prepareCode&&error?.message===c.native.errorMessage);return}statement=db.prepare(c.sql).statement;const actual=columns(statement);assert.equal(actual.length,c.native.columns.length,'metadata count');actual.forEach((m,i)=>{assert.ok(equivalentName(m.name,c.native.columns[i].name),`metadata name ${i}: ${m.name}`);assert.equal(m.declType,c.native.columns[i].declType,`metadata type ${i}`)});const progressAbortAfter=controls.get(c.id)?.progressAbortAfter;for(let i=0;i<c.native.runs.length;i++){if(i)statement.reset();bindRun(statement,c,i);await collect(statement,c.native.runs[i],progressAbortAfter?{maxWorkUnits:progressAbortAfter}:undefined)}}finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}}});

test('special-window denominator',()=>{if(process.env.JSQLITE_SPECIAL_WINDOW_CASE)return;assert.deepEqual({declared:selected.length,executable:executable.length,sourceOnly:selected.length-executable.length},{declared:43,executable:41,sourceOnly:2})});
