import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {SelectProgramBuilder,reachesOwningReturn} from '../../src/internal/select-program.ts';
const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
const start=source.indexOf('function visitControlTargets(');
const old=source.indexOf('function relocateControlTargets(');
const body=source.slice(start<0?old:start,source.indexOf('export interface ParameterDescriptor',start<0?old:start));
const visit=Function(`${stripTypeScriptTypes(body)};return ${start<0?'relocateControlTargets':'visitControlTargets'}`)();
const p2=['Goto','Once','Gosub','RowSetTest','JsonTableRewind','JsonTableNext','MetadataFilter','MetadataNext','SorterNext','EphemeralRewind','EphemeralNext','IfNotZero','IfPos','DecrJumpZero','Rewind','Last','SeekRowid','SeekRowidRange','RowidUpperBound','RowidLowerBound','IndexRewind','IndexLast','InListValue','IndexIfNoHope','IndexSeekPrefix','IndexPrefixEnd','Filter','IndexRangeEnd','IsNull','IfNot','Next','Prev','IndexNext','IndexPrev'];
function check(op,want){
 const expression=Object.freeze({kind:'literal',value:null}),sourceIdentity=Object.freeze({name:'source'});
 const input=Object.freeze({...op,expression,sourceIdentity});
 for(const result of [undefined,false,0,91]){
  const seen=[];visit(input,n=>{seen.push(n);return result});assert.deepEqual(seen,want);
  assert.equal(input.expression,expression);assert.equal(input.sourceIdentity,sourceIdentity);assert.deepEqual(input,{...op,expression,sourceIdentity});
 }
 for(let stop=0;stop<want.length;stop++){
  const error=new Error(`target ${stop}`),seen=[];
  assert.throws(()=>visit(input,n=>{seen.push(n);if(seen.length===stop+1)throw error}),e=>e===error);
  assert.deepEqual(seen,want.slice(0,stop+1));
 }
}
test('instruction address visitation preserves every family, sentinels, ordering and first throw',()=>{
 for(const code of p2){check({code,p2:0},[0]);check({code,p2:7},[7]);}
 check({code:'MustBeInt',p2:0},[]);check({code:'MustBeInt',p2:7},[7]);
 check({code:'CompareJump',less:9,equal:0,greater:4},[9,0,4]);
 check({code:'InitCoroutine',p2:0,p3:0},[0]);check({code:'InitCoroutine',p2:8,p3:3},[8,3]);
 for(const code of ['Yield','EndCoroutine']){check({code,p2:0},[]);check({code,p2:8},[8]);}
 for(const code of ['SorterSort','PriorityShift','FifoShift','EphemeralPeekNextData','EphemeralAdvanceData'])check({code,emptyJump:0},[0]);
 check({code:'EphemeralAdvanceData'},[]);check({code:'FutureJump',jump:0},[0]);check({code:'FutureJump',jump:'7'},[]);check({code:'Integer',p2:3},[]);
});
test('owning Return chain and deferred validation retain original first error',()=>{
 assert.equal(reachesOwningReturn([{code:'Return',p1:2},{code:'Return',p1:9}],0,9),true);
 assert.equal(reachesOwningReturn([{code:'Return',p1:2},{code:'Goto'},{code:'Return',p1:9}],0,9),false);
 for(const target of [-1,NaN,1.5,1])assert.equal(reachesOwningReturn([{code:'Return',p1:9}],target,9),false);
 const builder=new SelectProgramBuilder(),error=new Error('first verifier error'),seen=[];
 builder.validateResolved(()=>{seen.push('first');throw error});
 builder.validateResolved(()=>seen.push('second'));
 assert.deepEqual(seen,[]);assert.throws(()=>builder.finish(),e=>e===error);assert.deepEqual(seen,['first']);
});
test('RIGHT verifier uses read-only visitation, not unused operation cloning',()=>{
 assert.ok(start>=0,'explicit visitor replaces obsolete relocator');
 assert.doesNotMatch(body,/\.\.\.original|=>number\):Op|Relocate/);
 assert.match(body,/target:\(pc:number\)=>void/);
 const caller=source.slice(source.indexOf('const validateRightInterior='),source.indexOf('function sqlName'));
 assert.match(caller,/visitControlTargets\(op,target=>/);
 assert.match(caller,/op.code==='Gosub'\|\|op.code==='Yield'\|\|op.code==='EndCoroutine'/);
 assert.match(caller,/builder.validateResolved\(validateRightInterior\)/);
 assert.doesNotMatch(source,/function relocateControlTargets\(/);
});
