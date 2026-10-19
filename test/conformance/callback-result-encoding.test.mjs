import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// OP_AggFinal/OP_AggValue change result encoding after callback errors. Native
// witness/receipt: docs/research/card-r-e-jsonb-error-position-review.md.
// Derive expected database byte order, not host-normalized SQL results.
function hex(s,enc){const b=Buffer.from(s,enc==='UTF-8'?'utf8':'utf16le');if(enc==='UTF-16be')b.swap16();return b.toString('hex').toUpperCase()}
for(const enc of ['UTF-8','UTF-16le','UTF-16be'])test(`callback TEXT publication owns database encoding: ${enc}`,async()=>{
 const fixture=({'UTF-8':'utf8','UTF-16le':'utf16le','UTF-16be':'utf16be'})[enc];
 const bytes=fs.readFileSync(new URL(`../fixtures/json-label-encoding/${fixture}-label.db`,import.meta.url));
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let db;try{db=await open(new Request(`http://127.0.0.1:${server.address().port}/db`));
 const cases=[
  ["hex(json_group_object(char(97,0,98),1))",hex('{"a":1}',enc)],
  ['hex(json_group_array(1))',hex('[1]',enc)],
  ["hex(group_concat('é'))",hex('é',enc)],
  ["hex(json_group_object(NULL,x'ff'))",hex('{}',enc)],
  ["hex(jsonb_group_object('a',1))",'4C17611331'],
  ['hex(jsonb_group_array(1))','2B1331'],
  ["hex(char(97))",hex('a',enc)],
 ];
 for(const [expression,want] of cases){const s=db.prepare(`SELECT ${expression} AS result`).statement;try{for(let pass=0;pass<2;pass++){assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'text');assert.equal(s.column(0),want,expression);s.reset()}}finally{s.finalize()}}
 for(const [expression,type,value] of [['sum(1)','integer',1n],['sum(1.0)','real',1],['sum(NULL)','null',null],['total(NULL)','real',0]]){const s=db.prepare(`SELECT ${expression}`).statement;try{assert.equal(await s.step(),'row');assert.equal(s.columnType(0),type);assert.equal(s.column(0),value)}finally{s.finalize()}}
 for(const expression of ['json_group_array(1)','json_group_object(\'a\',1)']){const s=db.prepare(`SELECT ${expression} FROM t WHERE 0`).statement;try{assert.equal(await s.step(),'row');assert.equal(s.column(0),expression.startsWith('json_group_array')?'[]':'{}')}finally{s.finalize()}}
 // One-row sliding frame exercises repeated AggValue snapshots and inverse;
 // scalar wrappers around windows are not needed for byte/class ownership.
 for(const expression of ['json_group_array(1)','jsonb_group_array(1)']){const s=db.prepare(`SELECT ${expression} OVER (ORDER BY x ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM t`).statement;try{for(let pass=0;pass<2;pass++){let count=0;while(await s.step()==='row'){count++;assert.equal(s.columnType(0),expression.startsWith('jsonb')?'blob':'text');assert.deepEqual(s.column(0),expression.startsWith('jsonb')?new Uint8Array([0x2b,0x13,0x31]):'[1]')}assert.ok(count>1);s.reset()}}finally{s.finalize()}}
 const nested=db.prepare("SELECT json_group_array(json_array(1)),hex(json_pretty('[1]'))").statement;try{assert.equal(await nested.step(),'row');assert.equal(nested.column(0),'[[1]]');assert.equal(nested.column(1),hex('[\n    1\n]',enc))}finally{nested.finalize()}
 const bad=db.prepare("SELECT json_group_array(x'ff')").statement;try{await assert.rejects(bad.step(),e=>e.message==='JSON cannot hold BLOB values');assert.throws(()=>bad.reset(),e=>e.message==='JSON cannot hold BLOB values')}finally{bad.finalize()}
 }finally{db?.closeDeferred();server.closeAllConnections();await new Promise(r=>server.close(r))}
});
