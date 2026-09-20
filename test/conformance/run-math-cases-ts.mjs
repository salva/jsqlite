import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const native=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-math.native.json'),'utf8'));
const fixtures={'UTF-8':'users-utf8.db','UTF-16le':'users-utf16le.db','UTF-16be':'users-utf16be.db'};
function bindValue(p){return p.type==='null'?null:p.type==='integer'?BigInt(p.value):p.type==='real'?Number(p.value):p.type==='blob'?Uint8Array.from(Buffer.from(p.hex,'hex')):p.value}
function cell(statement,index){const type=statement.columnType(index),value=statement.column(index);if(type==='integer')return{type,value:String(value)};if(type==='real'){const bytes=new ArrayBuffer(8);new DataView(bytes).setFloat64(0,Number(value));return{type,ieee754Hex:Buffer.from(bytes).toString('hex')};}if(type==='text')return{type,value};if(type==='blob')return{type,hex:Buffer.from(value).toString('hex')};return{type:'null'}}
let passed=0;
for(const [encoding,file] of Object.entries(fixtures)){
 const fixture=path.join(root,'test/fixtures/expression-cursor',file);const server=http.createServer((_req,res)=>{const s=fs.statSync(fixture);res.writeHead(200,{'Content-Length':s.size});fs.createReadStream(fixture).pipe(res)});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 try{const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));try{for(const observation of native.observations.filter(x=>x.encoding===encoding)){const {statement}=db.prepare(observation.sql);try{for(const p of observation.parameters)statement.bind(p.index,bindValue(p));const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>cell(statement,i)));const expected=observation.rows.map(row=>row.map(c=>{if(c.type==='real')return{type:c.type,ieee754Hex:c.ieee754Hex};if(c.type==='text')return{type:c.type,value:c.value};return c}));assert.deepEqual(rows,expected,`${encoding}:${observation.id}`);passed++}finally{statement.finalize()}}}finally{db.closeDeferred()}}finally{await new Promise(resolve=>server.close(resolve))}
}
assert.equal(passed,63);console.log(JSON.stringify({outcome:'pass',cases:21,encodings:3,observations:passed,tsCredit:21}));
