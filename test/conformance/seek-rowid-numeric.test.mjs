import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const cases=JSON.parse(fs.readFileSync(new URL('./cases/seek-rowid-numeric-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():Buffer.from(c.utf8Hex,'hex').toString();
for(const encoding of ['utf8','utf16le','utf16be'])test(`SeekRowid NUMERIC copy ${encoding}`,async()=>{
 const inputs=cases.filter(c=>c.encoding===encoding),bytes=fs.readFileSync(inputs[0].fixture);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));st=db.prepare('SELECT id,typeof(?1),?1 FROM t WHERE id=?1 LIMIT 4').statement;
  for(const c of inputs){st.reset();st.clearBindings();st.bind(1,c.value);const expected=c.rows.map(r=>r.map(decode));
   for(let run=0;run<2;run++){if(run)st.reset();const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));assert.deepEqual(rows,expected,`${c.value}/run${run}`);assert.equal(await st.step(),'done');const a=privateAccounting(st);assert.equal(a.tableSeeks,expected.length?1:(typeof c.value==='number'&&Number.isInteger(c.value)&&Math.abs(c.value)<2**63?1:typeof c.value==='string'&&['1','1.0'].includes(c.value)?1:0),String(c.value));}
  }
 }finally{st?.finalize();db?.closeDeferred();await new Promise(r=>server.close(r))}
});
