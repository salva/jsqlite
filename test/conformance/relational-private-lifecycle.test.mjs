import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {EphemeralIndexCursor,SorterCursor} from '../../src/internal/private-state.ts';
import {JSQLiteError} from '../../src/index.ts';

async function openRelational(bridge){return openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`))}

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

test('DISTINCT membership work yields so a live abort can be observed',async()=>{
 const originalFound=EphemeralIndexCursor.prototype.found;
 EphemeralIndexCursor.prototype.found=async function(_key,control){
  // Model one long linear membership probe without depending on fixture size.
  for(let i=0;i<300;i++)await control.checkpoint();
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
