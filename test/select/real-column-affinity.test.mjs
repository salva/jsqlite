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
 assert.deepEqual(await rows(orders),[[['real',20],['integer',1n]],[['real',10],['integer',2n]],[['real',35.5],['integer',3n]],[['null',null],['integer',4n]]]);
 assert.throws(()=>orders.column(0),e=>e?.kind==='misuse');orders.reset();assert.equal(await orders.step(),'row');assert.equal(orders.columnType(0),'real');assert.equal(orders.column(0),20);orders.finalize();
 const neighbors=db.prepare('SELECT r,n,i FROM neighbors').statement;
 assert.deepEqual(await rows(neighbors),[
  [['real',20],['integer',20n],['integer',20n]],
  [['real',9223372036854776000],['integer',9223372036854775807n],['integer',9223372036854775807n]],
  [['real',-9223372036854776000],['integer',-9223372036854775808n],['integer',-9223372036854775808n]],
  [['real',35.5],['real',35.5],['real',35.5]],
  [['null',null],['null',null],['null',null]],
 ]);neighbors.finalize();
 const later=db.prepare('SELECT 1').statement;assert.equal(await later.step(),'row');later.finalize();db.close();
});
