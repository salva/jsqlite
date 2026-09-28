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
  assert.deepEqual(await row("SELECT printf('%08d|%-5s|%.3s|%x|%o|%%',?1,?2,?3,?4,?4),round(?5,?6)",[12n,'xy','abcdef',255n,2.675,2n]),['00000012|xy   |abc|ff|377|%',2.67]);
  assert.deepEqual(await row("SELECT printf('%r|%,d|abc%',1,1234567)"),['1st|1,234,567|abc%']);
  assert.deepEqual(await row("SELECT printf('[%5s][%!5s]','é','é'),printf('[%.*s]',-2,'abcd')"),['[   é][    é]','[ab]']);
  assert.deepEqual(await row("SELECT printf('%f|%0.2e|%+f|% f',1e999,1e999,-1e999,1e999)"),['Inf|9.00e+999|-Inf| Inf']);
  assert.deepEqual(await row("SELECT CAST(9223372036854775807+1 AS TEXT),CAST(1e308*10 AS TEXT),CAST(1e-320 AS TEXT),printf('%!.17g|%!.20g',1e-320,1e-320),quote(1e308*10)"),['9.2233720368547758e+18','Inf','9.9998886718268301e-321','9.9998886718268301e-321|9.99988867182683005e-321','9.0e+999']);
  assert.deepEqual(await row("SELECT printf('%!.20f',1.0/3),printf('%!.20F',-1.0/3),printf('%!.20e',1e-320),printf('%!+030.20E',-1e20/3)"),['0.333333333333333315','','9.99988867182683005e-321','-00000003.3333333333333332E+19']);
  assert.deepEqual(await row("SELECT printf('%f|%0f',NULL,NULL)"),['0.000000|0.000000']);
  // The SQL formatter reads C strings: a NUL terminates both the format and
  // converted text. Dynamic width/precision consume arguments in source order.
  assert.deepEqual(await row("SELECT printf(?1,?2,99),format(?3,?4,?5,?6)",['[%s]\0%d','ab\0cd','%0*.*f',8n,2n,1.25]),['[ab]','00001.25']);
  assert.deepEqual(await row('SELECT printf(),format()'),[null,null]);

  // The pinned profile admits at most 1000 function arguments. Exercise both
  // edges through public prepare rather than inferring them from registry data.
  const atLimit=`SELECT length(printf('%s',${Array(999).fill('NULL').join(',')}))`;
  assert.deepEqual(await row(atLimit),[0n]);
  const overLimit=`SELECT printf('%s',${Array(1000).fill('NULL').join(',')})`;
  assert.throws(()=>db.prepare(overLimit),error=>error?.kind==='sqlite'&&error.code===1&&error.message==='too many arguments on function printf');

  const limited=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:{maxResultBytes:5,maxWorkUnits:10000}});try{
   assert.deepEqual(await (async()=>{const s=limited.prepare(`SELECT printf('%.999s','x'),printf('%.*s',999,''),printf('%.999q','a''b'),printf('%.*Q',999,'x'),printf('%.999w','a"b'),printf('%.2c','é')`).statement;try{assert.equal(await s.step(),'row');return Array.from({length:s.columnCount},(_,i)=>s.column(i))}finally{s.finalize()}})(),['x','',"a''b","'x'",'a""b','éé']);
   assert.deepEqual(await (async()=>{const s=limited.prepare("SELECT printf('%999n'),printf('%*n',999),printf('a%999nb'),printf('%*n%d',999,7)").statement;try{assert.equal(await s.step(),'row');return Array.from({length:s.columnCount},(_,i)=>s.column(i))}finally{s.finalize()}})(),['','','ab','7']);
   const s=limited.prepare("SELECT printf('%s',?1)").statement;s.bind(1,'abcdef');let saved;try{await s.step()}catch(error){saved=error}assert.equal(saved?.kind,'limit');assert.equal(saved?.message,'string or blob too big');await assert.rejects(()=>s.step(),error=>error===saved);
   assert.throws(()=>s.reset(),error=>error===saved);s.bind(1,'ok');assert.equal(await s.step(),'row');assert.equal(s.columnText(0),'ok');assert.equal(await s.step(),'done');s.finalize();
   const reuse=limited.prepare("SELECT format('%d',7)").statement;assert.equal(await reuse.step(),'row');assert.equal(reuse.columnText(0),'7');reuse.finalize();
   for(const sql of ["SELECT printf('%999999999s','x')","SELECT printf('%*s',999999999,'x')","SELECT printf('%.*f',999999999,1.0)","SELECT printf('%.999c','x')","SELECT printf('%.999Q','a''b')"]){const hostile=limited.prepare(sql).statement;let error;try{await hostile.step()}catch(caught){error=caught}assert.equal(error?.kind,'limit');assert.equal(error?.message,'string or blob too big');await assert.rejects(()=>hostile.step(),caught=>caught===error);assert.throws(()=>hostile.finalize(),caught=>caught===error)}
   const afterHostile=limited.prepare("SELECT printf('%r',2)").statement;assert.equal(await afterHostile.step(),'row');assert.equal(afterHostile.columnText(0),'2nd');afterHostile.finalize();
  }finally{limited.closeDeferred()}

  // Formatting output is charged incrementally and observes all Statement controls.
  const controlled=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:{maxResultBytes:200000,maxWorkUnits:200000}});try{
   const small=controlled.prepare("SELECT length(printf('%s',?1))").statement;small.bind(1,'xx');assert.equal(await small.step({maxWorkUnits:100}),'row');assert.equal(small.columnInteger(0),2n);small.finalize();
   const large=controlled.prepare("SELECT length(printf('%s',?1))").statement;large.bind(1,'x'.repeat(65537));await assert.rejects(()=>large.step({maxWorkUnits:100}),error=>error?.kind==='limit'&&error.message==='statement exceeds maxWorkUnits');assert.throws(()=>large.finalize());
   const abort=new AbortController();abort.abort(new Error('format abort'));const cancelled=controlled.prepare("SELECT printf('%s','x')").statement;let cancelError;try{await cancelled.step({signal:abort.signal})}catch(error){cancelError=error}assert.equal(cancelError?.kind,'cancelled');await assert.rejects(()=>cancelled.step(),error=>error===cancelError);assert.throws(()=>cancelled.finalize(),error=>error===cancelError);
   const realNow=Date.now;let ticks=0;Date.now=()=>ticks++<2?1000:1002;const timed=controlled.prepare("SELECT printf('%s%s%s%s','a','b','c','d')").statement;let timeout;try{await timed.step({timeoutMs:2})}catch(error){timeout=error}finally{Date.now=realNow}assert.equal(timeout?.kind,'timeout');assert.throws(()=>timed.finalize(),error=>error===timeout);
  }finally{controlled.closeDeferred()}
 }finally{db.closeDeferred()}
}finally{await new Promise(resolve=>server.close(resolve))}
console.log(JSON.stringify({outcome:'pass',slice:'printf-format-round'}));
