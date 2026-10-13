import test from 'node:test';
import assert from 'node:assert/strict';
import {emitSelectDestination} from '../../src/internal/select-program.ts';
import {JSQLiteError} from '../../src/index.ts';
for(const [label,dest,count] of [
 ['Set mismatch before affinity',{kind:'set',cursor:0,width:2,affinities:['text']},1],
 ['Set affinity vector mismatch',{kind:'set',cursor:0,width:2,affinities:['text']},2],
 ['Mem infinite width',{kind:'mem',register:1,width:Infinity},1],
 ['Mem fractional count',{kind:'mem',register:1,width:1.5},1.5],
 ['Set zero width',{kind:'set',cursor:0,width:0},1],
 ['Mem NaN count',{kind:'mem',register:1,width:1},NaN],
])test(`atomic destination: ${label}`,()=>{
 const ops=[{code:'Sentinel'}];const before=structuredClone(ops);let error;
 try{emitSelectDestination(ops,dest,1,count);}catch(e){error=e;}
 assert.deepEqual(ops,before,'invalid destination must emit no op');
 assert.ok(error instanceof JSQLiteError,'owning validation must not leak RangeError');
});
