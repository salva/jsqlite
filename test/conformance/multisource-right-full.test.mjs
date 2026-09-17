import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import { openFixture } from './public-api-adapter.mjs';

const capture=JSON.parse(fs.readFileSync(new URL('./cases/stage3-multisource-select.json',import.meta.url),'utf8'));
const files={utf8:'multisource-inner-oracle.db','empty-left':'multisource-empty-left.db','right-chain':'multisource-right-chain.db',utf16le:'multisource-inner-oracle-utf16le.db',utf16be:'multisource-inner-oracle-utf16be.db'};
function value(v){if(v.type==='null')return null;if(v.type==='integer')return BigInt(v.value);if(v.type==='real')return Buffer.from(v.ieee754be,'hex').readDoubleBE();if(v.type==='text')return Buffer.from(v.utf8Hex,'hex').toString();if(v.type==='blob')return new Uint8Array(Buffer.from(v.hex,'hex'));throw Error(`unknown ${v.type}`)}
async function rows(statement,options){const out=[];while(await statement.step(options)==='row')out.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return out}
async function withDb(setup,fn,openOptions){const body=fs.readFileSync(new URL(`./fixtures/${files[setup]}`,import.meta.url));const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':body.length});r.end(body)});await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),openOptions);await fn(db)}finally{try{db?.close()}catch{}await new Promise(resolve=>server.close(resolve))}}
function metadata(statement){return Array.from({length:statement.columnCount},(_,i)=>{const m=statement.columnMetadata(i);return{name:m.name,declType:m.declaredType,database:m.database,table:m.table,origin:m.origin}})}

const executable=['right-unmatched','full-unmatched','left-empty','right-barrier-three-source','right-table-each-side','right-using-coalesce-star','right-using-qualified-stars','right-natural-chain','right-where-unmatched','right-on-unmatched','full-both-unmatched-downstream','full-using-coalesced','full-chain-downstream-inner'];
test('pinned 3.53.4 RIGHT/FULL matrix including barriers and downstream joins',async()=>{
 for(const setup of Object.keys(files))await withDb(setup,async db=>{for(const c of capture.cases.filter(c=>c.setup===setup&&executable.includes(c.id))){const s=db.prepare(c.sql).statement;try{assert.deepEqual(metadata(s),c.native.columns,c.id+' metadata');assert.deepEqual(await rows(s),c.native.first.rows.map(row=>row.map(value)),c.id+' rows')}finally{s.finalize()}}});
});

test('RIGHT/FULL reset and failures clean match and unmatched-pass state',async()=>withDb('right-chain',async db=>{
 let s=db.prepare('SELECT a.k,c.k FROM a RIGHT JOIN c ON a.k=c.k AND c.k>?1 ORDER BY c.k').statement;
 try{s.bind(1,2n);assert.deepEqual(await rows(s),[[null,1n],[null,3n],[null,4n]]);s.reset();s.bind(1,0n);assert.deepEqual(await rows(s),[[1n,1n],[null,3n],[null,4n]])}finally{s.finalize()}
 for(const options of [{maxWorkUnits:0},{timeoutMs:0}]){s=db.prepare('SELECT a.k,c.k FROM a RIGHT JOIN c ON a.k=c.k ORDER BY c.k').statement;await assert.rejects(s.step(options),e=>e.kind==='limit'||e.kind==='timeout');assert.throws(()=>s.finalize())}
 const controller=new AbortController();controller.abort();s=db.prepare('SELECT a.k,c.k FROM a RIGHT JOIN c ON a.k=c.k').statement;await assert.rejects(s.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.throws(()=>s.finalize());
}));

test('RIGHT match tracking shares private-state budget',async()=>withDb('right-chain',async db=>{const s=db.prepare('SELECT a.k,c.k FROM a RIGHT JOIN c ON a.k=c.k').statement;await assert.rejects(s.step(),e=>e.kind==='limit');assert.throws(()=>s.finalize(),e=>e.kind==='limit')},{limits:{maxPrivateEntries:0}}));


test('RIGHT/FULL preserve encoding, diagnostics, and cancellation after match tracking',async()=>{
 const encodedMetadata=[
  {name:'id',declType:'INTEGER',database:'main',table:'β',origin:'id'},
  {name:'id',declType:'INTEGER',database:'main',table:'α',origin:'id'},
 ];
 for(const setup of ['utf16le','utf16be'])await withDb(setup,async db=>{const s=db.prepare('SELECT β.id,α.id FROM β RIGHT JOIN α ON 0 ORDER BY α.id').statement;try{assert.deepEqual(metadata(s),encodedMetadata,setup+' metadata');assert.deepEqual(await rows(s),[[null,1n]],setup+' rows')}finally{s.finalize()}});
 await withDb('right-chain',async db=>{
  for(const id of ['using-ambiguous-left-error','on-right-reference-error']){const c=capture.cases.find(item=>item.id===id);const expected=c.native.prepare;assert.throws(()=>db.prepare(c.sql),error=>{assert.deepEqual({kind:error.kind,operation:'prepare',resultCode:error.code,extendedCode:error.extendedCode,message:error.message},{kind:'sqlite',operation:expected.operation,resultCode:expected.resultCode,extendedCode:expected.extendedCode,message:expected.message});return true},id)}
  const s=db.prepare('SELECT a.k,c.k FROM a RIGHT JOIN c ON a.k=c.k').statement;assert.equal(await s.step(),'row');const controller=new AbortController();controller.abort();await assert.rejects(s.step({signal:controller.signal}),error=>error.kind==='cancelled');assert.throws(()=>s.finalize(),error=>error.kind==='cancelled');
 });
});


test('repeated RIGHT/FULL barriers are atomic until per-WhereLevel ownership lands',async()=>withDb('right-chain',async db=>{
 const sqls=[
  'SELECT * FROM a RIGHT JOIN b ON a.k=b.k RIGHT JOIN c ON b.k=c.k',
  'SELECT * FROM a FULL JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k',
  'SELECT * FROM a RIGHT JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k JOIN d ON c.k=d.k',
  'SELECT * FROM a FULL JOIN b ON a.k=b.k RIGHT JOIN c ON b.k=c.k WHERE a.k IS NULL',
 ];
 for(const sql of sqls)assert.throws(()=>db.prepare(sql),error=>error.kind==='unsupported'&&error.unsupportedClassification==='temporary'&&error.message==='multiple RIGHT/FULL JOIN barriers are not implemented',sql);
}));
