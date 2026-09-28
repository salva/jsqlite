import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {open} from '../../src/index.ts';

async function openBytes(file){const bytes=fs.readFileSync(file),prior=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);try{return await open(`https://fixture.invalid/${path.basename(file)}`)}finally{globalThis.fetch=prior}}
async function rows(statement){const result=[];while(await statement.step()==='row')result.push(Array.from({length:statement.columnCount},(_,i)=>[statement.columnType(i),statement.column(i)]));return result}

for(const [encoding,file] of [['UTF-8','utf8.db'],['UTF-16le','utf16le.db'],['UTF-16be','utf16be.db']])test(`declared REAL direct columns execute OP_RealAffinity (${encoding})`,async()=>{
 const db=await openBytes(path.resolve('test/fixtures/real-affinity',file));
 const orders=db.prepare('SELECT amount,id FROM orders').statement;
 assert.deepEqual(orders.columnMetadata(0),{name:'amount',declaredType:'REAL',database:'main',table:'orders',origin:'amount'});
 assert.deepEqual(await rows(orders),[[['real',20],['integer',10n]],[['real',10],['integer',11n]],[['real',35.5],['integer',12n]],[['null',null],['integer',13n]]]);
 assert.throws(()=>orders.column(0),e=>e?.kind==='misuse');orders.reset();assert.equal(await orders.step(),'row');assert.equal(orders.columnType(0),'real');assert.equal(orders.column(0),20);assert.equal(orders.columnType(0),'real');assert.equal(orders.columnReal(0),20);assert.equal(orders.columnType(0),'real');assert.equal(orders.columnInteger(0),20n);assert.equal(orders.columnType(0),'real');assert.equal(orders.columnText(0),'20.0');assert.equal(orders.columnType(0),'real');assert.equal(orders.columnType(1),'integer');assert.equal(orders.columnReal(1),10);assert.equal(orders.columnType(1),'integer');assert.equal(orders.columnText(1),'10');assert.equal(orders.columnType(1),'integer');orders.finalize();
 const consumers=db.prepare('SELECT typeof(amount),amount+0 FROM orders WHERE id=10').statement;assert.equal(await consumers.step(),'row');assert.equal(consumers.columnType(0),'text');assert.equal(consumers.column(0),'real');assert.equal(consumers.columnType(0),'text');assert.equal(consumers.columnType(1),'real');assert.equal(consumers.column(1),20);assert.equal(consumers.columnType(1),'real');assert.equal(await consumers.step(),'done');consumers.reset();assert.equal(await consumers.step(),'row');assert.deepEqual([consumers.columnType(0),consumers.column(0),consumers.columnType(1),consumers.column(1)],['text','real','real',20]);consumers.finalize();
 const aggregates=db.prepare('SELECT sum(amount),total(amount),avg(amount) FROM orders WHERE id=11').statement;
 assert.equal(await aggregates.step(),'row');assert.deepEqual(Array.from({length:3},(_,i)=>[aggregates.columnType(i),aggregates.column(i)]),[['real',10],['real',10],['real',10]]);assert.deepEqual(Array.from({length:3},(_,i)=>aggregates.columnType(i)),['real','real','real']);aggregates.finalize();
 const neighbors=db.prepare('SELECT r,n,i FROM neighbors').statement;
 assert.deepEqual(await rows(neighbors),[
  [['real',20],['integer',20n],['integer',20n]],
  [['real',9223372036854776000],['integer',9223372036854775807n],['integer',9223372036854775807n]],
  [['real',-9223372036854776000],['integer',-9223372036854775808n],['integer',-9223372036854775808n]],
  [['real',35.5],['real',35.5],['real',35.5]],
  [['null',null],['null',null],['null',null]],
 ]);neighbors.finalize();
 const decoder=db.prepare("SELECT CAST(9223372036854775807+1 AS TEXT),CAST(1e308*10 AS TEXT),CAST(1e-320 AS TEXT),printf('%!.17g',1e-320),format('%!.20g',1e-320),quote(1e308*10),9223372036854775807+1,1e-320").statement;
 assert.equal(await decoder.step(),'row');
 assert.deepEqual(Array.from({length:6},(_,i)=>[decoder.columnType(i),decoder.column(i)]),[
  ['text','9.2233720368547758e+18'],['text','Inf'],['text','9.9998886718268301e-321'],
  ['text','9.9998886718268301e-321'],['text','9.99988867182683005e-321'],['text','9.0e+999'],
 ]);
 assert.equal(decoder.columnType(6),'real');assert.equal(decoder.column(6),9223372036854776000);assert.equal(decoder.columnText(6),'9.2233720368547758e+18');assert.equal(decoder.columnType(6),'real');assert.equal(decoder.column(6),9223372036854776000);
 assert.equal(decoder.columnType(7),'real');assert.equal(decoder.column(7),1e-320);assert.equal(decoder.columnText(7),'9.9998886718268301e-321');assert.equal(decoder.columnType(7),'real');assert.equal(decoder.column(7),1e-320);
 assert.equal(await decoder.step(),'done');decoder.finalize();
 const later=db.prepare('SELECT 1').statement;assert.equal(await later.step(),'row');later.finalize();db.close();
});
