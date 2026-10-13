import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Preserve review-v6's historical unsupported disposition in its owning matrix.
// Current vector expression admission must execute it, not silently accept an
// unimplemented expression. This does not credit a selected index strategy.
test('historically unsupported tuple IN executes exact pinned typed rows and reset',async()=>{
 const matrix=JSON.parse(fs.readFileSync(new URL('./cases/in-range-branch-applicability.json',import.meta.url)));
 const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
 assert.equal(matrix.sourceId,pin.sqliteSourceId);
 const entry=matrix.cases.find(c=>c.dimension==='prepare-unsupported');
 const bytes=fs.readFileSync(new URL(`../../${entry.fixture}`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),matrix.fixtureSha256);
 const previous=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/tuple-in-displaced');}finally{globalThis.fetch=previous;}
 let statement;
 try{
  statement=db.prepare(entry.sql).statement;
  assert.equal(statement.columnCount,1);assert.equal(statement.columnMetadata(0).name,'id');
  for(let pass=0;pass<2;pass++){
   const rows=[];
   while(await statement.step()==='row')rows.push([{type:statement.columnType(0),value:String(statement.column(0))}]);
   assert.deepEqual(rows,entry.expected);assert.equal(await statement.step(),'done');
   if(pass===0)statement.reset();
  }
  statement.finalize();statement=undefined;
  const sibling=db.prepare('SELECT 1').statement;
  try{assert.equal(await sibling.step(),'row');assert.equal(sibling.column(0),1n);}finally{sibling.finalize();}
 }finally{statement?.finalize();db.close();}
});
