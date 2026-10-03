import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open,JSQLiteError} from '../../src/index.ts';

// Native 3.53.4 source-ID checked before migration: entry-r1/native.py.
test('compound entry preserves per-arm classification, types and atomic errors',async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/empty.db`,import.meta.url));
 const original=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/empty');}finally{globalThis.fetch=original;}
 try{
  for(const [sql,expected] of [
   ['SELECT 1 AS x UNION ALL SELECT count(*)',[['integer',1n],['integer',1n]]],
   ['SELECT count(*) AS x UNION ALL SELECT 1.5',[['integer',1n],['real',1.5]]],
   ['SELECT 1 AS x UNION ALL SELECT NULL',[['integer',1n],['null',null]]],
  ]){
   const s=db.prepare(sql).statement;
   try{assert.equal(s.columnMetadata(0).name,'x');for(let pass=0;pass<2;pass++){
    const rows=[];while(await s.step()==='row')rows.push([s.columnType(0),s.column(0)]);
    assert.deepEqual(rows,expected);assert.equal(await s.step(),'done');if(pass===0)s.reset();
   }}finally{s.finalize();}
  }
  for(const [sql,message] of [
   ['SELECT 1 UNION ALL SELECT missing LIMIT 0','no such column: missing'],
   ['SELECT 1 UNION ALL SELECT sum(count(*))','misuse of aggregate function count()'],
  ])assert.throws(()=>db.prepare(sql),e=>e instanceof JSQLiteError&&e.kind==='sqlite'&&e.code===1&&e.message===message);
 }finally{db.close();}
});

test('public compound compilation owns enclosing builder and destination',()=>{
 const entry=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 // This is a construction contract, not a public row-equivalence assertion.
 // An entry-owned context must pass its builder/destination to real arm consumers.
 assert.match(entry,/new SelectProgramBuilder/);
 assert.match(entry,/compileCteUnionAll\(select,[\s\S]*?\{ builder, parameters, destination \}\)/);
 assert.match(entry,/ops: builder\.finish\(\), registers: builder\.registers/);
 assert.ok(entry.indexOf('compileCteUnionAll(select')<entry.indexOf('const aggregate ='));
 const branch=entry.slice(entry.indexOf('const builder ='),entry.indexOf('// select.c:sqlite3Select dispatches the compound before any arm'));
 assert.doesNotMatch(branch,/catch\s*\(/);
 const vdbe=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const arms=vdbe.slice(vdbe.indexOf('export function compileCteUnionAll('),vdbe.indexOf('function compileSimpleTableCompound('));
 assert.match(arms,/owner\?\.builder\?\?new SelectProgramBuilder/);
 assert.match(arms,/owner\?\.destination\?\?\{kind:'output'\}/);
 assert.match(arms,/if\(owner\)return \{columns:columns!\}/);
});

test('ordered public entry carries parent destination into existing arm consumer',()=>{
 const entry=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 const ordered=entry.slice(entry.indexOf('// select.c:sqlite3Select dispatches the compound before any arm'),entry.indexOf('// Existing transient/window/set entry owners'));
 assert.match(ordered,/compileOrderedCteUnionAll\(select,[\s\S]*\{ builder, parameters, destination \}\)/);
 assert.match(ordered,/builder\.finish\(\)/);
 assert.doesNotMatch(ordered,/catch\s*\(/);
});

test('ordered entry preserves native cross-arm types, names and atomic errors',async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url));
 const original=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/subquery');}finally{globalThis.fetch=original;}
 try{
  for(const [suffix,expected] of [
   ['1.5',[['integer',1n],['real',1.5],['integer',3n],['integer',5n],['integer',7n]]],
   ['NULL',[['null',null],['integer',1n],['integer',3n],['integer',5n],['integer',7n]]],
  ]){
   const s=db.prepare(`SELECT a AS x FROM t1 UNION ALL SELECT ${suffix} ORDER BY 1`).statement;
   try{assert.equal(s.columnMetadata(0).name,'x');for(let pass=0;pass<2;pass++){
    const rows=[];while(await s.step()==='row')rows.push([s.columnType(0),s.column(0)]);
    assert.deepEqual(rows,expected);if(pass===0)s.reset();
   }}finally{s.finalize();}
  }
  for(const [sql,message] of [
   ['SELECT a FROM t1 UNION ALL SELECT missing ORDER BY 1','no such column: missing'],
   ['SELECT a FROM t1 UNION ALL SELECT 1 ORDER BY 2','1st ORDER BY term out of range - should be between 1 and 1'],
  ])assert.throws(()=>db.prepare(sql),e=>e instanceof JSQLiteError&&e.kind==='sqlite'&&e.code===1&&e.message===message);
 }finally{db.close();}
});

test('recursive public queue branch consumes enclosing output context',()=>{
 const entry=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 const recursive=entry.slice(entry.indexOf('if (recursive)'),entry.indexOf('// select.c:sqlite3Select dispatches a compound'));
 assert.match(recursive,/compileRecursiveCteSelect\(select,[\s\S]*\{\s*builder, parameters, destination\s*\}/);
 assert.match(recursive,/builder\.finish\(\)/);
 assert.doesNotMatch(recursive,/catch\s*\(/);
});

test('recursive queue preserves REAL output and reset before entry migration',async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/empty.db`,import.meta.url));
 const original=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/empty');}finally{globalThis.fetch=original;}
 try{
  const s=db.prepare('WITH RECURSIVE q(x) AS (VALUES(1.5) UNION ALL SELECT x+1 FROM q WHERE x<3) SELECT x FROM q').statement;
  try{assert.equal(s.columnMetadata(0).name,'x');for(let pass=0;pass<2;pass++){
   const rows=[];while(await s.step()==='row')rows.push([s.columnType(0),s.column(0)]);
   assert.deepEqual(rows,[['real',1.5],['real',2.5],['real',3.5]]);assert.equal(await s.step(),'done');if(!pass)s.reset();
  }}finally{s.finalize();}
 }finally{db.close();}
});

test('scalar set entry passes enclosing builder parameters and destination to live composer',()=>{
 const entry=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 // Final zero-source owner, including UNION/INTERSECT/EXCEPT and VALUES,
 // must consume enclosing construction state, not publish a child Program.
 const scalar=entry.slice(entry.lastIndexOf('const produced = compileScalarSelect'));
 assert.match(scalar,/compileScalarSelect\(select,[\s\S]*\{\s*builder, parameters, emitRow, destination\s*\}/);
 assert.match(entry,/emitSelectDestination/);
 assert.match(scalar,/builder\.finish\(\)/);
});

test('scalar set parent preserves bindings representative types and atomic errors',async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/empty.db`,import.meta.url));
 const original=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/empty');}finally{globalThis.fetch=original;}
 try{
  for(const [sql,values,expected] of [
   ['SELECT ?1 AS x UNION SELECT ?2 ORDER BY 1',[1n,1.0],[['real',1]]],
   ['SELECT NULL AS x UNION SELECT ?1 ORDER BY 1 LIMIT ?2 OFFSET ?3',[1.5,1n,1n],[['real',1.5]]],
   ['SELECT ?1 AS x INTERSECT SELECT ?2',[2n,2.0],[['integer',2n]]],
   ['SELECT ?1 AS x EXCEPT SELECT ?2',[2n,1n],[['integer',2n]]],
   ['VALUES(?1),(?2)',[null,1.5],[['null',null],['real',1.5]]],
  ]){
   const s=db.prepare(sql).statement;
   try{values.forEach((v,i)=>s.bind(i+1,v));for(let pass=0;pass<2;pass++){
    const rows=[];while(await s.step()==='row')rows.push([s.columnType(0),s.column(0)]);
    assert.deepEqual(rows,expected);assert.equal(await s.step(),'done');if(!pass)s.reset();
   }}finally{s.finalize();}
  }
  for(const [sql,message] of [
   ['SELECT 1 UNION SELECT missing LIMIT 0','no such column: missing'],
   ['SELECT 1 UNION SELECT 2 ORDER BY 2','1st ORDER BY term out of range - should be between 1 and 1'],
  ])assert.throws(()=>db.prepare(sql),e=>e.code===1&&e.message===message);
 }finally{db.close();}
});

test('ordinary aggregate entry consumes enclosing state rather than independent publication',()=>{
 const entry=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 const branch=entry.slice(entry.indexOf('if (aggregate && !window && !jsonTableAggregate)'),entry.indexOf('if (select.from.items.length || select.where)'));
 assert.match(branch,/compileAggregateSelect\(select,[\s\S]*\{\s*builder, ops: builder\.ops, parameters, destination\s*\}/);
 assert.match(branch,/builder\.finish\(\)/);
 assert.doesNotMatch(branch,/catch\s*\(/);
});

test('recursive aggregate entry supplies enclosing allocation and output to selected producer',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 assert.match(text,/compileRecursiveAggregateSelect\(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, \{ builder, parameters, destination \}\)/);
});

test('multiple recursive CTE entry supplies enclosing allocation and output to composer',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 assert.match(text,/compileMultipleRecursiveCtes\(select, encoding, maxWorkUnits, maxResultBytes, privateStateLimits, maxRows, \{ builder, parameters, destination \}\)/);
});

test('recursive window entry supplies enclosing allocation and output to rewrite owner',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 assert.match(text,/compileRecursiveWindowSelect\(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, \{ builder, parameters, destination \}\)/);
});

test('window lowering publishes late subroutine register high-water to enclosing allocation',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const block=text.slice(text.indexOf('export function compileWindowSelectLowering('),text.indexOf('export function compileRecursiveCteSelect('));
 assert.match(block,/let registers=Math\.max\(builder\.registers,/);
 const publication=block.lastIndexOf('owner.builder.registers=Math.max(owner.builder.registers,registers)');
 assert.ok(publication>block.indexOf('const endRowid=++registers'));
});

test('ordinary table window entry forwards enclosing state through actual table preparer',()=>{
 const entry=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 const producer=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.match(entry,/compileTableSelect\(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, \{ builder, parameters, destination \}\)/);
 const table=producer.slice(producer.indexOf('export function compileTableSelect('));
 assert.match(table,/compileWindowSelectLowering\(expanded,database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,shared\)/);
});

test('window setup allocates partition and constant registers through enclosing Parse builder',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const setup=text.slice(text.indexOf('  for(const layer of compileLayers){'),text.indexOf('    // window.c:windowCheckValue'));
 assert.match(setup,/builder\.register\(\)/);
 assert.doesNotMatch(setup,/\+\+registers/);
 assert.match(setup,/builder\.registers=Math\.max\(builder\.registers,registers\)/);
 assert.match(setup,/registers=builder\.registers/);
});

test('window frame bound expression producer allocates on enclosing builder',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const frame=text.slice(text.indexOf('    const boundRegisters:'),text.indexOf('    // window.c:sqlite3WindowCodeInit checks eExclude'));
 assert.match(frame,/compileExpressionTree\(expressionFromReduction\(value.expr.reduction\),ops,\(\)=>builder\.register\(\),parameters\)/);
 assert.doesNotMatch(frame,/\+\+registers/);
 assert.match(frame,/registers=builder\.registers/);
});

test('window application state uses enclosing register and cursor owners',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const application=text.slice(text.indexOf('    let regStartRowid:'),text.indexOf('    const owner=layer.windows[0]?.window;'));
 assert.match(application,/regStartRowid=builder\.register\(\);regEndRowid=builder\.register\(\)/);
 assert.match(application,/applicationCursor=builder\.cursor\(\)/);
 assert.doesNotMatch(application,/\+\+registers|nextApplicationCursor\+\+/);
 assert.match(text,/builder\.reserveCursorsThrough\(nextApplicationCursor-1\)/);
 assert.match(application,/registers=builder\.registers/);
 assert.match(application,/nextApplicationCursor=Math\.max\(nextApplicationCursor,builder\.cursors\)/);
});

test('window input record rowid and peer ranges allocate on enclosing builder',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const buffer=text.slice(text.indexOf('    // window.c allocates regNew[nInput]'),text.indexOf('    setup.push(Object.freeze({compatibleGroup:layer.compatibleGroup'));
 assert.match(buffer,/builder\.range\(/);
 assert.match(buffer,/regRecord=builder\.register\(\),regRowid=builder\.register\(\)/);
 assert.doesNotMatch(buffer,/\+\+registers/);
 assert.match(buffer,/width\?builder\.range\(width\):builder\.registers\+1/);
 assert.match(buffer,/registers=builder\.registers/);
});

test('window source and rewritten producer coroutine destinations share register owner',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const coroutines=text.slice(text.indexOf('  const sourceCoroutine='),text.indexOf('  const sorterCursors=',text.indexOf('  const sourceCoroutine=')));
 assert.match(coroutines,/sourceCoroutine=builder\.register\(\)/);
 assert.match(coroutines,/producerCoroutines=compileLayers\.map\(\(\)=>builder\.register\(\)\)/);
 assert.doesNotMatch(coroutines,/\+\+registers/);
 assert.match(coroutines,/registers=builder\.registers/);
});

test('window positioned source and buffer expressions allocate on enclosing builder',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const producer=text.slice(text.indexOf('  // Source coroutine. Nested source scans'),text.indexOf('    const emitProducerBinding='));
 const binding=text.slice(text.indexOf('    const emitProducerBinding='),text.indexOf('    const emitProducerBinding=')+6500);
 assert.doesNotMatch(producer,/compileExpressionTree[^\n]*\(\)=>\+\+registers/);
 assert.doesNotMatch(binding,/compileExpressionTree[^\n]*\(\)=>\+\+registers/);
 assert.match(binding,/compileExpressionTree[^\n]*\(\)=>builder\.register\(\)/);
});

test('window retained output rows and peer ranges share enclosing allocation owner',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const lowering=text.slice(text.indexOf('function compileWindowSelectLowering'),text.indexOf('function compileWindowSelectLowering')+100000);
 assert.doesNotMatch(lowering,/const outputSave=registers\+1;registers\+=/);
 assert.doesNotMatch(lowering,/const previousPeer=registers\+1;registers\+=/);
 assert.doesNotMatch(lowering,/const (endSave|startSave)=registers\+1;registers\+=/);
 assert.match(lowering,/const outputSave=state\.inputRegisters\.length\?builder\.range\(state\.inputRegisters\.length\):builder\.registers\+1;registers=builder\.registers/);
});

test('window root projection and consumer limit use enclosing register owner',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=text.indexOf('  const outputStart=emitsRows?');
 assert.ok(start>=0);
 const projection=text.slice(start,text.indexOf('  if(emitsRows){const rootState=',start));
 assert.doesNotMatch(projection,/registers\+=outputEntries\.length/);
 assert.doesNotMatch(projection,/computeLimitRegisters[^\n]*\(\)=>\+\+registers/);
 assert.match(projection,/outputStart=emitsRows\?builder\.range\(outputEntries\.length\):0/);
 assert.match(projection,/computeLimitRegisters[^\n]*\(\)=>builder\.register\(\)/);
 assert.match(projection,/registers=builder\.registers/);
});

test('window root ordered projection key and sorter consume enclosing allocation owner',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=text.indexOf('  const outputStart=emitsRows?');
 const output=text.slice(start,text.indexOf('  if(owner){owner.builder.',start));
 assert.doesNotMatch(output,/const keyStart=registers\+1;registers\+=outerOrderEntries\.length/);
 assert.match(output,/const outerSorter=[^\n]*builder\.cursor\(\)/);
 assert.match(text,/reserveCursorsThrough\(Math\.max\(nextApplicationCursor,\.\.\.sorterCursors\)\)/);
 assert.match(output,/nextApplicationCursor=Math\.max\(nextApplicationCursor,builder\.cursors\)/);
 assert.match(output,/keyStart=builder\.range\(outerOrderEntries\.length\);registers=builder\.registers/);
});

test('late bounded peer exclusion scan consumes shared registers and labels',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=text.indexOf('    if(sharedBoundedPeerExclusion){');
 assert.ok(start>=0);
 const body=text.slice(start,text.indexOf('    const sharedSliding=',start));
 assert.doesNotMatch(body,/\+\+registers/);
 assert.match(body,/builder\.jump\(finish/);
 assert.match(body,/builder\.mark\(next\)/);
 assert.match(body,/registers=builder\.registers/);
 assert.doesNotMatch(body,/\(ops\[(?:seek|beforeStart|beyond|peer!|identitySkip)[^\n]*as/);
});

test('late sliding and following drains consume shared control labels',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=text.indexOf('    if(sharedSliding){');
 assert.ok(start>=0);
 const body=text.slice(start,text.indexOf('    const cachedDirectOffset=',start));
 assert.doesNotMatch(body,/\(ops\[(?:filterJump|skip|done|ready)/);
 assert.match(body,/builder\.jump/);
});

test('joined producer owns ordered and direct destination exits through shared labels',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=text.indexOf('function compileInnerTableSelect(select:SelectNode,expanded:');
 const end=text.indexOf('\nfunction sqlName(',start);
 assert.ok(start>=0&&end>start);
 const body=text.slice(start,end);
 assert.doesNotMatch(body,/const outputLimitStops:number\[\]=\[\]/);
 assert.doesNotMatch(body,/\(ops\[sortAt\] as \{emptyJump:number\}\)/);
});

test('ordinary physical output owns drain and scan continuation before publication',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('  projected.forEach((x,i)=>');
 const end=source.indexOf('  const columns=expanded.result.map',start);
 assert.ok(start>=0&&end>start);
 const body=source.slice(start,end);
 assert.doesNotMatch(body,/ops\.splice\(sortAt,0,\.\.\.tail\)/);
 assert.doesNotMatch(body,/ops\.splice\(adjusted\+1/);
 assert.doesNotMatch(body,/let scanContinue=-1/);
});
