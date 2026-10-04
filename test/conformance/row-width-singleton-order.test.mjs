import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,logEstAdd} from '../../src/internal/where-plan.ts';
import {compileSelect} from '../../src/internal/select-compiler.ts';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/stage3-advanced-index.json',import.meta.url)));
const oracle=JSON.parse(fs.readFileSync(new URL('./cases/row-width-singleton-order.json',import.meta.url)));
assert.equal(oracle.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
async function fixture(v,fn){
 const bytes=fs.readFileSync(new URL(`../../${v.fixture.path}`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));await fn(db)}finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
}


for(const v of cap.variants)test(`row-width singleton order ${v.id}`,async()=>fixture(v,async db=>{for(const c of oracle.cases.filter(c=>c.encoding===v.id)){
 assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../../${c.fixture.path}`,import.meta.url))).digest('hex'),c.fixture.sha256);
 const st=db.prepare(c.sql).statement;try{for(let run=0;run<2;run++){
 const rows=[];while(await st.step()==='row')rows.push(st.column(0));
 assert.deepEqual(rows,c.integerRows.map(BigInt));
 const accounting=privateAccounting(st);
 if(c.sortCount===0){assert.equal(accounting.sorterRows,0);assert.ok(accounting.indexSeeks>0)}else assert.ok(accounting.sorterRows>=3);
 st.reset();
 }}finally{st.finalize()}
}}));
