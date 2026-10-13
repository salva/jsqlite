import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {open} from '../../../src/index.ts';
const capture=JSON.parse(await readFile(new URL('./table-native.json',import.meta.url),'utf8'));
let passed=0;
for(const image of capture.encodings){
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(await readFile(image.image));
 const db=await open('https://example.test/metadata.db');
 try{
  for(const expected of image.cases.filter(c=>/PRAGMA (?:main\.|temp\.|absent\.)?table_[xi]*info/.test(c.sql))){
   if(expected.prepareCode!==0){assert.throws(()=>db.prepare(expected.sql),e=>e.kind==='sqlite'&&e.code===expected.prepareCode&&e.message===expected.error);passed++;continue;}
   const prepared=db.prepare(expected.sql),s=prepared.statement;
   assert.equal(prepared.tail,expected.tail);
   assert.equal(s.parameterCount,0);assert.equal(s.columnCount,expected.names.length);
   assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),expected.names.map(name=>({name,declaredType:null,database:null,table:null,origin:null})));
   try{for(let repeat=0;repeat<2;repeat++){
    const rows=[];
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>({type:{integer:1,real:2,text:3,blob:4,null:5}[s.columnType(i)],value:typeof s.column(i)==='bigint'?String(s.column(i)):s.column(i)})));
    assert.deepEqual(rows,expected.rows,`${image.encoding}: ${expected.sql}`);
    s.reset();
   }
   }finally{s.finalize();}passed++;
  }
  // New semantic branch must not accidentally authorize excluded execution.
  for(const sql of ['PRAGMA journal_mode=WAL','PRAGMA wal_checkpoint','PRAGMA writable_schema=1'])assert.throws(()=>db.prepare(sql),e=>e.kind==='unsupported'&&e.unsupportedClassification==='permanent');
 }finally{db.close();globalThis.fetch=old;}
}
console.log(`Pinned/public table metadata: ${passed} all-encoding cases passed, row/type/metadata/tail/reset/finalize; mutation controls passed.`);
