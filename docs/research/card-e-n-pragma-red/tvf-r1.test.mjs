import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('./tvf-r1-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));assert.equal(native.sourceId,manifest.sqliteSourceId);
for(const image of native.encodings)test(`${image.encoding}: metadata identity boundary and reset/rebind controls`,async()=>{
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://example.test/r1');
 for(const c of image.cases){
 // Native identity is INTEGER1 for live cid0 and NULL only for unmatched LEFT.
 assert.equal(c.runs.length,4);assert(c.runs[0].rows.length>0);assert.equal(c.runs[0].rows[0][1].value,'1');
 assert.throws(()=>db.prepare(c.sql),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary'&&/metadata.*rowid/.test(e.message));
 if(c.sql.includes(' WHERE ')){
 const predicateOnly=c.sql.replace(/SELECT t.id,p\.(rowid|_rowid_|oid)/,'SELECT t.id,p.cid');
 assert.throws(()=>db.prepare(predicateOnly),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary');
 assert.throws(()=>db.prepare(predicateOnly.replace(' WHERE ',' AND ')),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary');
 }
 // Metadata visible-column control follows native shape, missing LEFT, reset/rebind.
 const sql=c.sql.replace(/p\.(rowid|_rowid_|oid)/g,'p.cid');const s=db.prepare(sql).statement;
 try{for(const run of c.runs){s.bind(1,run.bindings[0]);for(let repeat=0;repeat<2;repeat++){
 const rows=[];while(await s.step()==='row')rows.push([String(s.column(0)),s.column(1)===null?null:String(s.column(1))]);
 const filtered=/WHERE/.test(sql);const expected=filtered?[]:run.rows.map(row=>[row[0].value,row[1].type===5?null:'0']);assert.deepEqual(rows,expected);s.reset();}}
 }finally{s.finalize();}
 }
 }finally{db?.close();globalThis.fetch=old;}
});
