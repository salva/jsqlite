import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {jsonAggregateBlob as aggregateResultBlob,appendJsonStringBytes,quoteJsonBytes} from '../../src/internal/json.ts';
import {aggregateTextToBlob as jsonAggregateBlob} from '../../src/internal/json-aggregate-blob.ts';
import oracle from './json-aggregate-conversion-oracle.json' with {type:'json'};
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {open} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';

test('streaming byte quote preserves all byte escapes and checkpoints within production',async()=>{
 const bytes=Uint8Array.from({length:4096},(_,i)=>i%256),parts=[];let checks=0;
 await appendJsonStringBytes(bytes,new Uint8Array(192),async part=>{assert.ok(part.length<=192);parts.push(part.slice())},()=>{checks++});
 const got=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const part of parts){got.set(part,at);at+=part.length}
 assert.deepEqual(got,quoteJsonBytes(bytes));assert.equal(checks,128);
 const sentinel=new Error('quote cancelled');let emitted=0;
 await assert.rejects(appendJsonStringBytes(bytes,new Uint8Array(192),async()=>{emitted++},()=>{throw sentinel}),e=>e===sentinel);
 assert.equal(emitted,1); // opening quote precedes first scan probe, no payload after error
});

test('completed-text conversion stops at the native NUL terminator, not the byte extent',async()=>{
 let live=0;const control={reserve:n=>{live+=n},release:n=>{live-=n},checkpoint:async()=>{}};
 for(const suffix of ['\0',' \0ignored','/*ok*/\0ignored']){
  const out=await jsonAggregateBlob(new TextEncoder().encode('[1]'+suffix),control);
  try{assert.equal(Buffer.from(out.blobValue()).toString('hex'),'2b1331')}finally{out.release()}
  assert.equal(live,0);
 }
 for(const text of ['["a\0b"]','[1\0]','[1]garbage']){
  await assert.rejects(jsonAggregateBlob(new TextEncoder().encode(text),control),/malformed JSON/);assert.equal(live,0);
 }
});

test('direct completed-text JSONB production cancels and refunds its arena',async()=>{
 let live=0,peak=0,probes=0;const sentinel=new Error('parse stopped');
 const control={reserve:n=>{live+=n;peak=Math.max(peak,live)},release:n=>{live-=n},charge:()=>{},check:()=>{},checkpoint:async()=>{if(++probes===2)throw sentinel}};
 const bytes=new TextEncoder().encode('["'+'a'.repeat(2000)+'"]');
 await assert.rejects(jsonAggregateBlob(bytes,control),e=>e===sentinel);assert.equal(live,0);assert.equal(peak,0); // cancellation before native-position opening header
 probes=0;control.checkpoint=async()=>{probes++};
 await assert.rejects(jsonAggregateBlob(new TextEncoder().encode('[bad'),control),/malformed JSON/);assert.equal(live,0);
 const out=await jsonAggregateBlob(bytes,control);try{assert.ok(out.blobValue().length>2000);assert.ok(probes>8)}finally{out.release()}
 assert.equal(live,0);
 probes=0;control.checkpoint=async()=>{if(++probes===12)throw sentinel};
 await assert.rejects(jsonAggregateBlob(bytes,control),e=>e===sentinel);assert.equal(live,0);assert.ok(peak>0); // interrupted source scan with installed header
 probes=0;control.checkpoint=async()=>{probes++};
 const reserve=control.reserve;control.reserve=n=>{if(n>32)throw sentinel;reserve(n)};
 await assert.rejects(jsonAggregateBlob(bytes,control),e=>e===sentinel);assert.equal(live,0); // replacement reservation failure refunds installed arena
});

test('JSONB arena header growth preserves overlapping payloads at size classes',async()=>{
 for(const length of [9,10,11,12,252,253,254,255,256,65531,65532,65533,65535,65536]){
  let live=0;const control={reserve:n=>{live+=n},release:n=>{live-=n},charge:()=>{},check:()=>{},checkpoint:async()=>{}};
  const out=await jsonAggregateBlob(new TextEncoder().encode('["'+'x'.repeat(length)+'"]'),control);
  const header=(type,size)=>{const h=size<=11?1:size<=255?2:size<=65535?3:5,b=new Uint8Array(h);b[0]=(h===1?size:h===2?12:h===3?13:14)*16+type;for(let i=1;i<h;i++)b[i]=Math.floor(size/256**(h-i-1))&255;return b};
  try{const child=header(7,length),outer=header(11,child.length+length),expected=new Uint8Array(outer.length+child.length+length);expected.set(outer);expected.set(child,outer.length);expected.fill(120,outer.length+child.length);assert.deepEqual(out.blobValue(),expected,`length ${length}`)}finally{out.release()}
  assert.equal(live,0);
 }
});

test('direct JSONB producer preserves source lexemes and rejects incomplete productions',async()=>{
 const control={reserve:()=>{},release:()=>{},checkpoint:async()=>{}};
 for(const [text,hex] of [['[1.]','3B26312E'],['[+1]','2B1331'],['[0x10]','5B4430783130'],['["a\\\\n"]','5B48615C5C6E'],['[NaN,Inf]','7B00553965393939']]){
  const out=await jsonAggregateBlob(new TextEncoder().encode(text),control);try{assert.equal(Buffer.from(out.blobValue()).toString('hex').toUpperCase(),hex,text)}finally{out.release()}
 }
 for(const text of ['[01]','[1e]','[1,,2]','{"a" 1}',String.raw`["\q"]`,'[','[trueX]'])await assert.rejects(jsonAggregateBlob(new TextEncoder().encode(text),control),/malformed JSON/,text);
});

test('unterminated comment does not bypass preceding label production admission',async()=>{
 let live=0;const sentinel=new Error('label replacement admission');
 const control={reserve:n=>{if(n>32)throw sentinel;live+=n},release:n=>{live-=n},checkpoint:async()=>{}};
 // json5Whitespace returns the consumed prefix, leaving an unterminated
 // comment unconsumed. Identifier production must still reach AppendNode.
 const text='{'+ 'a'.repeat(100)+'\u2000/*unfinished';
 await assert.rejects(jsonAggregateBlob(new TextEncoder().encode(text),control),e=>e===sentinel);
 assert.equal(live,0);
 control.reserve=n=>{live+=n};
 await assert.rejects(jsonAggregateBlob(new TextEncoder().encode(text),control),/malformed JSON/);
 assert.equal(live,0);
});

test('direct producer label fallback and separator protocol match pinned jsonb conversion',async()=>{
 let live=0;const control={reserve:n=>{live+=n},release:n=>{live-=n},checkpoint:async()=>{}};
 for(const [text,expected] of [['{trueX:1}','8C5774727565581331'],['{nullish:2}','AC776E756C6C6973681332'],['{InfinityX:3}','CC0C97496E66696E697479581333'],[String.raw`{\u0061:4}`,'9C685C75303036311334'],['{x /*c*/ : 1, y:2,}','8C1778133117791332'],['[1 /*c*/,2,]','4B13311332']]){
  const out=await jsonAggregateBlob(new TextEncoder().encode(text),control);try{assert.equal(Buffer.from(out.blobValue()).toString('hex').toUpperCase(),expected,text)}finally{out.release()}assert.equal(live,0);
 }
 for(const text of ['{true:1}','{[1]:2}','{x 2:3}']){await assert.rejects(jsonAggregateBlob(new TextEncoder().encode(text),control),/malformed JSON/);assert.equal(live,0)}
 const sentinel=new Error('label admission');const reserve=control.reserve;
 control.reserve=n=>{if(n>32)throw sentinel;reserve(n)};
 // Native tries the label value first: a long array-label child allocates
 // before the eventual non-TEXT rejection. Do not short-circuit to syntax.
 await assert.rejects(jsonAggregateBlob(new TextEncoder().encode('{["'+'a'.repeat(2000)+'"]:1}'),control),e=>e===sentinel);assert.equal(live,0);
 control.reserve=()=>{throw sentinel};
 await assert.rejects(jsonAggregateBlob(new TextEncoder().encode('{abc:1}'),control),e=>e===sentinel);assert.equal(live,0);
});

test('direct numeric state matches pinned exact payloads and malformed transitions',async()=>{
 let live=0;const control={reserve:n=>{live+=n},release:n=>{live-=n},checkpoint:async()=>{}};
 // Independent pinned conversion capture: card-r-c/jsonb-number-state/native.json.
 const good=[['0','2B1330'],['-0','3B232D30'],['+0','2B1330'],['0x10','5B4430783130'],['-0Xff','6B542D30586666'],['+0x10','5B4430783130'],['.5','3B262E35'],['-.5','4B362D2E35'],['+.5','3B262E35'],['1.','3B26312E'],['1.e2','5B46312E6532'],['1.e-2','6B56312E652D32'],['1e+2','5B4531652B32'],['-Inf','7B652D3965393939'],['+Infinity','6B553965393939'],['1.e+2','6B56312E652B32']];
 for(const [token,hex] of good){const out=await jsonAggregateBlob(new TextEncoder().encode('['+token+']'),control);try{assert.equal(Buffer.from(out.blobValue()).toString('hex').toUpperCase(),hex,token)}finally{out.release()}assert.equal(live,0)}
 for(const token of ['1e2.3','1..2','01','-01','1e','1e+','1e2e3','.','+.','+NaN','0x','-0x','00.1','1.e']){await assert.rejects(jsonAggregateBlob(new TextEncoder().encode('['+token+']'),control),/malformed JSON/,token);assert.equal(live,0)}
 // Invalid second exponent/dot is rejected before payload allocation; project
 // admission errors must not mask the source-owned lexical error.
 control.reserve=n=>{if(n>32)throw new Error('unexpected numeric payload allocation');live+=n};
 await assert.rejects(jsonAggregateBlob(new TextEncoder().encode('[1e'+'2'.repeat(2000)+'.3]'),control),/malformed JSON/);assert.equal(live,0);
});

test('direct comment scan stops at JSON5 Unicode line terminators',async()=>{
 let live=0;const control={reserve:n=>{live+=n},release:n=>{live-=n},checkpoint:async()=>{}};
 // Independently captured pinned jsonb() controls: jsonb-comment-state/native.json.
 for(const sep of ['\u2028','\u2029','\n','\r']){
  for(const [text,hex] of [['[1,//comment'+sep+'2]','4B13311332'],['{a:1,//comment'+sep+'b:2}','8C1761133117621332']]){
   const out=await jsonAggregateBlob(new TextEncoder().encode(text),control);
   try{assert.equal(Buffer.from(out.blobValue()).toString('hex').toUpperCase(),hex)}finally{out.release()}
   assert.equal(live,0);
  }
 }
 for(const text of ['[1,//comment\u20002]','{a:1,//comment\u2000b:2}']){await assert.rejects(jsonAggregateBlob(new TextEncoder().encode(text),control),/malformed JSON/);assert.equal(live,0)}
});

test('public TEXT and subtype argument coercion survive reset across encodings',async()=>{
 const fixtures=new Map(['UTF-8','UTF-16le','UTF-16be'].map(enc=>[enc,fs.readFileSync(new URL(`../fixtures/wr-case5-mixed-${enc}.db`,import.meta.url))]));
 const server=http.createServer((req,res)=>{const bytes=fixtures.get(req.url.slice(1));if(!bytes){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const enc of ['UTF-8','UTF-16le','UTF-16be']){
  const db=await open(new Request(`http://127.0.0.1:${server.address().port}/${enc}`));
  try{const s=db.prepare(`SELECT json_group_array(?1),json_group_array(json_array(?1)),hex(jsonb_group_array(json_array(?1)))`).statement;
   try{s.bind(1,'é😀');for(let pass=0;pass<2;pass++){
    assert.equal(await s.step(),'row');assert.equal(s.column(0),'["é😀"]');assert.equal(s.column(1),'[["é😀"]]');
    assert.equal(typeof s.column(2),'string');assert.equal(await s.step(),'done');s.reset();
   }}finally{s.finalize()}
  }finally{db.closeDeferred()}
 }}finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});

const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);
async function withDb(run,options={limits:{maxResultBytes:8}}){
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{
  db=await open(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`),options);
  await run(db);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
}
// Independently captured SQLite3.53.4 aggregate bytes, not scalar constructor
// equivalence. Source identity and retained capture: card-r-c status.
test('public aggregate completed-text JSONB bytes match pinned oracle',()=>withDb(async db=>{
 for(const row of oracle){
  const s=db.prepare(`SELECT hex(jsonb_group_array(${row.expression})),hex(jsonb_group_object(${row.expression},${row.expression}))`).statement;
  try{for(let repeat=0;repeat<2;repeat++){assert.equal(await s.step(),'row');assert.deepEqual([s.column(0),s.column(1)],[row.array,row.object],row.expression);assert.equal(await s.step(),'done');s.reset()}}
  finally{s.finalize()}
 }
},{limits:{maxResultBytes:100000}}));

async function expectSavedLimit(statement){
 let saved;
 await assert.rejects(statement.step(),e=>{saved=e;return e.kind==='limit'&&e.message==='string or blob too big'});
 assert.throws(()=>statement.reset(),e=>e===saved);
}

// Source-derived *project logical-byte admission* controls, not native cap8
// oracle parity. SQLite clamps SQLITE_LIMIT_LENGTH to >=30 and JsonString
// also has allocator capacity/slack. The browser's smaller logical cap is an
// existing project policy. Within that policy, Step must account for the
// actual retained JsonString prefix, punctuation and quoted-label expansion
// before admitting the next SQL value, rather than only measuring nodes.
// json.c:jsonArrayStep appends ',' before jsonAppendSqlValue; jsonObjectStep
// appends quoted label and ':' before jsonAppendSqlValue.
for(const name of ['json_group_array','jsonb_group_array'])
test(`${name}: comma admission precedes next BLOB conversion`,()=>withDb(async db=>{
 const s=db.prepare(`SELECT ${name}(CASE x WHEN 0 THEN 1234567 ELSE x'ff' END ORDER BY x) FROM t1 WHERE x<2`).statement;
 try{await expectSavedLimit(s)}finally{s.finalize()}
}));
for(const name of ['json_group_object','jsonb_group_object'])
test(`${name}: quoted-label expansion admission precedes BLOB conversion`,()=>withDb(async db=>{
 const s=db.prepare(`SELECT ${name}(?1,CASE x WHEN 0 THEN 1 ELSE x'ff' END ORDER BY x) FROM t1 WHERE x<2`).statement;
 s.bind(1,'""""'); // Four raw bytes expand to ten quoted bytes.
 try{await expectSavedLimit(s)}finally{s.finalize()}
}));

for(const name of ['json_group_array','jsonb_group_array'])
test(`${name}: Step prefix fits but Compute closing delimiter exceeds cap`,()=>withDb(async db=>{
 const s=db.prepare(`SELECT ${name}(1234567) FROM t1 WHERE x=0`).statement;
 try{await expectSavedLimit(s)}finally{s.finalize()}
}));

// jsonGroupInverse scans nesting and escapes; xValue must leave @ rows in
// the original buffer so inverse removes a SQL row, not a compacted member.
test('scan-remove preserves nested strings and NULL placeholder positions',()=>withDb(async db=>{
 const s=db.prepare(`SELECT x,json_group_array(json_array('a,b',json_object('@','x"y'))) OVER (ORDER BY x ROWS 1 PRECEDING),json_group_object(CASE WHEN x IN (0,2) THEN NULL ELSE '@' END,json_array('a,b')) OVER (ORDER BY x ROWS 1 PRECEDING) FROM t1 WHERE x<4 ORDER BY x`).statement;
 const value='["a,b",{"@":"x\\"y"}]',expected=[
  [0n,`[${value}]`,'{}'],
  [1n,`[${value},${value}]`,'{"@":["a,b"]}'],
  [2n,`[${value},${value}]`,'{"@":["a,b"]}'],
  [3n,`[${value},${value}]`,'{"@":["a,b"]}']
 ];
 const snapshots=[];
 try{
  for(let pass=0;pass<2;pass++){
   for(const row of expected){assert.equal(await s.step(),'row');const got=[s.column(0),s.column(1),s.column(2)];assert.deepEqual(got,row);snapshots.push(got)}
   assert.equal(await s.step(),'done');s.reset();
  }
 }finally{s.finalize()}
 assert.deepEqual(snapshots,[...expected,...expected]);
},{limits:{maxResultBytes:10000}}));

// Own the global observation through prepare and finalize, including saved-error
// finalize. Cleanup must not replace a primary prepare/assertion failure.
async function withReserveObservedStatement(db,sql,events,owners,run){
 const reserve=PrivateStateByteBudget.prototype.reserve;
 let statement,primaryFailed=false;
 PrivateStateByteBudget.prototype.reserve=function(bytes,message){
  owners.add(this);
  const before=this.snapshot();
  try{const result=reserve.call(this,bytes,message);events.push({bytes,message,before,accepted:true});return result}
  catch(error){events.push({bytes,message,before,accepted:false});throw error}
 };
 try{
  statement=db.prepare(sql).statement;
  return await run(statement);
 }catch(error){primaryFailed=true;throw error}
 finally{
  try{statement?.finalize()}
  catch(error){if(!primaryFailed)throw error}
  finally{PrivateStateByteBudget.prototype.reserve=reserve}
 }
}

test('reserve observation restores after prepare/assertion/saved-finalize failures',()=>withDb(async db=>{
 const original=PrivateStateByteBudget.prototype.reserve;
 for(const phase of ['prepare','assertion','assertion-with-saved-error','saved-finalize']){
  const events=[],owners=new Set();let primary,saved,finalizedStatement;
  const preparingDb={prepare(sql){
   try{return db.prepare(sql)}catch(error){primary=error;throw error}
  }};
  await assert.rejects(withReserveObservedStatement(preparingDb,
   phase==='prepare'?'SELECT (':'SELECT json_group_array(?1)',events,owners,async s=>{
    finalizedStatement=s;
    if(phase!=='assertion'){
     s.bind(1,'x'.repeat(5000));
     await assert.rejects(s.step(),error=>{saved=error;return error.kind==='limit'});
    }
    if(phase!=='saved-finalize'){
     try{assert.fail(`primary ${phase}`)}catch(error){primary=error;throw error}
    }
   }),error=>error===(phase==='saved-finalize'?saved:primary));
  assert.equal(PrivateStateByteBudget.prototype.reserve,original,phase);
  // Saved-error finalize still transitioned to finalized before throwing.
  if(finalizedStatement)assert.throws(()=>finalizedStatement.reset(),error=>error.kind==='misuse'&&error.message==='statement is finalized');
  for(const owner of owners){const b=owner.snapshot();assert.equal(b.ownedBytes,0);assert.equal(b.chargedBytes,b.refundedBytes)}
  const priorCount=events.length,laterEvents=[];
  await withReserveObservedStatement(db,'SELECT json_group_array(?1)',laterEvents,new Set(),async s=>{
   s.bind(1,'ok');assert.equal(await s.step(),'row');assert.equal(s.column(0),'["ok"]');
   assert.equal(await s.step(),'done');s.reset();
  });
  assert.ok(laterEvents.length>0,'later observer receives real reservations');
  assert.equal(events.length,priorCount,'failed observer cannot receive later reservations');
  assert.equal(PrivateStateByteBudget.prototype.reserve,original);
 }
},{limits:{maxResultBytes:20000,maxPrivateBytes:1024}}));

// Native Step owns JsonString growth only after OP_Variable admits typed Mem.
// Observe the real shared budget, without bypassing admission or raising caps.
// Prototype observation is scoped to this serial test and restored in finally.
for(const name of ['json_group_array','jsonb_group_array','json_group_object','jsonb_group_object'])
test(`${name}: growth reservation failure refunds on reset/rebind`,()=>withDb(async db=>{
 const object=name.endsWith('object'),events=[],owners=new Set();
 const aggregateEvents=()=>events.filter(e=>e.message==='aggregate state exceeds total byte limit');
 const refunded=()=>{for(const owner of owners){const b=owner.snapshot();assert.equal(b.ownedBytes,0);assert.equal(b.chargedBytes,b.refundedBytes);assert.equal(b.memBytes,0)}};
 await withReserveObservedStatement(db,`SELECT ${name}(${object?"'k',":''}?1) FROM t1 WHERE x<?2`,events,owners,async s=>{
  // Retain the original witness: it fails before Step, not at JsonString.
  s.bind(1,'x'.repeat(5000));s.bind(2,4);let saved;
  await assert.rejects(s.step(),e=>{saved=e;return e.kind==='limit'&&e.message==='private state exceeds total byte limit'});
  assert.equal(aggregateEvents().length,0,'oversized variable must not reach aggregate growth');
  assert.throws(()=>s.reset(),e=>e===saved);refunded();events.length=0;

  // A small admitted argument, repeated by Step, separates typed Mem from
  // retained capacity plus replacement overlap. One row fits; four do not.
  s.bind(1,'x'.repeat(160));s.bind(2,1);
  assert.equal(await s.step(),'row');
  if(!name.startsWith('jsonb'))assert.equal(s.column(0),object?'{"k":"'+ 'x'.repeat(160)+'"}':'["'+'x'.repeat(160)+'"]');
  else assert.ok(s.column(0) instanceof Uint8Array);
  assert.equal(await s.step(),'done');s.reset();refunded();events.length=0;
  s.bind(2,4);
  await assert.rejects(s.step(),e=>{saved=e;return e.kind==='limit'&&e.message.includes('aggregate state')});
  const growth=aggregateEvents(),failed=growth.find(e=>!e.accepted);
  assert.ok(growth.some(e=>e.accepted),'Step admitted retained allocation before failure');
  assert.ok(failed,'failure belongs to aggregate growth, not argument/quote/result');
  assert.ok(failed.before.memBytes>0,'typed Mem remains charged during growth');
  assert.ok(failed.before.ownedBytes+failed.bytes>1024,'replacement overlaps live owners');
  for(const e of events){
   assert.equal(e.before.chargedBytes-e.before.refundedBytes,e.before.ownedBytes,'exact cumulative owned-byte ledger');
   if(e.accepted)assert.ok(e.before.ownedBytes+e.bytes<=1024,'accepted allocation is below/at cap');
  }
  assert.ok(growth.filter(e=>e.accepted).every(e=>e.bytes>0),'real retained growth was charged');
  assert.throws(()=>s.reset(),e=>e===saved);refunded();
  s.bind(1,'ok');s.bind(2,1);assert.equal(await s.step(),'row');
  const got=s.column(0);
  if(name.startsWith('jsonb'))assert.ok(got instanceof Uint8Array);
  else assert.equal(got,object?'{"k":"ok"}':'["ok"]');
  assert.equal(await s.step(),'done');s.reset();refunded();
 });
},{limits:{maxResultBytes:20000,maxPrivateBytes:1024}}));

// Compute closes before object placeholder compaction; xValue must copy the
// original byte extent, compact only its copy, and leave later inverse intact.
for(const prefix of ['json','jsonb'])
test(`${prefix}: multi-chunk temporary compaction keeps retained values independent`,()=>withDb(async db=>{
 const value='a,@\\"'.repeat(2000);
 const s=db.prepare(`SELECT ${prefix}_group_object(CASE WHEN x=0 THEN NULL ELSE '@' END,?1) OVER (ORDER BY x ROWS 1 PRECEDING) FROM t1 WHERE x<4 ORDER BY x`).statement;
 s.bind(1,value);
 const canonical=db.prepare(`SELECT ${prefix}_object('@',?1),${prefix}_object('@',?1,'@',?1)`).statement;
 let one,two;
 try{canonical.bind(1,value);assert.equal(await canonical.step(),'row');one=canonical.column(0);two=canonical.column(1)}finally{canonical.finalize()}
 const empty=prefix==='json'?'{}':new Uint8Array([12]);
 const expected=[empty,one,two,two],retained=[];
 // Completed-text aggregate conversion may retain escape spellings while
 // scalar jsonb_object encodes raw SQL strings. Compare decoded JSON here;
 // exact aggregate JSONB bytes require an independent aggregate oracle.
 const normalize=async output=>{
  if(prefix==='json')return output;
  const decode=db.prepare('SELECT json(?1)').statement;
  try{decode.bind(1,output);assert.equal(await decode.step(),'row');return decode.column(0)}finally{decode.finalize()}
 };
 const normalized=[];for(const output of expected)normalized.push(await normalize(output));
 try{
  for(let pass=0;pass<2;pass++){
   for(const result of normalized){assert.equal(await s.step(),'row');const output=s.column(0);assert.deepEqual(await normalize(output),result);retained.push(output)}
   assert.equal(await s.step(),'done');s.reset();
  }
 }finally{s.finalize()}
 for(let i=0;i<retained.length;i++)assert.deepEqual(await normalize(retained[i]),normalized[i%4]);
},{limits:{maxResultBytes:4000000,maxPrivateBytes:16000000}}));

// Large first member forces inverse's serialized scan and overlapping move.
// Cancellation must unwind the async callback through ordinary VM halt/reset.
// This is affected-path evidence, not isolation from argument-copy checkpoints.
test('large sliding inverse cancellation refunds retained capacity',()=>withDb(async db=>{
 const s=db.prepare(`SELECT json_group_array(?1) OVER (ORDER BY x ROWS 1 PRECEDING) FROM t1 WHERE x<4 ORDER BY x`).statement;
 s.bind(1,'a,b\\"'.repeat(40000));
 try{
  assert.equal(await s.step(),'row');assert.equal(await s.step(),'row');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),0);
  let saved;
  try{await assert.rejects(s.step({signal:controller.signal}),e=>{saved=e;return e.kind==='cancelled'})}finally{clearTimeout(timer)}
  assert.throws(()=>s.reset(),e=>e===saved);
  s.bind(1,'small');assert.equal(await s.step(),'row');assert.equal(s.column(0),'["small"]');
 }finally{s.finalize()}
},{limits:{maxResultBytes:4000000,maxPrivateBytes:16000000}}));


// json.c:jsonReturnStringAsBlob calls the translator directly, unlike
// jsonConvertTextToBlob. Native subtype injection receipt: status v215.
test('aggregate JSONB publication does not apply strict completion validation',async()=>{
 let held=0;const control={reserve:n=>held+=n,release:n=>held-=n,checkpoint:async()=>{}};
 for(const input of ['[1]','[1]junk]','[1] /*unfinished']){
  const out=await aggregateResultBlob(new TextEncoder().encode(input),control);
  try{assert.equal(Buffer.from(out.blobValue()).toString('hex'),'2b1331')}finally{out.release()}
  assert.equal(held,0);
 }
 await assert.rejects(jsonAggregateBlob(new TextEncoder().encode('[1]junk]'),control),/malformed JSON/);
 assert.equal(held,0);
 const stop=new Error('aggregate conversion cancelled');
 await assert.rejects(aggregateResultBlob(new TextEncoder().encode('[1]junk]'),{...control,checkpoint:async()=>{throw stop}}),e=>e===stop);
 assert.equal(held,0);
});
