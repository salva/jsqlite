import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/tvf-group-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
for(const image of native.encodings)test(`${image.encoding}: metadata identity cannot consume synthetic aggregate identity`,async()=>{
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{
  db=await open('https://fixture.invalid/metadata-identity');
  for(const alias of ['rowid','_rowid_','oid'])for(const sql of [
   `SELECT p.${alias},count(*) FROM pragma_table_info('t') p GROUP BY p.${alias}`,
   `SELECT count(*) FROM pragma_table_info('t') p WHERE p.${alias}>0`,
   `SELECT count(*) FROM pragma_table_info('t') p GROUP BY p.${alias}`,
   `SELECT p.${alias} FROM pragma_table_info('t') p`,
   `SELECT count(*) FROM t JOIN pragma_table_info(t.nm) p ON p.${alias}>0`,
   `SELECT count(*) FROM t LEFT JOIN pragma_table_info(t.nm) p ON p.${alias}>0`,
   `SELECT (SELECT count(*) FROM pragma_table_info('t') p WHERE p.${alias}=t.rowid) FROM t`,
  ]){
   // Finalize even an unexpectedly successful prepare, so BUSY cannot mask
   // the failed rejection assertion.
   let statement;
   try{assert.throws(()=>{statement=db.prepare(sql).statement;},e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary',sql);}
   finally{statement?.finalize();}
  }
  const s=db.prepare("SELECT t.rowid,p.name,count(*) FROM t JOIN pragma_table_info(t.nm) p ON p.cid=0 GROUP BY t.rowid,p.name ORDER BY t.rowid").statement;
  try{for(let run=0;run<2;run++){const rows=[];while(await s.step()==='row')rows.push([s.column(0),s.column(1),s.column(2)]);assert.deepEqual(rows,[[1n,'x',1n],[2n,'x',1n],[3n,'x',1n]]);s.reset();}}finally{s.finalize();}
 }finally{db?.close();globalThis.fetch=previous;}
});
