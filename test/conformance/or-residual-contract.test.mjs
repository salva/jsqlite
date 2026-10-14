import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {branchConsumedTerms} from '../../src/internal/where-plan.ts';

// Pinned wherecode.c disableTerm419–444: CODED/readiness/eligibility gates
// precede child decrement; only zero remaining children disables the parent.
// This Set accounts for term identities, not the runtime RowSet rowid union.
function fixture() {
 const parent={id:0,parentId:null,childIds:[1,2],prereqAll:3n,outerJoinSafe:{mayOmitResidual:true}};
 const child=id=>({id,parentId:0,childIds:[],prereqAll:3n,virtual:true,outerJoinSafe:{mayOmitResidual:true}});
 const first=child(1),second=child(2);
 const independent={id:3,parentId:null,childIds:[],prereqAll:1n,outerJoinSafe:{mayOmitResidual:true}};
 const clause={terms:[parent,first,second,independent]};
 const admission=term=>({term});
 const loop=(terms,extra={})=>({capability:{equalitySlots:terms.map(admission),...extra}});
 return {parent,first,second,independent,clause,admission,loop};
}

test('fully tested selected children consume parent without replaying independent truth',()=>{
 const {parent,first,second,independent,clause,loop}=fixture();
 const before=JSON.stringify(clause,(_k,v)=>typeof v==='bigint'?String(v):v);
 const consumed=branchConsumedTerms(loop([first,second]),clause,3n);
 assert.deepEqual([...consumed],[first,second,parent]);
 assert.equal(consumed.has(independent),false,'independent enclosing conjunct remains residual');
 assert.equal(JSON.stringify(clause,(_k,v)=>typeof v==='bigint'?String(v):v),before,'published terms stay immutable');
 assert.equal(branchConsumedTerms(loop([]),clause,3n).size,0,'consumption is invocation-local, not sticky across replan/reset');
});

test('unready arm retains child AND parent residual; nullable omission is not blanket-enabled',()=>{
 const {parent,first,second,clause,loop}=fixture();
 assert.equal(branchConsumedTerms(loop([first,second]),clause,2n).size,0,'missing earlier source prevents child and parent coding');
 first.outerJoinSafe.mayOmitResidual=false;
 const consumed=branchConsumedTerms(loop([first,second]),clause,3n);
 assert.deepEqual([...consumed],[second]);
 assert.equal(consumed.has(parent),false,'ineligible child cannot decrement parent');
});

test('duplicate admissions cannot prematurely disable parent; incomplete/no capability keeps truth',()=>{
 const {parent,first,second,clause,admission,loop}=fixture();
 const consumed=branchConsumedTerms(loop([first],{lower:admission(first),upper:admission(first)}),clause,3n);
 assert.deepEqual([...consumed],[first]);
 assert.equal(consumed.has(parent),false,'one child remaining despite repeated equality/range admissions');
 assert.equal(consumed.has(second),false,'unselected child is not consumed');
 assert.equal(branchConsumedTerms({capability:null},clause,3n).size,0);
 parent.outerJoinSafe.mayOmitResidual=false;
 assert.equal(branchConsumedTerms(loop([first,second]),clause,3n).has(parent),false,'parent has its own omission gate');
});

test('actual Case5 consumers filter consumed terms and retain untested parent ownership',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const joined=source.slice(source.indexOf('const emitJoinedOr='),source.indexOf('const emitJoinedOr=')+12000);
 const single=source.slice(source.indexOf('const emitOr='),source.indexOf('const emitOr=')+12000);
 assert.ok(joined.includes('const consumed=branchConsumedTerms(branch,clause,available);'));
 assert.ok(joined.includes('if(term.virtual||consumed.has(term)||(term.prereqAll&~ready)!==0n)continue;'));
 assert.ok(joined.includes('if(arms.every(arm=>(arm.prereqAll&~available)===0n))'));
 assert.ok(joined.includes('codedOrIdentities.add(expressionStructuralIdentity(term.expression))'));
 assert.ok(single.includes('const consumed=branchConsumedTerms(branch,clause,1n<<BigInt(branch.sourceOrdinal));'));
 assert.ok(single.includes('if(term.virtual||consumed.has(term))continue;'));
 // Public native-backed operand/error/reset and actual selected child/readiness
 // controls are exercised by or-branch-consumption and or-commuted-child suites.
 // These source assertions supplement, rather than replace, executable gates.
});
