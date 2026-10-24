import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement,DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';

test('func.c concat inverse tracks next separator and resets empty StrAccum',async()=>{
 const ops=[],expected=[];
 const put=(text,sep,inverse=false)=>{ops.push({code:'String',p1:text,p2:1},{code:'String',p1:sep,p2:2},{code:inverse?'AggInverse':'AggStep',name:'group_concat',args:[1,2],p2:3,collation:'binary',windowInverse:true});};
 const value=text=>{ops.push({code:'AggValue',name:'group_concat',p1:3,p2:4},{code:'ResultRow',p1:4,p2:1});expected.push(text)};
 put('é',':');put('β','--');put('z','/');value('é--β/z');
 put('é',':',true);value('β/z');put('β','--',true);value('z');
 put('z','/',true);value(null);put('',':');value('');put('x','!');value('!x');
 ops.push({code:'Halt'});
 const statement=new VdbeStatement({ops,registers:4,encoding:'utf-8',columns:[{name:'v',declaredType:null,database:null,table:null,origin:null}],parameters:[],maxRows:100,maxWorkUnits:1000,maxResultBytes:1000,privateStateLimits:DEFAULT_PRIVATE_STATE_LIMITS},()=>{},()=>()=>{},()=>{});
 try{for(let replay=0;replay<2;replay++){for(const result of expected){assert.equal(await statement.step(),'row');assert.equal(statement.column(0),result)}assert.equal(await statement.step(),'done');statement.reset()}}finally{statement.finalize()}
});
