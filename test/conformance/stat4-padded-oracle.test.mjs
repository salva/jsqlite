import test from 'node:test';import assert from 'node:assert/strict';import {KeyInfo,UnpackedRecordKey,compareStat4RecordKey} from '../../src/internal/comparison.ts';import {memFromPublic} from '../../src/internal/mem.ts';
// Captured independently with pinned internal sqlite3VdbeRecordCompare, padded
// allocation, NDEBUG, ENABLE_STAT4. Source/command/harness recorded in card status.
const cases=[['0206',0,true,0],['021f',1,false,0],['0909',0,false,11],['020a',-1,false,0],['020b',1,false,0],['00',-1,false,0]];
test('pinned C padded malformed sample numeric comparison branch/error distinctions',()=>{
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:1,terms:[{},{}]});
 for(const [hex,rc,eq,err] of cases){const raw=Uint8Array.from(Buffer.from(hex,'hex')),p=new Uint8Array(raw.length+8);p.set(raw);const rhs=new UnpackedRecordKey([memFromPublic(0n,'utf-8')],0,'stat4',info);try{assert.equal(compareStat4RecordKey(p,raw.length,rhs,info),rc,hex);assert.equal(rhs.eqSeen,eq,hex);assert.equal(rhs.errCode,err,hex)}finally{rhs.release()}}
});
