import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {RowSet} from '../../src/internal/rowset.ts';
import {PrivateStateByteBudget,PrivateStateLimitError} from '../../src/internal/private-state.ts';

const work=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'rowset-native');
fs.mkdirSync(work,{recursive:true});
// Only the include is replaced: all algorithms are the pinned source, not a
// hand-written oracle. Allocation slack is zero in this bounded test driver.
fs.writeFileSync(path.join(work,'pinned-rowset.c'),fs.readFileSync('reference/sqlite/sqlite-src-3530400/src/rowset.c','utf8').replace('#include "sqliteInt.h"',''));
const compile=spawnSync('cc',['-std=c99','-Wall','-Wextra','-Werror','-I',work,'test/conformance/rowset-native.c','-o',path.join(work,'driver')],{encoding:'utf8'});
assert.equal(compile.status,0,compile.stderr);
async function compare(ops){
 const native=spawnSync(path.join(work,'driver'),[],{input:ops.join('\n')+'\n',encoding:'utf8'});
 assert.equal(native.status,0,native.stderr);
 const budget=new PrivateStateByteBudget(1000000);let units=0;
 const control={async checkpoint(n=0){units+=n;}};
 let rowset=new RowSet(budget,10000,control);const actual=[];
 try{
  for(const op of ops){const [code,a,b]=op.split(' ');
   if(code==='i')await rowset.insert(BigInt(a));
   if(code==='t')actual.push(await rowset.test(Number(a),BigInt(b))?'1':'0');
   if(code==='n'){const value=await rowset.next();actual.push(value===null?'null':String(value));}
   if(code==='c'){rowset.delete();assert.equal(budget.usedBytes,0);rowset=new RowSet(budget,10000,control);}
  }
  assert.deepEqual(actual,native.stdout.trim().split('\n'));assert.ok(units>0);
 }finally{rowset.delete();assert.equal(budget.usedBytes,0);}
}
test('pinned RowSet first/middle/final visibility, duplicates, forest carries and destruction',async()=>{
 const ops=['i 9','i 2','i 9','t 0 9','t 1 9','i 4','t 1 4','t 2 4','i -2','t 2 -2','t -1 -2','c'];
 for(let batch=0;batch<12;batch++){
  for(let i=80;i>=0;i--)ops.push(`i ${BigInt(i%53)+BigInt(batch)*10n}`);
  ops.push(`t ${batch+1} ${batch*10}`,`t ${batch+1} -999`);
 }
 ops.push('t -1 9007199254740993','i 9007199254740993','t -1 9007199254740993','t 20 9007199254740993','c');
 await compare(ops);
});
test('pinned RowSet sorted/unsorted next and duplicate elimination',async()=>{
 await compare(['i 9','i 2','i 9','i -2','n','n','n','n','c','i -9223372036854775808','i 9223372036854775807','n','n','n']);
});
test('logical chunk entry/byte bounds and explicit cleanup after failure',async()=>{
 const control={async checkpoint(){}};
 for(const [bytes,entries] of [[10000,41],[64,10000]]){
  const budget=new PrivateStateByteBudget(bytes),set=new RowSet(budget,entries,control);
  await assert.rejects(set.insert(1n),PrivateStateLimitError);set.delete();assert.equal(budget.usedBytes,0);set.delete();
 }
});
test('checkpoint primary error during sort keeps allocation releasable',async()=>{
 const budget=new PrivateStateByteBudget(10000);let fail=false;const primary=new Error('cancel');
 const set=new RowSet(budget,1000,{async checkpoint(){if(fail)throw primary;}});
 await set.insert(9n);await set.insert(2n);fail=true;
 await assert.rejects(set.test(1,9n),e=>e===primary);set.delete();assert.equal(budget.usedBytes,0);
});
