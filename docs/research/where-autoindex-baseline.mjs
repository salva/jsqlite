// Scoped baseline companion; execute with node --experimental-strip-types FILE RECEIPT.
import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {openFixture,privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../test/conformance/close-test-server.mjs';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {planWhere} from '../../src/internal/where-plan.ts';
const receipt=process.argv[2],native=JSON.parse(fs.readFileSync(receipt)),out=[];
function cell(s,i){const type=s.columnType(i),v=s.column(i);if(type==='null')return {type};if(type==='integer')return {type,value:String(v)};if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type,ieee754be:b.toString('hex')}}if(type==='text')return {type,utf8Hex:Buffer.from(v).toString('hex')};return {type,hex:Buffer.from(v).toString('hex')}}
for(const sql of [native.sql,native.sql.replace('rhs r','rhs r NOT INDEXED')])
for(const v of native.variants){const bytes=fs.readFileSync(new URL(v.fixture,'file://'+receipt));const storage=ImmutableStorage.open(bytes);let kinds;try{const schema=loadSchemaGraph({[storageOwner]:storage}),r=expandAndResolveSelect(parseSql(sql).statement,schema),p=planWhere(r,{neededColumns:r.sources.map(s=>new Set(s.table.columns)),orderBy:[]});kinds=p.path?.loops.map(l=>l.kind)}finally{storage.close()}
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));let s=db.prepare(sql).statement;try{const columns=Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return {name:m.name,declaredType:m.declaredType,database:m.database,table:m.table,origin:m.origin}});assert.deepEqual(columns,v.modes[0].columns);let previous;for(let run=0;run<v.modes[0].runs.length;run++){if(native.case==='lifetime'){if(run===4){s.finalize();s=db.prepare(sql).statement;const replacement=Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));assert.deepEqual(replacement,columns)}s.bind(1,BigInt(v.modes[0].bindings[run]))}const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s,i)));assert.deepEqual(rows,v.modes[0].runs[run].rows);const work=privateAccounting(s);if(previous && (native.case!=='lifetime'||run%2===1))assert.deepEqual(work,previous);previous=work;out.push({sql,encoding:v.encoding,run,kinds,rows:rows.length,work});s.reset()}}finally{s.finalize()}}finally{db?.closeDeferred();await closeTestServer(server)}}
console.log(JSON.stringify(out,null,2));
