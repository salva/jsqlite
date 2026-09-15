import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {open} from '../../src/index.ts';
import {EphemeralIndexCursor,SorterCursor} from '../../src/internal/private-state.ts';
import {JSQLiteError} from '../../src/index.ts';

async function openRelational(bridge){return openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`))}

test('ORDER BY resolves direct result aliases and ordinals before table names',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 const run=async sql=>{statement=db.prepare(sql).statement;const rows=[];while(await statement.step()==='row')rows.push(statement.columnInteger(0));statement.finalize();statement=undefined;return rows};
 try{
  db=await openRelational(bridge);
  assert.deepEqual(await run('SELECT x AS z FROM t1 ORDER BY z LIMIT 2'),[0n,1n]);
  assert.deepEqual(await run('SELECT x FROM t1 ORDER BY 1 DESC LIMIT 2'),[31n,30n]);
  assert.throws(()=>db.prepare('SELECT x FROM t1 ORDER BY 2'),error=>error instanceof JSQLiteError&&error.kind==='sqlite'&&error.message==='1st ORDER BY term out of range - should be between 1 and 1');
 } finally {
  try{statement?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

test('public LIMIT zero bypasses multi-key sorter admission under a small work budget',async()=>{
 const originalInsert=SorterCursor.prototype.insert;let inserts=0;
 SorterCursor.prototype.insert=function(...args){inserts++;return originalInsert.apply(this,args)};
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 try{
  db=await openRelational(bridge);
  statement=db.prepare('SELECT x,y FROM t1 ORDER BY y,x LIMIT 0').statement;
  assert.equal(await statement.step({maxWorkUnits:8}),'done');
  assert.equal(inserts,0,'computeLimitRegisters zero branch must bypass sorter population');
 } finally {
  SorterCursor.prototype.insert=originalInsert;
  try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

async function openRelationalWithLimits(bridge,limits){return open(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`),{limits})}

test('public multi-key sorter enforces entry and byte bounds atomically',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 const expectLimit=async(limits,message)=>{
  db=await openRelationalWithLimits(bridge,limits);statement=db.prepare('SELECT x,y FROM t1 ORDER BY y,x').statement;
  await assert.rejects(statement.step(),error=>error instanceof JSQLiteError&&error.kind==='limit'&&error.message===message);
  try{statement.finalize()}catch(error){assert.equal(error.message,message)}statement=undefined;db.close();db=undefined;
 };
 try{
  await expectLimit({maxRows:1},'sorter exceeds entry limit');
  await expectLimit({maxResultBytes:20},'sorter exceeds total byte limit');
  db=await openRelationalWithLimits(bridge,{maxRows:32,maxResultBytes:2048});statement=db.prepare('SELECT x,y FROM t1 ORDER BY y,x').statement;
  assert.equal(await statement.step(),'row','failed bounded attempts must not poison later admission');
 } finally {
  try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

test('public relational work budgets stop at exact real sorter and ephemeral boundaries',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 const first=async(sql,maxWorkUnits)=>{statement=db.prepare(sql).statement;try{return await statement.step({maxWorkUnits})}finally{try{statement.finalize()}catch{}statement=undefined}};
 try{
  db=await openRelational(bridge);
  await assert.rejects(first('SELECT x FROM t1 ORDER BY x',981),error=>error instanceof JSQLiteError&&error.kind==='limit'&&error.message==='statement exceeds maxWorkUnits');
  assert.equal(await first('SELECT x FROM t1 ORDER BY x',982),'row');
  await assert.rejects(first('SELECT DISTINCT a FROM t2',17),error=>error instanceof JSQLiteError&&error.kind==='limit'&&error.message==='statement exceeds maxWorkUnits');
  assert.equal(await first('SELECT DISTINCT a FROM t2',18),'row');
 } finally {
  try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

test('relational failure cleanup preserves first error and reset reuses the statement',async()=>{
 const originalInsert=SorterCursor.prototype.insert,originalClose=SorterCursor.prototype.close;
 const firstError=new RangeError('injected sorter insertion failure');
 let inserts=0,closes=0,inject=true;
 SorterCursor.prototype.insert=function(...args){
  inserts++;
  if(inject&&inserts===2)throw firstError;
  return originalInsert.apply(this,args);
 };
 SorterCursor.prototype.close=function(){closes++;return originalClose.call(this)};
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));
 let db,statement;
 try{
  db=await openRelational(bridge);
  statement=db.prepare('SELECT x FROM t1 ORDER BY x').statement;
  await assert.rejects(statement.step(),error=>error===firstError);
  assert.equal(closes,1,'failure closes the partially populated sorter exactly once');
  assert.throws(()=>statement.reset(),error=>error===firstError);
  assert.equal(closes,1,'reset does not re-close private state cleaned by failure');

  inject=false;inserts=0;
  const rows=[];
  while(await statement.step()==='row')rows.push(statement.columnInteger(0));
  assert.deepEqual(rows,Array.from({length:32},(_,i)=>BigInt(i)));
  assert.equal(closes,2,'ordinary completion closes the replacement sorter once');
  statement.finalize();
  assert.equal(closes,2,'finalize does not re-close completed private state');
  assert.throws(()=>statement.finalize(),error=>error instanceof JSQLiteError&&error.kind==='misuse');
  statement=undefined;db.close();db=undefined;
 } finally {
  try{statement?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  SorterCursor.prototype.insert=originalInsert;
  SorterCursor.prototype.close=originalClose;
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

test('connection admission remains exclusive while relational Found is suspended',async()=>{
 const originalFound=EphemeralIndexCursor.prototype.found,originalSetTimeout=globalThis.setTimeout;
 EphemeralIndexCursor.prototype.found=async function(_key,control){for(let i=0;i<300;i++)await control.checkpoint(1);return false};
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement,release,reached;
 const suspended=new Promise(resolve=>{reached=resolve});
 globalThis.setTimeout=(callback,delay,...args)=>{if(delay===0&&!release){release=()=>originalSetTimeout(callback,0,...args);reached();return 0}return originalSetTimeout(callback,delay,...args)};
 try{
  db=await openRelational(bridge);statement=db.prepare('SELECT DISTINCT a FROM t2').statement;
  const pending=statement.step();await suspended;
  assert.throws(()=>db.prepare('SELECT 1'),error=>error instanceof JSQLiteError&&error.kind==='misuse');
  await assert.rejects(statement.step(),error=>error instanceof JSQLiteError&&error.kind==='misuse');
  release();assert.equal(await pending,'row');
 } finally {
  globalThis.setTimeout=originalSetTimeout;EphemeralIndexCursor.prototype.found=originalFound;
  try{release?.()}catch{}try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

test('public multi-key sorter cancellation preserves admission, cleanup, reset, and finalize',async()=>{
 const originalSort=SorterCursor.prototype.sort,originalClose=SorterCursor.prototype.close,originalSetTimeout=globalThis.setTimeout;
 let inject=true,closes=0,release,reached;
 const suspended=new Promise(resolve=>{reached=resolve});
 SorterCursor.prototype.sort=async function(control){if(inject)for(let i=0;i<300;i++)await control.checkpoint(1);return originalSort.call(this,control)};
 SorterCursor.prototype.close=function(){closes++;return originalClose.call(this)};
 globalThis.setTimeout=(callback,delay,...args)=>{if(delay===0&&!release){release=()=>originalSetTimeout(callback,0,...args);reached();return 0}return originalSetTimeout(callback,delay,...args)};
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 try{
  db=await openRelational(bridge);statement=db.prepare('SELECT x,y FROM t1 ORDER BY y,x').statement;
  const controller=new AbortController(),pending=statement.step({signal:controller.signal});await suspended;
  assert.throws(()=>db.prepare('SELECT 1'),error=>error instanceof JSQLiteError&&error.kind==='misuse','connection remains exclusively admitted while sorter is suspended');
  await assert.rejects(statement.step(),error=>error instanceof JSQLiteError&&error.kind==='misuse');
  controller.abort('during-multi-key-sort');release();
  await assert.rejects(pending,error=>error instanceof JSQLiteError&&error.kind==='cancelled'&&error.cause==='during-multi-key-sort');
  assert.equal(closes,1,'cancellation closes the populated two-key sorter once');
  assert.throws(()=>statement.reset(),error=>error instanceof JSQLiteError&&error.kind==='cancelled');
  inject=false;let rows=0;while(await statement.step()==='row')rows++;
  assert.equal(rows,32);assert.equal(closes,2,'reset execution owns and closes one replacement sorter');
  statement.finalize();assert.equal(closes,2,'finalize does not re-close completed sorter');statement=undefined;
  const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();
 } finally {
  globalThis.setTimeout=originalSetTimeout;SorterCursor.prototype.sort=originalSort;SorterCursor.prototype.close=originalClose;
  try{release?.()}catch{}try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

test('public multi-key sorter deadline preserves cleanup and later admission',async()=>{
 const originalSort=SorterCursor.prototype.sort,originalClose=SorterCursor.prototype.close,originalNow=Date.now;
 let closes=0,inSort=false;
 SorterCursor.prototype.sort=async function(control){inSort=true;await control.checkpoint(1);return originalSort.call(this,control)};
 SorterCursor.prototype.close=function(){closes++;return originalClose.call(this)};
 Date.now=()=>inSort?100:0;
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 try{
  db=await openRelational(bridge);statement=db.prepare('SELECT x,y FROM t1 ORDER BY y,x').statement;
  await assert.rejects(statement.step({timeoutMs:2}),error=>error instanceof JSQLiteError&&error.kind==='timeout'&&error.message==='statement execution timed out');
  assert.equal(closes,1,'deadline closes populated two-key sorter once');
  assert.throws(()=>statement.finalize(),error=>error instanceof JSQLiteError&&error.kind==='timeout');statement=undefined;
  Date.now=originalNow;
  const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();
 } finally {
  Date.now=originalNow;SorterCursor.prototype.sort=originalSort;SorterCursor.prototype.close=originalClose;
  try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

test('DISTINCT membership work yields so a live abort can be observed',async()=>{
 const originalFound=EphemeralIndexCursor.prototype.found;
 EphemeralIndexCursor.prototype.found=async function(_key,control){
  // Model one long linear membership probe without depending on fixture size.
  for(let i=0;i<300;i++)await control.checkpoint(1);
  return false;
 };
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));
 let db,statement,timer;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  statement=db.prepare('SELECT DISTINCT a FROM t2').statement;
  const controller=new AbortController();
  timer=setTimeout(()=>controller.abort('during-found'),0);
  await assert.rejects(
   statement.step({signal:controller.signal}),
   error=>error?.kind==='cancelled'&&error.cause==='during-found',
  );
 } finally {
  if(timer!==undefined)clearTimeout(timer);
  try{statement?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  EphemeralIndexCursor.prototype.found=originalFound;
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

async function drain(statement){while(await statement.step()==='row'){} }

test('relational private cursors close when ordinary execution reaches done',async()=>{
 const sorterClose=SorterCursor.prototype.close;
 const ephemeralClose=EphemeralIndexCursor.prototype.close;
 let sorterCloses=0,ephemeralCloses=0;
 SorterCursor.prototype.close=function(){sorterCloses++;return sorterClose.call(this)};
 EphemeralIndexCursor.prototype.close=function(){ephemeralCloses++;return ephemeralClose.call(this)};
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));
 let db,statement;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  statement=db.prepare('SELECT x FROM t1 ORDER BY x').statement;
  await drain(statement);
  const sorterClosesAtDone=sorterCloses;
  statement.finalize();statement=undefined;db.close();db=undefined;

  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  statement=db.prepare('SELECT DISTINCT a FROM t2').statement;
  await drain(statement);
  const ephemeralClosesAtDone=ephemeralCloses;
  assert.deepEqual(
   {sorterClosesAtDone,ephemeralClosesAtDone},
   {sorterClosesAtDone:1,ephemeralClosesAtDone:1},
   'each private cursor closes as part of the step that returns done',
  );
 } finally {
  try{statement?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  SorterCursor.prototype.close=sorterClose;
  EphemeralIndexCursor.prototype.close=ephemeralClose;
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

test('multi-cursor cleanup retains operation error, closes all cursors, and restores admission',async()=>{
 const sorterInsert=SorterCursor.prototype.insert,sorterClose=SorterCursor.prototype.close,ephemeralClose=EphemeralIndexCursor.prototype.close;
 const operation=new Error('operation primary'),sorterCleanup=new Error('sorter cleanup'),ephemeralCleanup=new Error('ephemeral cleanup');
 let sorterCloses=0,ephemeralCloses=0,failInsert=true,failClose=true;
 SorterCursor.prototype.insert=function(...args){if(failInsert)throw operation;return sorterInsert.apply(this,args)};
 SorterCursor.prototype.close=function(){sorterCloses++;sorterClose.call(this);if(failClose)throw sorterCleanup};
 EphemeralIndexCursor.prototype.close=function(){ephemeralCloses++;ephemeralClose.call(this);if(failClose)throw ephemeralCleanup};
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 try{
  db=await openRelational(bridge);statement=db.prepare('SELECT DISTINCT x FROM t1 ORDER BY x').statement;
  await assert.rejects(statement.step(),error=>error===operation);
  assert.deepEqual([sorterCloses,ephemeralCloses],[1,1],'best-effort halt closes both after operation failure');
  assert.throws(()=>statement.reset(),error=>error===operation,'saved operation error outranks cleanup diagnostics');
  failInsert=false;failClose=false;assert.equal(await statement.step(),'row');statement.finalize();statement=undefined;
  const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();
 } finally {
  SorterCursor.prototype.insert=sorterInsert;SorterCursor.prototype.close=sorterClose;EphemeralIndexCursor.prototype.close=ephemeralClose;
  try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});

test('cleanup-only reset/finalize errors are first, exhaustive, and finalize remains final',async()=>{
 const sorterClose=SorterCursor.prototype.close,ephemeralClose=EphemeralIndexCursor.prototype.close;
 const sorterCleanup=new Error('sorter cleanup'),ephemeralCleanup=new Error('ephemeral cleanup');let sorterCloses=0,ephemeralCloses=0,failClose=true;
 SorterCursor.prototype.close=function(){sorterCloses++;sorterClose.call(this);if(failClose)throw sorterCleanup};
 EphemeralIndexCursor.prototype.close=function(){ephemeralCloses++;ephemeralClose.call(this);if(failClose)throw ephemeralCleanup};
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,resetStatement,finalStatement;
 try{
  db=await openRelational(bridge);
  resetStatement=db.prepare('SELECT DISTINCT x FROM t1 ORDER BY x').statement;assert.equal(await resetStatement.step(),'row');
  assert.throws(()=>resetStatement.reset(),error=>error===sorterCleanup);assert.deepEqual([sorterCloses,ephemeralCloses],[1,1]);
  failClose=false;assert.equal(await resetStatement.step(),'row');resetStatement.finalize();resetStatement=undefined;
  failClose=true;finalStatement=db.prepare('SELECT DISTINCT x FROM t1 ORDER BY x').statement;assert.equal(await finalStatement.step(),'row');
  assert.throws(()=>finalStatement.finalize(),error=>error===sorterCleanup);assert.deepEqual([sorterCloses,ephemeralCloses],[3,3]);
  assert.throws(()=>finalStatement.finalize(),error=>error instanceof JSQLiteError&&error.kind==='misuse');finalStatement=undefined;
  const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();
 } finally {
  SorterCursor.prototype.close=sorterClose;EphemeralIndexCursor.prototype.close=ephemeralClose;
  try{resetStatement?.finalize()}catch{}try{finalStatement?.finalize()}catch{}try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));
 }
});
