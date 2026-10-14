// Pinned capi3c.test 1.1/1.4 and 2.1/2.2 prepare success/tail; invalid namex stays an error.
// Empty-fixture DONE and TEXT/main/sqlite_master/name metadata independently checked by
// card-i-c schema native/public evidence and card-w current-d593 replay. UTF16 native
// entry points remain JS-string adaptations with zero compatibility credit.
// Assertions belong to the actual operation phase; absence retains diagnostic-only lanes.
import assert from 'node:assert/strict';
export function assertOperation(op, observed) {
 if (!op.assertion) return;
 assert.equal(op.assertion.phase, op.op, 'expected phase must match attempted operation');
 assert.equal(observed.phase, op.op, 'observed phase must match attempted operation');
 for (const [key,value] of Object.entries(op.assertion)) assert.deepEqual(observed[key], value, `Stage2 ${op.key}: ${key}`);
}

// Observations for currently allocated prepare and empty-step assertions.
export function checkPrepareAssertion(a,p,s){
 if(!a)return 0;
 assertOperation({op:'prepare',key:'prepare',assertion:a},{phase:'prepare',tail:p.tail,columnCount:s.columnCount,metadata:s.columnMetadata(0)});
 return 1;
}
export function checkStepAssertion(a,result){
 if(!a)return 0;
 assertOperation({op:'step',key:'step',assertion:a},{phase:'step',result,rowCount:result==='done'?0:1});
 assert.equal(a.rowCount,0);assert.equal(result,'done');
 return 1;
}
