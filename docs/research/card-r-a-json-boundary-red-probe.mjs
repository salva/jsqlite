// Copy this evidence probe into test/conformance/ of an exact 2274 archive before running.
import assert from 'node:assert/strict';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);
const hdr=n=>n<=11?[n*16+7]:n<=255?[0xc7,n]:n<=65535?[0xd7,n>>8,n&255]:[0xe7,0,1,0,0];
try {for(const enc of ['utf8','utf16le','utf16be']) {
 const db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
 try {for(const n of [11,12,255,256,65535,65536]) {
 const expected=Uint8Array.from([...hdr(n),...new Uint8Array(n).fill(97)]),text='"'+'a'.repeat(n)+'"';
 const s=db.prepare('SELECT jsonb(?1),json(?2),json_valid(?2,8)').statement;s.bind(1,text);s.bind(2,expected);
 assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'blob');assert.deepEqual(s.column(0),expected);assert.equal(s.column(1),text);assert.equal(s.column(2),1n);s.reset();assert.equal(await s.step(),'row');s.finalize();console.log(enc,'payload',n,'OK');
 }
 for(const n of [1000,1001]) {const text='['.repeat(n)+'0'+']'.repeat(n);const s=db.prepare('SELECT json_valid(?1)').statement;s.bind(1,text);assert.equal(await s.step(),'row');console.log(enc,'TEXT depth',n,'valid',String(s.column(0)));s.finalize();}

 for(const n of [1000,1001]) {let b=Uint8Array.of(0);for(let i=0;i<n;i++){const z=b.length;const h=z<=11?[z*16+11]:z<=255?[0xcb,z]:[0xdb,z>>8,z&255];b=Uint8Array.from([...h,...b]);}const s=db.prepare('SELECT json_valid(?1,8),json(?1)').statement;s.bind(1,b);try{assert.equal(await s.step(),'row');console.log(enc,'JSONB depth',n,'valid',String(s.column(0)),'render length',s.column(1).length)}catch(e){console.log(enc,'JSONB depth',n,'error',e.kind,e.message)}finally{try{s.finalize()}catch{}}}
 } finally {db.closeDeferred()}
}} finally {await new Promise(r=>bridge.server.close(r))}
