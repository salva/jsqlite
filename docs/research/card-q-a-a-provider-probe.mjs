import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from '../../test/conformance/public-api-adapter.mjs';
import {dateTimeEnvironmentOption} from '../../src/internal/date-time.ts';
const bytes=fs.readFileSync(new URL('../../test/fixtures/expression-cursor/users-utf8.db',import.meta.url));
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let calls=0;
const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{
 [dateTimeEnvironmentOption]:{nowUnixMilliseconds(){return 946684800000n+BigInt(calls++)*10000n},localFieldsAtUnixSecond(){throw new Error('unexpected local provider call for UTC clock')}}
});
try{
 const {statement}=db.prepare("WITH RECURSIVE x(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM x WHERE n<2) SELECT datetime('now',printf('+%d seconds',n)),datetime('now') FROM x");
 console.log(JSON.stringify({phase:'prepare',calls}));
 try{while(await statement.step()==='row')console.log(JSON.stringify({row:[statement.column(0),statement.column(1)],calls}));}
 finally{statement.finalize()}
 const {statement:utc}=db.prepare("SELECT datetime('now','utc')");
 try{let result;try{result=await utc.step();console.log(JSON.stringify({utc:result,value:utc.column(0),calls}))}catch(e){console.log(JSON.stringify({utcError:e.message,code:e.code,calls}))}}
 finally{try{utc.reset()}catch{}utc.finalize()}
}finally{db.close();await new Promise(resolve=>server.close(resolve))}
