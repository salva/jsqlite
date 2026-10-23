import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
import {packRecord} from '../../src/internal/record-pack.ts';
const control={async checkpoint(){}};
function setText(mem,value,encoding){
 const utf8=new TextEncoder().encode(value);
 const bytes=encoding==='utf-8'?utf8:new Uint8Array([...value].flatMap(c=>encoding==='utf-16le'?[c.charCodeAt(0),0]:[0,c.charCodeAt(0)]));
 mem.setText(bytes,encoding);
}
// vdbe.c Seek*: KeyInfo order, biased default_rc and adjacent correction.
// Explicit groups/suffixes avoid deriving expectations with a sorted evaluator.
for(const encoding of ['utf-8','utf-16le','utf-16be'])
for(const collation of ['binary','nocase','rtrim'])
for(const descending of [false,true])test(`${encoding}/${collation}/${descending?'DESC':'ASC'}: multipage packed prefix movement`,async()=>{
 const limits={maxEntries:200,maxKeyBytes:10000,maxBytes:4000000},budget=new PrivateStateByteBudget(limits.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const info=new KeyInfo({encoding,totalFieldCount:3,keyFieldCount:2,terms:[{collation,desc:descending},{},{}]});
 const vm=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info);
 const text=new Mem(),suffix=new Mem(),payload=new Mem(),out=new Mem(),probe=new Mem();
 try{
  payload.setBlob(new Uint8Array(180).fill(17));
  for(const group of ['c','b','a'])for(let i=39;i>=0;i--){
   setText(text,collation==='nocase'&&i%2?group.toUpperCase():collation==='rtrim'&&i%2?group+'   ':group,encoding);
   suffix.setInt64(BigInt(i));
   await vm.insert(packRecord([text,suffix,payload],encoding),control);
  }
  assert.ok(arena.pageCount>4,'must cross multiple packed leaves');
  setText(probe,'b',encoding);
  const read=async()=>{await vm.column(1,out,control);return out.integerValue()};
  for(const [op,expectedGroup,expectedSuffix] of [
   ['SeekGE','b',0n],['SeekLE','b',39n],
   ['SeekGT',descending?'a':'c',0n],['SeekLT',descending?'c':'a',39n],
  ]){
   assert.equal(await vm.seekBound([probe],op,control),true);
   assert.equal(await read(),expectedSuffix);
   await vm.column(0,out,control);
   assert.equal(out.textValue(encoding).toLowerCase().trimEnd(),expectedGroup);
   assert.equal(vm.nullRow,false);
  }
  await vm.seekBound([probe],'SeekGE',control);
  for(let i=0;i<40;i++){
   assert.equal(await vm.boundJump([probe],'IdxGT',control),false);
   assert.equal(await vm.boundJump([probe],'IdxGE',control),true);
   assert.equal(await read(),BigInt(i));assert.equal(await vm.next(control),true);
  }
  assert.equal(await vm.boundJump([probe],'IdxGT',control),true);
  await vm.seekBound([probe],'SeekLE',control);
  for(let i=39;i>=0;i--){
   assert.equal(await vm.boundJump([probe],'IdxLT',control),false);
   assert.equal(await vm.boundJump([probe],'IdxLE',control),true);
   assert.equal(await read(),BigInt(i));assert.equal(await vm.previous(control),true);
  }
  assert.equal(await vm.boundJump([probe],'IdxLT',control),true);
  for(const [value,op] of [[descending?'':'z','SeekGE'],[descending?'z':'','SeekLE']]){
   setText(probe,value,encoding);assert.equal(await vm.seekBound([probe],op,control),false);
   assert.equal(vm.nullRow,true);await vm.column(0,out,control);assert.equal(out.initialStorageClass,'null');
  }
  await vm.reuse(control);setText(probe,'b',encoding);
  for(const op of ['SeekGE','SeekGT','SeekLE','SeekLT'])assert.equal(await vm.seekBound([probe],op,control),false);
 }finally{for(const mem of [text,suffix,payload,out,probe])mem.release();vm.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
