import fs from 'node:fs';import http from 'node:http';
import {openFixture} from '../../test/conformance/public-api-adapter.mjs';
import {dateTimeEnvironmentOption} from '../../src/internal/date-time.ts';
const bytes=fs.readFileSync(process.argv[2]);
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let clocks=0;
const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{[dateTimeEnvironmentOption]:{nowUnixMilliseconds(){clocks++;return 946684800000n},localFieldsAtUnixSecond(){return null}}});
try{
 for(const sql of ['SELECT g FROM literal','SELECT g FROM t',"SELECT datetime('2000-01-01')"]){
  let statement;try{({statement}=db.prepare(sql));console.log(JSON.stringify({sql,prepare:'ok'}));const result=await statement.step();console.log(JSON.stringify({result,text:statement.columnText(0),clocks}));}
  catch(e){console.log(JSON.stringify({sql,error:e.message,code:e.code}));try{statement?.reset()}catch{}}
  finally{statement?.finalize()}
 }
}finally{db.close();await new Promise(resolve=>server.close(resolve))}
