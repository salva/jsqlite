import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';

// where.c constructAutomaticIndex: GenerateIndexKey/MakeRecord changes the
// live input registers before FilterAdd. wherecode.c:2024 applies probe affinity
// BEFORE Filter, not only to a private copy inside IndexSeekPrefix.
const cases=[
 {name:'numeric text becomes integer',affinity:'numeric',build:1n,probe:'01',result:2n},
 {name:'missing prefilter affinity is a false negative control',affinity:'numeric',build:1n,probe:'01',skipAffinity:true,result:0n},
 {name:'numeric exponent becomes integer',affinity:'numeric',build:'3.0e+5',probe:300000n,result:2n},
 {name:'fractional REAL and numeric text',affinity:'numeric',build:1.5,probe:'1.50',result:2n},
 {name:'REAL truncation collision still seeks',affinity:'numeric',build:1.5,probe:1.75,result:1n},
 {name:'REAL IntReal conversion',affinity:'real',build:1n,probe:'1.0',result:2n},
 {name:'REAL six-byte boundary',affinity:'real',build:140737488355328n,probe:'140737488355328',result:2n},
 {name:'TEXT integer coercion',affinity:'text',build:1n,probe:'1',result:2n},
 {name:'TEXT spelling collision rejected',affinity:'text',build:'01',probe:1n,result:1n},
 {name:'NOCASE spelling',affinity:'text',collation:'nocase',build:'AbC',probe:'aBc',result:2n},
 {name:'RTRIM spelling',affinity:'text',collation:'rtrim',build:'abc   ',probe:'abc',result:2n},
 {name:'BINARY string hash collision',affinity:'blob',build:'a',probe:'b',result:1n},
 {name:'BLOB hash collision',affinity:'blob',build:new Uint8Array([1]),probe:new Uint8Array([2]),result:1n},
 {name:'BLOB equal',affinity:'blob',build:new Uint8Array([0,255]),probe:new Uint8Array([0,255]),result:2n},
 {name:'NULL IS NULL',affinity:'numeric',build:null,probe:null,result:2n},
 {name:'NULL and zero collide but differ',affinity:'numeric',build:null,probe:0n,result:1n},
 {name:'integer negative bit',affinity:'numeric',build:1n,probe:17n,result:0n},
 {name:'integer modulo collision',affinity:'numeric',build:1n,probe:80001n,result:1n},
];
function load(value,register){
 if(value===null)return {code:'Null',p2:register};
 return typeof value==='bigint'?{code:'Integer',p1:value,p2:register}:
  typeof value==='number'?{code:'Real',p1:value,p2:register}:
  typeof value==='string'?{code:'String',p1:value,p2:register}:
  {code:'Blob',p1:value,p2:register};
}
for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const c of cases)
test(`Filter/packed affinity seam ${encoding}: ${c.name}`,async()=>{
 const keyInfo=new KeyInfo({encoding,totalFieldCount:2,keyFieldCount:1,terms:[{collation:c.collation??'binary'},{}]});
 const common={p1:0,keys:[1],affinities:[c.affinity],keyInfo};
 const ops=[{code:'OpenEphemeral',p1:0,keyInfo,p4KeyInfo:keyInfo},
  {code:'FilterInit',p1:7,bytes:10000},load(c.build,1),{code:'Integer',p1:9n,p2:2},
  {code:'MakeRecord',p1:1,p2:2,p3:3,p4Affinity:[c.affinity,'blob']},
  {code:'FilterAdd',p1:7,p3:1,p4:1},
  {code:'IdxInsert',p1:0,p2:3,keyStart:1,keyCount:1},load(c.probe,1),
  {code:'Affinity',p1:1,affinity:c.skipAffinity?'blob':c.affinity},
  {code:'Filter',p1:7,p2:17,p3:1,p4:1},
  {code:'IndexSeekPrefix',...common,p2:15},
  {code:'IndexPrefixEnd',...common,p2:15},
  {code:'Integer',p1:2n,p2:4},{code:'Goto',p2:18},{code:'Halt'},
  {code:'Integer',p1:1n,p2:4},{code:'Goto',p2:18},
  {code:'Integer',p1:0n,p2:4},{code:'ResultRow',p1:4,p2:1},{code:'Halt'}];
 const program={encoding,registers:8,parameters:[],columns:[{name:'outcome'}],maxWorkUnits:100000,maxResultBytes:10000,privateStateLimits:{maxEntries:10,maxKeyBytes:10000,maxBytes:200000},ops};
 const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
 try{for(let run=0;run<2;run++){
  assert.equal(await statement.step(),'row');
  assert.equal(statement.column(0),c.result,'0=negative bit, 1=authoritative rejection, 2=match');
  assert.equal(await statement.step(),'done');if(!run)statement.reset();
 }}finally{statement.finalize()}
});
