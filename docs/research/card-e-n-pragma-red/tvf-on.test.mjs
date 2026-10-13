import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { open } from '../../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('./tvf-on-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
const bytes=Buffer.from(native.base64,'base64');
assert.equal(createHash('sha256').update(bytes).digest('hex'),native.sha256);
for(const control of native.cases)test(control.sql,async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>new Response(bytes);
  let db,statement;
  try{
    db=await open('https://example.test/pragma-on');
    statement=db.prepare(control.sql).statement;
    for(let pass=0;pass<2;pass++){
      const rows=[];
      while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>{
        const value=statement.column(i);
        return value===null?{type:'null'}:typeof value==='bigint'?{type:'integer',value:String(value)}:{type:'text',utf8Hex:Buffer.from(value).toString('hex')};
      }));
      assert.deepEqual(rows,control.rows);
      statement.reset();
    }
  }finally{
    try{statement?.finalize();}finally{db?.close();globalThis.fetch=previous;}
  }
});
