import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSql} from '../../src/internal/parse.ts';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {btreeFromStorage} from '../../src/internal/btree.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {compileTableSelect,programControlTargets} from '../../src/internal/vdbe.ts';

// Baseline is captured BEFORE representation changes. Full ops preserve all
// targets/operands, not just opcode names; registers includes allocation holes.
const cases=[
 ['reordered-inner','SELECT x.id,y.id FROM m x JOIN m y ON x.a=y.a WHERE y.id=1'],
 ['left-barrier','SELECT x.id,y.id FROM m x LEFT JOIN m y ON y.id=x.id AND y.b>2'],
 ['right-barrier','SELECT y.id,z.id FROM m x RIGHT JOIN m y ON x.id=-1 LEFT JOIN m z ON z.id=y.id'],
 ['multislot-in','SELECT x.id,y.id FROM m x JOIN m y INDEXED BY m_abc ON y.a IN (1,2) AND y.b IN (2,3) WHERE x.id=1'],
 ['prefix','SELECT x.id,y.id FROM m x JOIN m y INDEXED BY m_abc ON y.b=2 WHERE x.id=1'],
 ['auto-bloom','SELECT x.id,y.id FROM m x JOIN m y ON y.b=x.b JOIN m z ON z.a=y.a WHERE x.id<5'],
 ['selected-prefix','SELECT x.id,z.id,y.id FROM t x CROSS JOIN t z CROSS JOIN t y INDEXED BY ab WHERE x.id<3 AND z.id<3 AND y.b=199 AND y.c=0 ORDER BY x.id,z.id,y.id','../../docs/research/card-s-h/skiprange-UTF-8.db'],
 ['selected-borrow',"SELECT x.id,y.id FROM t x CROSS JOIN tiny z CROSS JOIN t y WHERE y.a=99 AND y.b=x.b AND y.s='cold' ORDER BY x.id,y.id",'../../docs/research/card-s-h/UTF-8.db'],
 ['two-filter-borrow',"SELECT x.id,r.id,y.id FROM t x CROSS JOIN tiny z CROSS JOIN t r JOIN t y WHERE r.a=99 AND r.b=x.b AND r.s='cold' AND y.a=98 AND y.b=x.b AND y.s='cold' ORDER BY x.id,r.id,y.id",'../../docs/research/card-s-h/UTF-8.db'],
];
test('WhereLevel representation preserves full emitted ops, targets and allocation',()=>{
 const storage=ImmutableStorage.open(fs.readFileSync(new URL('./fixtures/advanced-index-utf8.db',import.meta.url)));
 try{
  const owner={[storageOwner]:storage},schema=loadSchemaGraph(owner),database=btreeFromStorage(storage);
  const witnesses=cases.map(([name,sql,fixture])=>{
   const extra=fixture?ImmutableStorage.open(fs.readFileSync(new URL(fixture,import.meta.url))):undefined;
   try{
   const select=parseSql(sql).statement;assert.equal(select?.kind,'select');
   const p=compileTableSelect(select,extra?loadSchemaGraph({[storageOwner]:extra}):schema,extra?btreeFromStorage(extra):database,100);
   if(name==='reordered-inner')assert.equal(p.ops.find(op=>op.code==='SeekRowid')?.p1,1,'FROM source 1 is outermost');
   if(name==='two-filter-borrow'){
    const filters=p.ops.flatMap((op,i)=>op.code==='Filter'?[i]:[]),seeks=p.ops.flatMap((op,i)=>op.code==='IndexSeekPrefix'?[i]:[]);
    assert.equal(filters.length,2);assert.equal(seeks.length,2);
    assert.ok(filters[0]<filters[1]&&filters[1]<seeks[0],'later Filter borrows initiating exit before either seek');
    assert.equal(p.ops[filters[0]].p2,p.ops[filters[1]].p2,'temporary borrowed exit');
    assert.notEqual(p.ops[filters[1]].p2,p.ops[seeks[1]].p2,'later seek restores its own exit');
   }
   if(name==='selected-prefix')assert.ok(p.ops.some(op=>op.code==='IndexSeekPrefix'&&op.strict),'actual strict prefix restart');
   if(name==='selected-borrow'){
    const filters=p.ops.flatMap((op,i)=>op.code==='Filter'?[i]:[]),seeks=p.ops.flatMap((op,i)=>op.code==='IndexSeekPrefix'?[i]:[]);
    assert.ok(filters.length&&seeks.length&&filters[0]<seeks[0],'later filter before first seek');
   }
   return {name,sql,registers:p.registers,ops:p.ops,targets:programControlTargets(p)};
   }finally{extra?.close()}
  });
  const seen=new Map();
  const text=JSON.stringify(witnesses,function(key,v){
   if(typeof v==='bigint')return {$bigint:String(v)};
   if(v&&typeof v==='object'){
    if(seen.has(v))return {$ref:seen.get(v)};
    seen.set(v,seen.size);
   }
   return v;
  });
  const file=process.env.WHERE_LEVEL_BASELINE??new URL('./cases/where-level-emission.json',import.meta.url);
  if(process.env.CAPTURE_WHERE_LEVEL==='1'){
   assert.ok(!fs.existsSync(file),'never overwrite a baseline');fs.writeFileSync(file,text);
  }else assert.equal(text,fs.readFileSync(file,'utf8'));
 }finally{storage.close()}
});
