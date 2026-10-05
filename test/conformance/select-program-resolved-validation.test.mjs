import test from 'node:test';
import assert from 'node:assert/strict';
import {SelectProgramBuilder} from '../../src/internal/select-program.ts';
test('shared SELECT verifier sees enclosing late resolved jump targets before publication',()=>{
 const b=new SelectProgramBuilder(),end=b.label();
 b.jump(end,{code:'Found',jump:0},(op,pc)=>({...op,jump:pc}));
 let calls=0;b.validateResolved(ops=>{calls++;assert.equal(ops[0].jump,2);assert.equal(ops[2].code,'Return')});
 b.emit({code:'Return',p1:8});b.mark(end);b.emit({code:'Return',p1:9});
 assert.equal(b.finish()[0].jump,2);assert.equal(calls,1);
});
test('failed settled verification cannot publish a frozen SELECT program',()=>{
 const b=new SelectProgramBuilder();b.emit({code:'Goto',p2:3});
 b.validateResolved(()=>{throw new Error('escape')});assert.throws(()=>b.finish(),/escape/);assert.equal(Object.isFrozen(b.ops),false);
});

// Source-based discriminator: vdbeaux.c995–1068, not jump rewriting.
test('RIGHT escape verification requires a settled owning Return chain',async()=>{
 const {reachesOwningReturn}=await import('../../src/internal/select-program.ts');
 const ops=[{code:'Return',p1:7},{code:'Return',p1:9},{code:'Goto',p2:1}];
 assert.equal(reachesOwningReturn(ops,0,9),true);
 assert.equal(reachesOwningReturn(ops,1,9),true);
 assert.equal(reachesOwningReturn(ops,0,8),false);
 assert.equal(reachesOwningReturn(ops,2,9),false);
 for(const target of [-1,0.5,3,Number.NaN])assert.equal(reachesOwningReturn(ops,target,9),false);
 const b=new SelectProgramBuilder(),exit=b.label();
 b.jump(exit,{code:'Goto',p2:0},(op,pc)=>({...op,p2:pc}));
 b.emit({code:'Return',p1:7});b.mark(exit);b.emit({code:'Return',p1:9});
 b.validateResolved(settled=>assert.equal(reachesOwningReturn(settled,settled[0].p2,9),true));
 assert.equal(b.finish()[0].p2,2);
});
