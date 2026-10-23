import test from 'node:test';
import assert from 'node:assert/strict';
import {capacity,interrupted,workAndLifetime} from './where-autoindex-pending-controls.mjs';
import {assertRuntimeWork,assertReleased,assertFresh} from './where-autoindex-contract.mjs';
// Contract self-test only: cannot confer runtime feature credit.
test('pending observation rejects scan and incorrect filter/covering work',()=>{
 const good={version:1,planKind:'automatic-index',executedOps:['OpenAutoindex','FilterAdd','Filter'],builds:1,insertedRecords:128,probes:63,filterAbsent:63,filterPresent:0,indexSeeks:0,collisionRejects:0,coveringTableLookups:0};
 const expected={buildRows:128,probes:63,absent:63,collisions:0};
 assertRuntimeWork(good,expected);
 for(const [k,v] of Object.entries({planKind:'table-scan',builds:63,insertedRecords:127,filterAbsent:0,indexSeeks:63,coveringTableLookups:1}))
  assert.throws(()=>assertRuntimeWork({...good,[k]:v},expected));
 assertRuntimeWork({...good,filterAbsent:0,filterPresent:63,indexSeeks:63,collisionRejects:63},{...expected,absent:0,collisions:63});
 const released={ownerId:1,chargedBytes:128,refundedBytes:128,ownedBytes:0,openCursors:0,onceActive:false,filterBytes:0};
 const survivor={ownerId:2,ownedBytes:64};
 assertReleased(released,survivor,{...survivor});
 for(const mutation of [{ownerId:0},{chargedBytes:0,refundedBytes:0},{refundedBytes:127},{ownedBytes:1},{openCursors:1},{filterBytes:1},{onceActive:true}])
  assert.throws(()=>assertReleased({...released,...mutation},survivor,survivor));
 for(const [before,after] of [[undefined,undefined],[{},{}],[{ownerId:1,ownedBytes:64},{ownerId:1,ownedBytes:64}],[{ownerId:2,ownedBytes:0},{ownerId:2,ownedBytes:0}],[survivor,{...survivor,ownedBytes:0}]])
  assert.throws(()=>assertReleased(released,before,after));
 assertFresh({executionId:1,planIdentity:'p'},{executionId:2,planIdentity:'p',builds:1});
});
for(const name of ['unforced automatic covering build/probe/filter','reset rebind reprepare fresh execution',
 'capacity minus-one exact plus-one and partial page/record/filter allocation failure',
 'cancel and deadline during build and probe preserve original error',
 'refund reset retry finalize close and independent statement ownership',
 'standalone persistent-index Bloom choice and pulldown'])
 test(name,{skip:'PENDING runtime implementation + version-1 private observation seam; no feature credit'},()=>{});
