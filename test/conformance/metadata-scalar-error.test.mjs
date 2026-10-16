import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open,JSQLiteError} from '../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/tvf-group-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
const sql='SELECT t.x,(SELECT count(*)+sum(p.cid) FROM pragma_table_info(t.nm) p WHERE p.cid>=0) AS a FROM t ORDER BY t.x';
for(const image of native.encodings)test(`${image.encoding}: shared scalar planner gap uses public error boundary`,async()=>{
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,statement;
 try{
  db=await open('https://fixture.invalid/metadata-scalar-error');
  try{assert.throws(()=>{statement=db.prepare(sql).statement;},error=>{
   assert.ok(error instanceof JSQLiteError);assert.equal(error.name,'JSQLiteError');
   assert.equal(error.kind,'unsupported');assert.equal(error.unsupportedClassification,'temporary');
   assert.equal(error.code,null);assert.equal(error.extendedCode,null);
   assert.equal(error.message,'metadata module requires its Filter producer');return true;
  });}finally{statement?.finalize();statement=undefined;}
  statement=db.prepare('SELECT 1').statement;
  for(let run=0;run<2;run++){assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);assert.equal(await statement.step(),'done');statement.reset();}
 }finally{try{statement?.finalize();}finally{db?.close();globalThis.fetch=previous;}}
});
