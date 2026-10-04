import test from 'node:test';
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
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-insertion-tie-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
async function fixture(v,fn){
 const bytes=fs.readFileSync(new URL(`../../${v.fixture}`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));await fn(db)}finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
}
for(const v of cap.variants)test(`native no-order insertion tie ${v.encoding}/${v.state}`,async()=>fixture(v,async db=>{
 const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(cap.sql).statement,schema),selected=planWhere(resolved,{neededColumns:[new Set([schema.tables.get('t').columns[1]])],orderBy:[]});
 assert.equal(selected.path.loops[0].capability.index.name,/INDEX (\w+)/.exec(v.eqp[0])[1]);
 const program=compileSelect(parseSql(cap.sql).statement,schema,btreeFromConnection(db),schema.encoding,10000,10000000,10000000,DEFAULT_PRIVATE_STATE_LIMITS,false);
 assert.deepEqual(program.ops.filter(op=>op.code==='OpenIndex').map(op=>op.p1),[schema.indexes.get('tb').rootPage]);
 const st=db.prepare(cap.sql).statement;try{for(let run=0;run<2;run++){if(run)st.reset();const rows=[];while(await st.step()==='row')rows.push(String(st.column(0)));assert.deepEqual(rows,v.rows)}}finally{st.finalize()}
}));
