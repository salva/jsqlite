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
