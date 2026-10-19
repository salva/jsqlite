import assert from 'node:assert/strict';
import test from 'node:test';
import {Mem} from '../../src/internal/mem.ts';
import {JSQLiteError} from '../../src/index.ts';
import {openJsonTableCursor,jsonArrow,jsonEdit} from '../../src/internal/json.ts';
const text=s=>{const m=new Mem();m.setText(new TextEncoder().encode(s),'utf-8');return m};
test('recursive root-parent execution failures retain identity at every reached callback',()=>{
 const doc=text('{"a":{"b":1}}');
 try{
  let total=0;const c=openJsonTableCursor(doc,true,()=>total++,'$.a.b');c.close();assert.equal(total,10);
  for(const stop of [new JSQLiteError('limit','limit'),new JSQLiteError('cancelled','cancelled'),new JSQLiteError('timeout','timeout'),new Error('internal'),new JSQLiteError('sqlite',"bad JSON path: '$.a'",{code:1}),null,{control:true}]){
   for(let at=1;at<=total;at++){
    let calls=0,retained=0;
    assert.throws(()=>openJsonTableCursor(doc,true,()=>{if(++calls===at)throw stop},'$.a.b',false,(old,n)=>{assert.equal(old,retained);retained=n}),e=>e===stop);
    assert.equal(calls,at);assert.equal(retained,0);
   }
  }
 }finally{doc.release()}
});
test('arrow and edit catches do not classify injected errors by message',()=>{
 const doc=text('{"a":1}'),path=text('$.a'),value=text('2');
 try{for(const invoke of [charge=>jsonArrow(doc,path,false,charge),charge=>jsonEdit(doc,[path,value],'set',charge)]){
  let total=0;invoke(()=>total++).release();
  for(const message of ["bad JSON path: '$.a'",'not an array element'])for(let at=1;at<=total;at++){
   let calls=0;const stop=new JSQLiteError('sqlite',message,{code:1});
   assert.throws(()=>invoke(()=>{if(++calls===at)throw stop}),e=>e===stop);
  }
 }}finally{doc.release();path.release();value.release()}
});
