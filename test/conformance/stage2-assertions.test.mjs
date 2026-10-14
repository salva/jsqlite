import test from 'node:test';
import assert from 'node:assert/strict';
import {assertOperation} from './stage2-assertions.mjs';
test('Stage2 assertions cannot pass wrong phase, row count, tail or metadata',()=>{
 const op={op:'step',key:'emptyStep',assertion:{phase:'step',result:'done',rowCount:0}};
 assertOperation(op,{phase:'step',result:'done',rowCount:0});
 assert.throws(()=>assertOperation(op,{phase:'prepare',result:'done',rowCount:0}));
 assert.throws(()=>assertOperation({...op,assertion:{...op.assertion,phase:'prepare'}},{phase:'step',result:'done',rowCount:0}));
 assert.throws(()=>assertOperation(op,{phase:'step',result:'done',rowCount:1}));
 const p={op:'prepare',key:'prepare',assertion:{phase:'prepare',tail:'SELECT 10',columnCount:1,metadata:{name:'name',declaredType:'TEXT',database:'main',table:'sqlite_master',origin:'name'}}};
 assertOperation(p,{...p.assertion});
 for(const mutation of [{tail:''},{columnCount:0},{metadata:{...p.assertion.metadata,origin:'wrong'}}]) assert.throws(()=>assertOperation(p,{...p.assertion,...mutation}));
});

import {checkPrepareAssertion,checkStepAssertion} from './stage2-assertions.mjs';
test('existing prepare assertions observe tail and full metadata without fabricating credit',()=>{
 const metadata={name:'name',declaredType:'TEXT',database:'main',table:'sqlite_master',origin:'name'};
 const a={phase:'prepare',tail:'SELECT 10',columnCount:1,metadata};
 const s={columnCount:1,columnMetadata:()=>metadata};
 assert.equal(checkPrepareAssertion(a,{tail:'SELECT 10'},s),1);
 assert.throws(()=>checkPrepareAssertion(a,{tail:''},s));
 assert.throws(()=>checkPrepareAssertion(a,{tail:'SELECT 10'},{...s,columnCount:2}));
 assert.throws(()=>checkPrepareAssertion(a,{tail:'SELECT 10'},{...s,columnMetadata:()=>({...metadata,origin:null})}));
});
test('empty-step assertion rejects rows, wrong phase and nonexistent row count',()=>{
 const a={phase:'step',result:'done',rowCount:0};
 assert.equal(checkStepAssertion(a,'done'),1);
 assert.throws(()=>checkStepAssertion(a,'row'));
 assert.throws(()=>checkStepAssertion({...a,rowCount:1},'done'));
 assert.throws(()=>checkStepAssertion({...a,phase:'prepare'},'done'));
 assert.equal(checkStepAssertion(undefined,'row'),0);
});
