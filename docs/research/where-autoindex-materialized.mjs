// Native-first materialized automatic-index regression. Receipt is captured
// independently using pinned SQLite, never generated from this compiler.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {openFixture,privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../test/conformance/close-test-server.mjs';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {btreeFromStorage} from '../../src/internal/btree.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {compileTableSelect,programOpcodeNames} from '../../src/internal/vdbe.ts';
const native=JSON.parse(fs.readFileSync(process.argv[2]));
function cell(s,i){const type=s.columnType(i),v=s.column(i);if(type==='null')return {type};if(type==='integer')return {type,value:String(v)};if(type==='text')return {type,utf8Hex:Buffer.from(v).toString('hex')};if(type==='blob')return {type,hex:Buffer.from(v).toString('hex')};const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type,ieee754be:b.toString('hex')};}
for(const variant of native.variants){
 const bytes=fs.readFileSync(variant.fixture),storage=ImmutableStorage.open(bytes);
 const expected=variant.cases.find(c=>c.case==='derived-target');assert.ok(expected);
 assert.ok(expected.eqp.some(s=>s.includes('AUTOMATIC PARTIAL COVERING INDEX')));
 try{const program=compileTableSelect(parseSql(expected.sql).statement,loadSchemaGraph({[storageOwner]:storage}),btreeFromStorage(storage),Number.MAX_SAFE_INTEGER),names=programOpcodeNames(program);
  assert.equal(names.filter(n=>n==='OpenAutoindex').length,1);assert.equal(names.filter(n=>n==='FilterAdd').length,1);assert.equal(names.filter(n=>n==='Filter').length,1);
  assert.ok(names.indexOf('Gosub')<names.indexOf('OpenAutoindex'));
 }finally{storage.close();}
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,s;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));s=db.prepare(expected.sql).statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),expected.columns);
  let previousExecution;
  for(let run=0;run<2;run++){
   const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s,i)));
   assert.deepEqual(rows,expected.rows);
   const work=privateAccounting(s);
   assert.equal(work.planKind,'automatic-index');assert.equal(work.completedAutomaticBuilds,1);assert.equal(work.automaticInserts,1);assert.equal(work.filterAdds,1);assert.equal(work.probes,5000);assert.equal(work.filterAbsent,4500);assert.equal(work.filterPresent,500);assert.equal(work.coveringTableLookups,0);assert.equal(work.ownedBytes,0);assert.equal(work.openCursors,0);assert.equal(work.chargedBytes,work.refundedBytes);assert.notEqual(work.executionId,previousExecution);previousExecution=work.executionId;
   console.log(variant.encoding,run,JSON.stringify(work));
   s.reset();
  }
 }finally{s?.finalize();db?.close();await closeTestServer(server);}
}
