import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {btreeFromStorage} from '../../src/internal/btree.ts';import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';import {loadSchemaGraph} from '../../src/internal/schema.ts';import {VdbeStatement} from '../../src/internal/vdbe.ts';
const root=new URL('../../docs/research/card-s-g/',import.meta.url),capture=JSON.parse(fs.readFileSync(new URL('lowmul-native.json',root),'utf8'));
for(const v of capture.variants)test(`production SeekScan wrapper ${v.encoding}`,async()=>{
 const storage=ImmutableStorage.open(new Uint8Array(fs.readFileSync(new URL(v.fixture,root)))),schema=loadSchemaGraph({[storageOwner]:storage}),database=btreeFromStorage(storage),physical=schema.indexes.get('sa').physical;
 // Known physical a/b equality prefix: native fixture nonempty, forward inclusive.
 const base=[{code:'OpenIndex',p1:schema.indexes.get('sa').rootPage,p2:1,physical},{code:'String',p1:'Alpha',p2:0},{code:'Integer',p1:1n,p2:1}];
 // Schema root owner naming is asserted rather than silently testing another tree.
 const page=schema.indexes.get('sa').rootPage;base[0].p1=page;
 const seek={code:'IndexSeekPrefix',p1:1,keys:[0,1],affinities:['text','integer'],keyInfo:physical.keyInfo,reverse:false,p2:8};
 const ops=[...base,seek,{...seek,seekScan:{steps:14,hasRange:false}}, {code:'Column',p1:1,p2:1,p3:2},{code:'ResultRow',p1:2,p2:1},{code:'Halt'},{code:'Halt'}];
 const program={ops,registers:3,columns:[{name:'b',declaredType:'INT'}],parameters:[],database,encoding:database.encoding,maxWorkUnits:10000,maxResultBytes:1000000,privateStateLimits:{maxBytes:1000000,maxEntries:10000,maxKeyBytes:100000}};
 const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
 try{assert.equal(await statement.step(),'row');assert.equal(statement.privateAccounting().indexSeeks,1,'equal current key bypasses second seek');assert.equal(await statement.step(),'done');await statement.reset();assert.equal(await statement.step(),'row');assert.equal(statement.privateAccounting().indexSeeks,1,'reset reopens clean cursor');await statement.reset();await assert.rejects(statement.step({maxWorkUnits:5}));assert.throws(()=>statement.reset());assert.equal(await statement.step(),'row','same-statement recovery after bounded scan work error');}finally{await statement.finalize();}
 // Invalid cursor falls through, executes actual seek, and loads a record.
 const fallback=new VdbeStatement({...program,ops:[...base,{...seek,seekScan:{steps:14,hasRange:false},p2:7},{code:'Column',p1:1,p2:1,p3:2},{code:'ResultRow',p1:2,p2:1},{code:'Halt'},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
 try{assert.equal(await fallback.step(),'row');assert.equal(fallback.privateAccounting().indexSeeks,1);}finally{fallback.finalize();}
 // Step beyond requested prefix before full seek: source exit and Next accounting.
 const walked=new VdbeStatement({...program,registers:4,ops:[...base,seek,{code:'Integer',p1:100000n,p2:2},{code:'IndexSeekPrefix',p1:1,keys:[0,1,2],affinities:['text','integer','integer'],keyInfo:physical.keyInfo,reverse:false,p2:8,seekScan:{steps:1000,hasRange:false}},{code:'Column',p1:1,p2:2,p3:3},{code:'ResultRow',p1:3,p2:1},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
 try{assert.equal(await walked.step(),'done');assert.equal(walked.privateAccounting().indexSeeks,1);assert.ok(walked.privateAccounting().indexNext>0,'scan steps owned by physical Next');}finally{walked.finalize();}
 // Joined invocation NullRow must prevent stale current comparison bypass.
 const invalidated=new VdbeStatement({...program,ops:[...base,seek,{code:'IndexNullRow',p1:1},{...seek,seekScan:{steps:14,hasRange:false},p2:9},{code:'Column',p1:1,p2:1,p3:2},{code:'ResultRow',p1:2,p2:1},{code:'Halt'},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
 try{assert.equal(await invalidated.step(),'row');assert.equal(invalidated.privateAccounting().indexSeeks,2,'fresh invocation falls through full seek');}finally{invalidated.finalize();}
 // Larger current c prefix than requested must take seek exit, not stale row.
 const three={...seek,keys:[0,1,2],affinities:['text','integer','integer'],p2:10};
 const exhausted=new VdbeStatement({...program,registers:4,ops:[...base,{code:'Integer',p1:3n,p2:2},three,{code:'Integer',p1:-1n,p2:2},{...three,seekScan:{steps:14,hasRange:false}},{code:'Column',p1:1,p2:2,p3:3},{code:'ResultRow',p1:3,p2:1},{code:'Halt'},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
 try{assert.equal(await exhausted.step(),'done');assert.equal(exhausted.privateAccounting().indexSeeks,1,'greater comparison exits without fallback seek');}finally{exhausted.finalize();database.close();}
});
