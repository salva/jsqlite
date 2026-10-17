import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
// Retained oracle receipt: same pinned source and byte-identical encoding images
// as staged-deleted tvf-group-native.json (e10d043 lineage). Keep this original
// regression independent of the research-fixture cleanup.
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/scalar-filter-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
// Reviewer226 adjacent-native receipt, same SHA-checked images. Exact reproducer
// retained from the public-error regression; accepted RED157 requires execution.
const sql='SELECT t.x,(SELECT count(*)+sum(p.cid) FROM pragma_table_info(t.nm) p WHERE p.cid>=0) AS a FROM t ORDER BY t.x';
for(const image of native.encodings)test(`${image.encoding}: shared scalar aggregate uses metadata Filter destination`,async()=>{
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,statement;
 try{
  db=await open('https://fixture.invalid/metadata-scalar-error');
  statement=db.prepare(sql).statement;
  assert.deepEqual([statement.columnMetadata(0),statement.columnMetadata(1)],[
   {name:'x',declaredType:'INTEGER',database:'main',table:'t',origin:'x'},
   {name:'a',declaredType:null,database:null,table:null,origin:null},
  ]);
  for(let run=0;run<2;run++){
   const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);
   assert.deepEqual(rows,[[1n,6n],[2n,1n],[3n,6n]]);statement.reset();
  }
  statement.finalize();statement=db.prepare('SELECT 1').statement;
  for(let run=0;run<2;run++){assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);assert.equal(await statement.step(),'done');statement.reset();}
 }finally{try{statement?.finalize();}finally{db?.close();globalThis.fetch=previous;}}
});
