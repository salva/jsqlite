import assert from 'node:assert/strict';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateBlobkeyFormatError,PrivateIndexPage} from '../../src/internal/private-blobkey-pages.ts';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {assertReleased} from './where-autoindex-contract.mjs';

// Observe actual probe cell consumption first, then damage exactly one selected
// or unconsumed pointer slot on the same deterministic build. Full-consumption
// INNER witnesses explicitly assert no offpath slot exists; the default LEFT
// witness must still execute offpath damage. Prefer a selected
// nonroot page and an entirely unconsumed page when the fixture has depth.
export async function realCorruption(db,sql,expected,cell,{offpath=true}={}){
 const survivor=db.prepare(sql).statement,owner=db.prepare(sql).statement;
 const seek=PrivateKeyVmCursor.prototype.seekBound,parse=PrivateIndexPage.prototype.parseCell;
 const Native=globalThis.Uint8Array,visited=new Set();
 let active=false,mode='trace',damaged=false,selectedCell,offpathCell;
 try{
  assert.equal(await survivor.step(),'row');const before=privateAccounting(survivor);
  for(mode of ['trace','selected',...(offpath?['offpath']:[]),'broad','signature']){
   let witnessed=false,primary;const backing=[];damaged=false;
   globalThis.Uint8Array=new Proxy(Native,{construct(target,args,newTarget){
    const result=Reflect.construct(target,args,newTarget);
    if(args[0]===4096&&new Error().stack?.includes('at #append '))backing.push(result);
    return result;
   }});
   PrivateKeyVmCursor.prototype.seekBound=function(...args){
    if(!witnessed){
     witnessed=true;const work=privateAccounting(owner);
     assert.equal(work.builds,1);assert.equal(work.automaticInserts,128);assert.ok(work.packedPages>=2);
     assert.ok(backing.length>=2);
     active=true;
     if(mode==='broad'){
      for(const page of backing.slice(1))for(let i=8;i<512;i++)page[i]=0xff;
      damaged=true;
     }else if(mode==='signature'){backing[0][0]=0;damaged=true;}
     if(mode==='offpath'){
      assert.ok(offpathCell,'fixture needs an unconsumed cell pointer');
      const {pgno,index,slot}=offpathCell,page=backing[pgno-1];
      assert.ok(page);assert.ok(!visited.has(`${pgno}:${index}`));
      page[slot]=0;page[slot+1]=0;damaged=true;
     }
    }
    return seek.apply(this,args);
   };
   PrivateIndexPage.prototype.parseCell=function(index){
    if(active){
     const key=`${this.pgno}:${index}`;
     if(mode==='trace'){
      visited.add(key);if(!selectedCell||selectedCell.pgno===2&&this.pgno>2)selectedCell={pgno:this.pgno,index};
     }else if(mode==='selected'&&!damaged&&this.pgno===selectedCell.pgno&&index===selectedCell.index){
      assert.deepEqual({pgno:this.pgno,index},selectedCell,'same deterministic selected probe cell');
      const slot=this.cellOffset+2*index;this.bytes[slot]=0;this.bytes[slot+1]=0;damaged=true;
     }else if(mode==='offpath'){
      assert.notEqual(key,`${offpathCell.pgno}:${offpathCell.index}`,'damaged slot must remain unconsumed');
      if(offpathCell.pageUnconsumed)assert.notEqual(this.pgno,offpathCell.pgno,'offpath page must remain unconsumed');
     }
    }
    return parse.call(this,index);
   };
   const rows=[];
   try{
    if(mode==='selected'||mode==='broad')await assert.rejects(owner.step(),error=>{primary=error;assert.ok(error instanceof PrivateBlobkeyFormatError);return true;});
    else while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
    if(mode==='trace'){
     const pages=Array.from({length:backing.length-1},(_,i)=>i+1).reverse();
     pages.sort((a,b)=>Number([...visited].some(k=>k.startsWith(`${a+1}:`)))-Number([...visited].some(k=>k.startsWith(`${b+1}:`))));
     for(const p of pages){
      if(offpathCell)break;
      const page=backing[p],n=(page[3]<<8)|page[4],offset=page[0]===2?12:8;
      if(page[0]!==2&&page[0]!==10)continue;
      for(let i=0;i<n;i++)if(!visited.has(`${p+1}:${i}`)){offpathCell={pgno:p+1,index:i,slot:offset+2*i,pageUnconsumed:![...visited].some(k=>k.startsWith(`${p+1}:`))};break;}
     }
     assert.ok(selectedCell);
     if(offpath)assert.ok(offpathCell);
     else assert.equal(offpathCell,undefined,'full-consumption witness must not conceal an available offpath cell');
    }
   }finally{active=false;PrivateIndexPage.prototype.parseCell=parse;PrivateKeyVmCursor.prototype.seekBound=seek;globalThis.Uint8Array=Native;}
   assert.ok(witnessed);if(mode!=='trace')assert.ok(damaged);
   if(mode!=='selected'&&mode!=='broad')assert.deepEqual(rows,expected.runs[0].rows);
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
   if(mode==='selected'||mode==='broad')assert.throws(()=>owner.reset(),error=>error===primary);else owner.reset();
   const retry=[];while(await owner.step()==='row')retry.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
   assert.deepEqual(retry,expected.runs[0].rows);
   assert.deepEqual(Array.from({length:owner.columnCount},(_,i)=>owner.columnMetadata(i)),expected.columns);
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));owner.reset();
   console.error(JSON.stringify({control:'actual-packed-cell-corruption',mode,selectedCell,offpathCell,visited:visited.size}));
  }
  const remaining=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  while(await survivor.step()==='row')remaining.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(remaining,expected.runs[0].rows);
 }finally{active=false;PrivateIndexPage.prototype.parseCell=parse;PrivateKeyVmCursor.prototype.seekBound=seek;globalThis.Uint8Array=Native;owner.finalize();survivor.finalize();}
}
