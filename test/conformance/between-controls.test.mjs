import assert from 'node:assert/strict';
import path from 'node:path';
import {open} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname),bridge=await startFixtureServer(path.join(root,'test/fixtures'));
const request=new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`),shape=e=>({kind:e.kind,message:e.message});
try{
  const db=await open(request,{limits:{maxWorkUnits:1_000_000,maxResultBytes:1_000_000}}),large='z'.repeat(256*1024);
  async function prepared(){const s=db.prepare('SELECT 1 BETWEEN 0 AND length(hex(?1))').statement;s.bind(1,large);return s}
  const limited=await prepared();let limit;try{await limited.step({maxWorkUnits:8})}catch(e){limit=e}assert.deepEqual(shape(limit),{kind:'limit',message:'statement exceeds maxWorkUnits'});assert.throws(()=>limited.reset(),e=>e===limit);limited.bind(1,'x');assert.equal(await limited.step(),'row');assert.equal(limited.column(0),1n);limited.finalize();
  const aborted=await prepared(),controller=new AbortController(),reason=new Error('between abort');setTimeout(()=>controller.abort(reason),0);let cancel;try{await aborted.step({signal:controller.signal})}catch(e){cancel=e}assert.deepEqual(shape(cancel),{kind:'cancelled',message:'statement execution was cancelled'});assert.equal(cancel.cause,reason);assert.throws(()=>aborted.finalize(),e=>e===cancel);
  const timed=await prepared(),now=Date.now;let tick=0;Date.now=()=>tick++<10?1000:1002;let timeout;try{await timed.step({timeoutMs:2})}catch(e){timeout=e}finally{Date.now=now}assert.deepEqual(shape(timeout),{kind:'timeout',message:'statement execution timed out'});assert.throws(()=>timed.finalize(),e=>e===timeout);
  const reuse=db.prepare('SELECT 7 BETWEEN 5 AND 9').statement;assert.equal(await reuse.step(),'row');assert.equal(reuse.column(0),1n);reuse.finalize();db.close();
  console.log(JSON.stringify({schema:'jsqlite-between-controls-ts/1',outcome:'pass',checks:['work-limit-reset-reuse','yielded-cancel-identity-finalize','deadline-identity-finalize','connection-reuse']}));
}finally{await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
