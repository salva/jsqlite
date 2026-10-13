import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../../src/index.ts';
const capture=JSON.parse(readFileSync(new URL('./tvf-native.json',import.meta.url)));let passed=0,gaps=[];
assert.equal(capture.sourceId,JSON.parse(readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const image of capture.encodings){const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);const db=await open('https://example.test/metadata.db');
try{for(const c of image.cases){let s;try{
 if(c.prepareCode!==0){assert.throws(()=>db.prepare(c.sql),e=>e.kind==='sqlite'&&e.code===c.prepareCode&&e.message===c.error);passed++;continue;}
 const p=db.prepare(c.sql);s=p.statement;assert.equal(p.tail,c.tail);assert.equal(s.parameterCount,0);assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),c.names);assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).declaredType),c.decltypes);
 if(c.stepCode!==101){await assert.rejects(()=>s.step(),e=>e.kind==='sqlite'&&e.code===c.stepCode&&e.message===c.stepError);assert.throws(()=>s.reset(),e=>e.code===c.stepCode);await assert.rejects(()=>s.step(),e=>e.code===c.stepCode);assert.throws(()=>s.finalize(),e=>e.code===c.stepCode);s=null;passed++;continue;}
 for(let repeat=0;repeat<2;repeat++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>({type:{integer:1,real:2,text:3,blob:4,null:5}[s.columnType(i)],value:typeof s.column(i)==='bigint'?String(s.column(i)):s.column(i)})));assert.deepEqual(rows,c.rows,c.sql);s.reset();}passed++;
}catch(e){gaps.push(`${image.encoding}: ${c.sql}: ${e.kind??e.name} ${e.message}`);}finally{if(s){try{s.finalize();}catch{}}}}
const r=db.prepare('SELECT 7').statement;await r.step();assert.equal(r.column(0),7n);r.finalize();
}finally{db.close();globalThis.fetch=old;}}
console.log('matched',passed,'gaps',gaps.length);console.log(gaps.join('\n'));if(gaps.length)process.exitCode=1;
