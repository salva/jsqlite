import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname),file=path.join(root,'test/fixtures/expression-cursor/users-utf8.db');
const server=http.createServer((req,res)=>{const stat=fs.statSync(file);res.writeHead(200,{'Content-Length':stat.size});fs.createReadStream(file).pipe(res)});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
try{
 const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
 try{
  async function row(sql,parameters=[]){const s=db.prepare(sql).statement;try{for(const [i,v] of parameters.entries())s.bind(i+1,v);assert.equal(await s.step(),'row');const values=Array.from({length:s.columnCount},(_,i)=>s.column(i));assert.equal(await s.step(),'done');return values}finally{s.finalize()}}
  assert.deepEqual(await row("SELECT printf('%d',7),format('%s','x'),round(1.25,1)"),['7','x',1.3]);
  assert.deepEqual(await row("SELECT round(2.5),round(-2.5),round(1.2345,2),round(1.0,400),round(NULL)"),[3,-3,1.23,1,null]);
  assert.deepEqual(await row("SELECT printf('%d|%lld|%.17g|%q|%Q|%w',2147483648,9223372036854775807,1.2345678901234567,'a''b','a''b','a\"b'),format('%!g',1.0/3.0)"),["2147483648|9223372036854775807|1.234567890123457|a''b|'a''b'|a\"\"b",'0.333333']);
  assert.deepEqual(await row("SELECT printf(NULL,1),printf('%d/%s/%Q',NULL,NULL,NULL)"),[null,'0//NULL']);
  assert.deepEqual(await row("SELECT printf('%08d|%-5s|%.3s|%x|%o|%%',?1,?2,?3,?4,?4),round(?5,?6)",[12n,'xy','abcdef',255n,2.675,2n]),['00000012|xy   |abc|ff|377|%',2.68]);
  const limited=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:{maxResultBytes:5,maxWorkUnits:10000}});try{const s=limited.prepare("SELECT printf('%s','abcdef')").statement;let saved;try{await s.step()}catch(error){saved=error}assert.equal(saved?.kind,'limit');assert.equal(saved?.message,'string or blob too big');await assert.rejects(()=>s.step(),error=>error===saved);assert.throws(()=>s.finalize(),error=>error===saved)}finally{limited.closeDeferred()}
 }finally{db.closeDeferred()}
}finally{await new Promise(resolve=>server.close(resolve))}
console.log(JSON.stringify({outcome:'pass',slice:'printf-format-round'}));
