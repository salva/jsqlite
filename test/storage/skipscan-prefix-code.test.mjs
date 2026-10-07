import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {beginPrefixLoop,emitPrefixSeek,finishPrefixLoop} from '../../src/internal/where-prefix.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {openBtreeDatabase} from '../../src/internal/btree.ts';
import {decodeRecord} from '../../src/internal/record.ts';
import {Mem,memFromRawRecord} from '../../src/internal/mem.ts';
const root=new URL('../../docs/research/card-s-g/primitive-companions/',import.meta.url);
const native=JSON.parse(fs.readFileSync(new URL('native.json',root),'utf8'));

for(const reverse of [false,true])for(const nSkip of [0,1,2])test(`prefix builder source control reverse=${reverse} nSkip=${nSkip}`,()=>{
 const ops=[],keys=[10,11,12],affinities=['blob','blob','integer'];
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:3,keyFieldCount:3,terms:[{},{},{}]});
 const entry=beginPrefixLoop(ops,4,keys,affinities,info,reverse,nSkip);
 const loop=emitPrefixSeek(ops,entry,4,keys,affinities,info,reverse,false);
 if(!nSkip){assert.equal(loop.restart,null);assert.equal(ops.length,1);}
 else{
  assert.deepEqual(ops.slice(0,nSkip),keys.slice(0,nSkip).map(p2=>({code:'Null',p2})));
  assert.equal(ops[loop.empty].code,reverse?'IndexLast':'IndexRewind');
  assert.equal(ops[loop.restart-1].p2,loop.restart+1,'first entry bypasses strict restart');
  assert.deepEqual(ops[loop.restart].keys,keys.slice(0,nSkip));
  assert.equal(ops[loop.restart].strict,true);
  assert.deepEqual(ops[loop.restart].affinities,Array(nSkip).fill('blob'),'physical prefix restart does not re-affinitize index cells');
  assert.deepEqual(ops.slice(loop.restart+1,loop.seek),keys.slice(0,nSkip).map((p2,p1)=>({code:'Column',p1,p2,p3:4})));
  const exit=ops.length+1;finishPrefixLoop(ops,loop,exit);
  assert.deepEqual(ops.at(-1),{code:'Goto',p2:loop.restart});
  assert.equal(ops[loop.empty].p2,exit);assert.equal(ops[loop.restart].p2,exit);
 }
 assert.deepEqual(ops[loop.seek].keys,keys,'suffix seek preserves positional skipped keys');
 assert.throws(()=>beginPrefixLoop([],4,keys,[],info,reverse,1));
});

// Execute only the generated positioning segment against the real page cursor.
// This is a control/primitive test, not a SELECT evaluator or public skipscan
// claim. Native full ordered rows independently specify the distinct runs.
for(const variant of native.variants.filter(v=>v.tail==='18'||v.tail==='empty'))for(const reverse of [false,true])test(`first/restart page path ${variant.encoding}/${variant.tail}/${reverse}`,()=>{
 const db=openBtreeDatabase(new Uint8Array(fs.readFileSync(new URL(variant.fixture,root))));
 const rootpage=Number(variant.roots.find(r=>Buffer.from(r[0].utf8Hex,'hex').toString()==='ab')[1].value);
 const cursor=db.indexCursor(rootpage),info=new KeyInfo({encoding:db.encoding,totalFieldCount:3,keyFieldCount:2,terms:[{},{},{}]});
 const ops=[],registers=[new Mem(),new Mem()];
 const entry=beginPrefixLoop(ops,0,[0,1],['blob','blob'],info,reverse,1);
 const equality=ops.length;
 // Stand-in RHS opcode marks source equality evaluation after Column.
 ops.push({code:'Null',p2:1});
 const loop=emitPrefixSeek(ops,entry,0,[0,1],['blob','blob'],info,reverse,false);
 const exit=ops.length+1;finishPrefixLoop(ops,loop,exit);
 const seen=[];let pc=0,steps=0,evaluations=0;
 while(pc<exit){
  assert.ok(++steps<10000,'strict restart must advance or exhaust');
  if(pc===loop.seek){
   seen.push(decodeRecord(cursor.payload(),db.encoding).values[0]);
   pc=loop.restart;continue;
  }
  if(pc===equality){assert.ok(cursor.valid);evaluations++;}
  const op=ops[pc++];
  if(op.code==='Null')registers[op.p2].setNull();
  else if(op.code==='Goto')pc=op.p2;
  else if(op.code==='IndexRewind'||op.code==='IndexLast'){if(!(reverse?cursor.last():cursor.first()))pc=op.p2;}
  else if(op.code==='Column'){
   const cell=memFromRawRecord(decodeRecord(cursor.payload(),db.encoding).values[op.p1],db.encoding);
   registers[op.p2].moveFrom(cell);
  }else if(op.code==='IndexSeekPrefix'){
   const cells=op.keys.map(r=>{const m=new Mem();m.copyFrom(registers[r]);return m;});
   if(!cursor.seekKey(cells,info,reverse?'lt':'gt'))pc=op.p2;
  }else assert.fail('unexpected positioning op');
 }
 const ordered=variant.cases.find(c=>c.sql==='SELECT a,b FROM t INDEXED BY ab ORDER BY a,b').rows;
 const distinct=[];
 for(const row of reverse?[...ordered].reverse():ordered){const c=row[0];if(!distinct.length||JSON.stringify(c)!==JSON.stringify(distinct.at(-1)))distinct.push(c);}
 const typed=seen.map(c=>c.storageClass==='null'?{type:'null'}:{type:'integer',value:String(c.value)});
 assert.deepEqual(typed,distinct);
 assert.equal(evaluations,distinct.length,'first entry and every restart re-enter RHS evaluation; empty does not');
 for(const m of registers)m.release();db.close();
});

for(const reverse of [false,true])for(const strict of [false,true])test(`source SeekScan lowering GE-only reverse=${reverse} strict=${strict}`,()=>{
 const ops=[],keyInfo={terms:[]};
 const entry={restart:null,empty:null};
 emitPrefixSeek(ops,entry,2,[3],['integer'],keyInfo,reverse,strict,{enabled:true,rowLogEst:137,hasRange:true});
 assert.deepEqual(ops[0].seekScan,!reverse&&!strict?{steps:14,hasRange:true}:undefined);
});
