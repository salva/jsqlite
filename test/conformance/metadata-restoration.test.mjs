import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openFixture} from './public-api-adapter.mjs';
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/tvf-five-native.json',import.meta.url)));
for(const image of native.encodings)test(`restored metadata residency and failed-filter recovery ${image.encoding}`,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(Buffer.from(image.base64,'base64'));
 const a=await openFixture(new Request('https://fixture.invalid/a')),b=await openFixture(new Request('https://fixture.invalid/b'));
 const live=new Set();
 const prepare=(db,sql)=>{const s=db.prepare(sql).statement;live.add(s);return s;};
 const finish=s=>{s.finalize();live.delete(s);};
 const rows=async s=>{const out=[];while(await s.step()==='row')out.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));return out;};
 try {
  const absent=prepare(a,"SELECT * FROM pragma_index_list('missing')");assert.deepEqual(await rows(absent),[]);absent.reset();assert.deepEqual(await rows(absent),[]);finish(absent);
  const listing=prepare(a,'SELECT * FROM pragma_database_list');
  assert.deepEqual(await rows(listing),[[0n,'main','']]);listing.reset();
  const scan=prepare(a,'SELECT * FROM pragma_index_list(?,?)');scan.bind(1,'t');scan.bind(2,'temp');assert.deepEqual(await rows(scan),[]);
  assert.deepEqual(await rows(listing),[[0n,'main',''],[1n,'temp','']]);listing.reset();
  const separate=prepare(b,'SELECT * FROM pragma_database_list');assert.deepEqual(await rows(separate),[[0n,'main','']]);finish(separate);
  scan.reset();scan.bind(2,'absent');await assert.rejects(()=>scan.step(),e=>e.kind==='sqlite'&&e.code===1&&/unknown database/.test(e.message));
  // reset reports the saved first execution error after releasing its cursor.
  assert.throws(()=>scan.reset(),e=>e.kind==='sqlite'&&e.code===1);scan.bind(2,'main');assert.ok((await rows(scan)).length>0);
  scan.reset();scan.bind(1,'missing');assert.deepEqual(await rows(scan),[]);finish(scan);
  assert.deepEqual(await rows(listing),[[0n,'main',''],[1n,'temp','']]);finish(listing);
 } finally {for(const s of live){try{s.finalize();}catch{}}a.close();b.close();globalThis.fetch=old;}
});
