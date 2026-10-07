import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBtreeDatabase} from '../../src/internal/btree.ts';
import {decodeRecord} from '../../src/internal/record.ts';
import {KeyInfo,compareMem} from '../../src/internal/comparison.ts';
import {Mem,memFromRawRecord} from '../../src/internal/mem.ts';

const root=new URL('../../docs/research/card-s-g/primitive-companions/',import.meta.url);
const native=JSON.parse(fs.readFileSync(new URL('native.json',root),'utf8'));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url),'utf8'));
assert.equal(native.sourceId,pin.sqliteSourceId);
const cell=v=>v.storageClass==='null'?{type:'null'}:{type:'integer',value:String(v.value)};
const value=n=>{const m=new Mem();if(n!==null)m.setInt64(n);return m;};
for(const variant of native.variants.filter(v=>v.tail==='18'||v.tail==='empty')){
 for(const desc of [false,true])test(`strict physical prefix ${variant.encoding}/${variant.tail}/${desc?'DESC':'ASC'}`,()=>{
  const db=openBtreeDatabase(new Uint8Array(fs.readFileSync(new URL(variant.fixture,root))));
  const encoding=db.encoding,info=new KeyInfo({encoding,totalFieldCount:3,keyFieldCount:2,terms:[{desc},{desc},{}]});
  const name=desc?'ad':'ab',rootpage=Number(variant.roots.find(r=>Buffer.from(r[0].utf8Hex,'hex').toString()===name)[1].value);
  const cursor=db.indexCursor(rootpage);
  const oracle=variant.cases.find(c=>c.sql==='SELECT a,b FROM t INDEXED BY ab ORDER BY a,b').rows;
  const ordered=desc?[...oracle].reverse():oracle;
  const seen=[];
  if(cursor.first())do{seen.push(decodeRecord(cursor.payload(),encoding).values.slice(0,2).map(cell));}while(cursor.next());
  assert.deepEqual(seen,ordered,'physical full traversal matches native typed rows');
  let comparisons=0;
  const original=db.indexSeek.bind(db);
  db.indexSeek=(r,compare,bias)=>original(r,payload=>{comparisons++;return compare(payload);},bias);
  db.readIndex=()=>{throw new Error('seek must not eagerly read the index');};
  for(const target of [null,-1n,0n,5n,19n,20n,99n])for(const direction of ['ge','gt','le','lt']){
   const reverse=direction==='le'||direction==='lt';
   const targetMem=value(target);
   const passing=ordered.filter(row=>{
    const current=value(row[0].type==='null'?null:BigInt(row[0].value));
    const cmp=compareMem(current,targetMem)*(desc?-1:1);current.release();
    return direction==='ge'?cmp>=0:direction==='gt'?cmp>0:direction==='le'?cmp<=0:cmp<0;
   });targetMem.release();
   const expected=reverse?passing.at(-1):passing[0];
   comparisons=0;
   assert.equal(cursor.seekKey([value(target)],info,direction),!!expected,`${direction}/${target}`);
   assert.ok(comparisons<100,`page-local logarithmic seek, comparisons=${comparisons}`);
   if(expected)assert.deepEqual(decodeRecord(cursor.payload(),encoding).values.slice(0,2).map(cell),expected);
   else{assert.equal(cursor.valid,false);assert.equal(cursor.next(),false);assert.equal(cursor.previous(),false);}
  }
 });
}

test('strict seek releases unpacked cells when page descent fails and can be retried',()=>{
 const variant=native.variants.find(v=>v.tail==='18'&&v.encoding==='UTF-8');
 assert.ok(variant);
 const db=openBtreeDatabase(new Uint8Array(fs.readFileSync(new URL(variant.fixture,root))));
 const rootpage=Number(variant.roots.find(r=>Buffer.from(r[0].utf8Hex,'hex').toString()==='ab')[1].value);
 const cursor=db.indexCursor(rootpage),info=new KeyInfo({encoding:db.encoding,totalFieldCount:3,keyFieldCount:2,terms:[{},{},{}]});
 const original=db.indexSeek.bind(db),failure=new Error('injected page-descent failure'),m=value(1n);
 db.indexSeek=()=>{throw failure;};
 assert.throws(()=>cursor.seekKey([m],info,'gt'),error=>error===failure);
 assert.equal(m.diagnostic().manifest,'null');
 db.indexSeek=original;
 assert.equal(cursor.seekKey([value(1n)],info,'gt'),true);
 db.close();
});

test('strict seek owns malformed packed-key corruption and releases copied cells',()=>{
 const captured=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-g/corruption-companions/native.json',import.meta.url),'utf8'));
 for(const variant of captured.variants.filter(v=>v.kind==='interior-record')){
  const bytes=fs.readFileSync(new URL(`../../docs/research/card-s-g/corruption-companions/${variant.fixture}`,import.meta.url));
  const db=openBtreeDatabase(new Uint8Array(bytes)),cursor=db.indexCursor(variant.mutation.root);
  const info=new KeyInfo({encoding:db.encoding,totalFieldCount:3,keyFieldCount:2,terms:[{},{},{}]});
  for(let i=0;i<2;i++){
   const leading=value(0n),suffix=value(7n);
   assert.throws(()=>cursor.seekKey([leading,suffix],info,'ge'),e=>e.name==='BtreeFormatError'&&e.message.includes('header length'));
   assert.equal(leading.diagnostic().manifest,'null');assert.equal(suffix.diagnostic().manifest,'null');
   cursor.clearPosition();assert.equal(cursor.valid,false);
  }
 }
});
