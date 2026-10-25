import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement,DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
import {likePrefixRange} from '../../src/internal/like-prefix.ts';

// Source-derived wherecode String8 fixup/WhereEnd counter protocol. This is
// primitive VM evidence, not selected SQL range or independent acceptance.
for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const descending of [false,true])test(`String8 TEXT/BLOB repetition ${encoding}/${descending}`,async()=>{
 const range=likePrefixRange(new TextEncoder().encode('abc%'),'like',encoding,true);
 const p5=descending?1:0;
 const program={encoding,registers:3,columns:[{name:'lower',declaredType:null,database:null,table:null,origin:null},{name:'upper',declaredType:null,database:null,table:null,origin:null}],parameters:[],maxWorkUnits:100000,maxResultBytes:100000,privateStateLimits:DEFAULT_PRIVATE_STATE_LIMITS,ops:[
  {code:'Integer',p1:1n,p2:1},
  {code:'String8',p1:range.lower,p2:2,p3:1,p5},
  {code:'String8',p1:range.upper,p2:3,p3:1,p5},
  {code:'ResultRow',p1:2,p2:2},
  {code:'DecrJumpZero',p1:1,p2:1},
  {code:'Halt'},
 ]};
 const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
 try{
  for(let repeat=0;repeat<2;repeat++){
   for(let pass=0;pass<2;pass++){
    assert.equal(await statement.step(),'row');
    const blob=pass===Number(!descending);
    assert.equal(statement.columnType(0),blob?'blob':'text');
    assert.equal(statement.columnType(1),blob?'blob':'text');
    if(blob){
     const hex=encoding==='utf-8'?['414243','616264']:encoding==='utf-16le'?['410042004300','610062006400']:['004100420043','006100620064'];
     assert.equal(Buffer.from(statement.column(0)).toString('hex'),hex[0]);
     assert.equal(Buffer.from(statement.column(1)).toString('hex'),hex[1]);
    }else {assert.equal(statement.column(0),'ABC');assert.equal(statement.column(1),'abd');}
   }
   assert.equal(await statement.step(),'done');
   await statement.reset();
  }
 }finally{await statement.finalize();}
});
