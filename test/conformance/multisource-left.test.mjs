import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import { openFixture } from './public-api-adapter.mjs';

const capture=JSON.parse(fs.readFileSync(new URL('./cases/stage3-multisource-select.json',import.meta.url),'utf8'));
const files={utf8:'./fixtures/multisource-inner-oracle.db',emptyRight:'./fixtures/multisource-left-empty-right.db',utf16le:'./fixtures/multisource-inner-oracle-utf16le.db',utf16be:'./fixtures/multisource-inner-oracle-utf16be.db'};
function value(v){if(v.type==='null')return null;if(v.type==='integer')return BigInt(v.value);if(v.type==='real')return Number(v.value);if(v.type==='text')return Buffer.from(v.utf8Hex,'hex').toString();if(v.type==='blob')return new Uint8Array(Buffer.from(v.hex,'hex'));throw Error(`unknown ${v.type}`)}
async function serve(file='utf8'){const body=fs.readFileSync(new URL(files[file],import.meta.url));const server=http.createServer((q,r)=>{if(q.url!='/db'){r.writeHead(404).end();return}r.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':body.length});r.end(body)});await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));return server}
async function close(server){await new Promise((r,j)=>server.close(e=>e?j(e):r()))}
async function rows(s,options){const out=[];while(await s.step(options)==='row')out.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));return out}
async function withDb(file,fn,options){const server=await serve(file);let db;try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),options);await fn(db)}finally{try{db?.closeDeferred()}catch{}await close(server)}}
function metadata(s){return Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return{name:m.name,declType:m.declaredType,database:m.database,table:m.table,origin:m.origin}})}

test('pinned 3.53.4 LEFT contract preserves match, NullRow, WHERE, metadata, and empty-right behavior',async()=>{
 await withDb('utf8',async db=>{for(const id of ['left-unmatched','left-where-placement','left-on-placement']){const c=capture.cases.find(x=>x.id===id);assert.ok(c);const s=db.prepare(c.sql).statement;try{assert.deepEqual(metadata(s),c.native.columns,id+' metadata');assert.deepEqual(await rows(s),c.native.first.rows.map(r=>r.map(value)),id)}finally{s.finalize()}}});
 const c=capture.cases.find(x=>x.id==='right-empty');assert.ok(c);
 await withDb('emptyRight',async db=>{const s=db.prepare(c.sql).statement;try{assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows.map(r=>r.map(value)))}finally{s.finalize()}});
});

test('LEFT emits duplicate matches and one unmatched row for false/NULL ON, while WHERE may reject it',async()=>withDb('utf8',async db=>{
 const cases=[
  ['SELECT l.id,r1.id,r2.id FROM l LEFT JOIN r AS r1 ON l.k=r1.k LEFT JOIN r AS r2 ON r2.z=r1.z WHERE l.id<=2 ORDER BY l.id,r1.id,r2.id',[[1n,10n,10n],[1n,10n,20n],[2n,20n,10n],[2n,20n,20n]]],
  ['SELECT l.id,r.id FROM l LEFT JOIN r ON 0 ORDER BY l.id',[[1n,null],[2n,null],[3n,null],[9223372036854775807n,null]]],
  ['SELECT l.id,r.id FROM l LEFT JOIN r ON NULL ORDER BY l.id',[[1n,null],[2n,null],[3n,null],[9223372036854775807n,null]]],
  ['SELECT l.id,r.id FROM l LEFT JOIN r ON 0 WHERE r.id IS NOT NULL',[]],
 ];
 for(const [sql,expected] of cases){const s=db.prepare(sql).statement;try{assert.deepEqual(await rows(s),expected,sql)}finally{s.finalize()}}
}));

test('LEFT USING/NATURAL keep left merged owner, qualified columns, wildcard order, aliases, and types',async()=>withDb('utf8',async db=>{
 let s=db.prepare('SELECT * FROM l AS left_side LEFT JOIN r AS right_side USING(k) ORDER BY left_side.id').statement;
 try{assert.deepEqual(metadata(s).map(x=>[x.name,x.table,x.origin]),[['id','l','id'],['k','l','k'],['v','l','v'],['n','l','n'],['id','r','id'],['w','r','w'],['z','r','z']]);const out=await rows(s);assert.deepEqual(out.at(-1),[9223372036854775807n,'solo',new Uint8Array([49]),2,null,null,null]);assert.equal(out[2][1],null);assert.equal(out[2][4],null)}finally{s.finalize()}
 s=db.prepare('SELECT left_side.*,right_side.* FROM l AS left_side NATURAL LEFT JOIN r AS right_side ORDER BY left_side.id').statement;
 try{assert.deepEqual(metadata(s).map(x=>x.name),['id','k','v','n','id','k','w','z']);assert.equal((await rows(s)).length,4)}finally{s.finalize()}
}));

test('LEFT honors affinity/collation and composes with three-source LEFT/INNER/CROSS association',async()=>withDb('utf8',async db=>{
 const cases=[
  ["SELECT l.id,r.id FROM l LEFT JOIN r ON l.k=r.k ORDER BY l.id",[[1n,10n],[2n,20n],[3n,null],[9223372036854775807n,null]]],
  ['SELECT l.id,r.id,a.x FROM l LEFT JOIN r ON l.k=r.k LEFT JOIN a ON r.id=a.x ORDER BY l.id',[[1n,10n,null],[2n,20n,null],[3n,null,null],[9223372036854775807n,null,null]]],
  ['SELECT l.id,r.id,a.x FROM l LEFT JOIN r ON l.k=r.k INNER JOIN a ON r.id=a.x ORDER BY l.id',[]],
  ['SELECT l.id,r.id,a.x FROM l LEFT JOIN r ON l.k=r.k CROSS JOIN a ORDER BY l.id',[[1n,10n,1n],[2n,20n,1n],[3n,null,1n],[9223372036854775807n,null,1n]]],
 ];
 for(const [sql,expected] of cases){const s=db.prepare(sql).statement;try{assert.deepEqual(await rows(s),expected,sql)}finally{s.finalize()}}
}));

test('LEFT ORDER/DISTINCT/LIMIT and all database encodings retain NullRow semantics',async()=>{
 await withDb('utf8',async db=>{const s=db.prepare('SELECT DISTINCT r.id FROM l LEFT JOIN r ON l.k=r.k ORDER BY r.id LIMIT 3').statement;try{assert.deepEqual(await rows(s),[[null],[10n],[20n]])}finally{s.finalize()}});
 for(const file of ['utf16le','utf16be'])await withDb(file,async db=>{const s=db.prepare('SELECT α.id,β.名 FROM α LEFT JOIN β ON 0 ORDER BY α.id').statement;try{assert.deepEqual(await rows(s),[[1n,null]],file)}finally{s.finalize()}});
});

test('LEFT reset/rebind restarts across matched and NullRow transitions without duplicates',async()=>withDb('utf8',async db=>{
 const s=db.prepare('SELECT l.id,r.id FROM l LEFT JOIN r ON l.k=r.k AND r.id>?1 ORDER BY l.id').statement;
 try{s.bind(1,15n);assert.equal(await s.step(),'row');assert.deepEqual([s.column(0),s.column(1)],[1n,null]);s.reset();s.bind(1,5n);assert.deepEqual(await rows(s),[[1n,10n],[2n,20n],[3n,null],[9223372036854775807n,null]]);s.reset();s.bind(1,100n);assert.deepEqual(await rows(s),[[1n,null],[2n,null],[3n,null],[9223372036854775807n,null]])}finally{s.finalize()}
}));

test('LEFT cancellation/deadline/work/row/private failures around match and NullRow release execution state',async()=>{
 const sql='SELECT l.id,r.id FROM l LEFT JOIN r ON l.k=r.k ORDER BY l.id';
 await withDb('utf8',async db=>{
  for(const [options,kind] of [[{signal:Object.assign(new AbortController(),{}).signal},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:0},'limit']]){
   if(kind==='cancelled'){const c=new AbortController();c.abort();options.signal=c.signal}
   const s=db.prepare(sql).statement;await assert.rejects(s.step(options),e=>e.kind===kind);assert.throws(()=>s.finalize(),e=>e.kind===kind);
  }
  let s=db.prepare('SELECT l.id,r.id FROM l LEFT JOIN r ON 0').statement;assert.equal(await s.step(),'row');assert.deepEqual([s.column(0),s.column(1)],[1n,null]);const c=new AbortController();c.abort();await assert.rejects(s.step({signal:c.signal}),e=>e.kind==='cancelled');assert.throws(()=>s.finalize(),e=>e.kind==='cancelled');
  s=db.prepare('SELECT l.id,r.id FROM l LEFT JOIN r ON 0 LIMIT 2').statement;assert.deepEqual(await rows(s),[[1n,null],[2n,null]]);s.finalize();
 },undefined);
 await withDb('utf8',async db=>{const s=db.prepare(sql).statement;await assert.rejects(s.step(),e=>e.kind==='limit');assert.throws(()=>s.finalize(),e=>e.kind==='limit')},{limits:{maxPrivateEntries:1}});
});
