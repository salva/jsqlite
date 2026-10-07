import test from 'node:test';
import assert from 'node:assert/strict';
import * as schema from '../../src/internal/schema.ts';
const sample=(eq,lt,dlt)=>({anEq:eq,anLt:lt,anDLt:dlt});
const run=(samples,nSampleCol,nKeyCol,rows=null)=>{
 assert.equal(typeof schema.initStat4AvgEq,'function','source initAvgEq owner absent');
 const state={samples,nSample:samples.length,nSampleCol,nRowEst0:0n,aAvgEq:Array(nSampleCol).fill(0n)};
 schema.initStat4AvgEq(state,nKeyCol,rows);return state;
};
test('initAvgEq: final unique field, duplicate prefixes, stat1 denominator and fallback',()=>{
 const s=[sample([4n,1n],[0n,0n],[0n,0n]),sample([4n,1n],[0n,1n],[0n,1n]),sample([1n,1n],[9n,9n],[5n,9n])];
 assert.deepEqual(run(s,2,1,[10n,2n]).aAvgEq,[1n,1n]);
 const r=run(s,2,1);assert.equal(r.nRowEst0,9n);assert.deepEqual(r.aAvgEq,[1n,1n]);
 assert.deepEqual(run([sample([1n],[100n],[10n])],1,1).aAvgEq,[10n]);
 assert.equal(run(s,2,1,[100n,10n]).aAvgEq[0],11n,'95 unsampled rows / 8 remaining distinct prefixes');
});
test('initAvgEq: unsigned products wrap before signed assignment, uint64 sum wraps',()=>{
 const huge=(1n<<64n)-1n;
 // 100 * (2^64-1) wraps unsigned, then nDist100 becomes -100.
 const a=run([sample([huge],[huge],[huge])],1,1);assert.equal(a.aAvgEq[0],1n);assert.equal(a.nRowEst0,huge);
 const b=run([sample([huge],[0n],[0n]),sample([2n],[10n],[1n]),sample([0n],[100n],[10n])],1,1);
 assert.equal(b.aAvgEq[0],12n,'sumEq wraps to 1, distinct denominator is 800');
});
