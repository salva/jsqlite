import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {compileTableSelect,VdbeStatement} from '../../src/internal/vdbe.ts';
import {SelectProgramBuilder} from '../../src/internal/select-program.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';

// A shared producer returns to its caller before Halt. LIMIT must close its
// virtual cursor at that boundary, not retain the parse until statement death.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 for(const suffix of ['LIMIT 1','ORDER BY value DESC LIMIT 0','ORDER BY value DESC LIMIT 1']) {
 test(`JSON SELECT producer closes before caller resumes: ${suffix} (${encoding})`,async()=>{
  const builder=new SelectProgramBuilder();
  const output=builder.register();
  builder.ops.push({code:'Null',p2:output});
  const parameters={maximum:0,names:[],named:new Map()};
  const limits={maxEntries:100,maxKeyBytes:10000,maxBytes:1000000};
  const program=compileTableSelect(parseSql(`SELECT value FROM json_each('[1,2]') ${suffix}`).statement,
   {tables:new Map(),views:new Map()},{encoding},100,10000,10000,limits,
   {builder,parameters,destination:{kind:'mem',register:output,width:1}});
  builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'Halt'});
  const budgets=new Set(),original=PrivateStateByteBudget.prototype.replace;
  PrivateStateByteBudget.prototype.replace=function(...args){budgets.add(this);return original.apply(this,args)};
  const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
  try {
   for(let run=0;run<2;run++) {
    assert.equal(await statement.step(),'row');
    assert.equal(statement.column(0),suffix.endsWith('LIMIT 0')?null:suffix.startsWith('ORDER')?2n:1n);
    if(!suffix.endsWith('LIMIT 0'))assert.ok(budgets.size>0);
    assert.equal([...budgets].reduce((sum,budget)=>sum+budget.usedBytes,0),0,'producer return refunds before caller row');
    assert.equal(await statement.step(),'done');
    statement.reset();
   }
  }finally{statement.finalize();PrivateStateByteBudget.prototype.replace=original;}
 });
 }
}
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 test(`JSON EXISTS producer validates but does not evaluate projection (${encoding})`,async()=>{
  const builder=new SelectProgramBuilder();
  const output=builder.register();
  const parameters={maximum:0,names:[],named:new Map()};
  const limits={maxEntries:100,maxKeyBytes:10000,maxBytes:1000000};
  assert.throws(()=>compileTableSelect(parseSql("SELECT missing FROM json_each('[1,2]') LIMIT 1").statement,
   {tables:new Map(),views:new Map()},{encoding},100,10000,10000,limits,
   {builder:new SelectProgramBuilder(),parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'exists',register:1}}),error=>error.kind==='sqlite'&&error.code===1&&error.extendedCode===1&&error.unsupportedClassification===null&&error.message==='no such column: missing');
  const program=compileTableSelect(parseSql("SELECT json('malformed') FROM json_each('[1,2]') LIMIT 1").statement,
   {tables:new Map(),views:new Map()},{encoding},100,10000,10000,limits,
   {builder,parameters,destination:{kind:'exists',register:output}});
  builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'Halt'});
  const budgets=new Set(),original=PrivateStateByteBudget.prototype.replace;
  PrivateStateByteBudget.prototype.replace=function(...args){budgets.add(this);return original.apply(this,args)};
  const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
  try {
   for(let run=0;run<2;run++) {
    assert.equal(await statement.step(),'row');
    assert.equal(statement.column(0),1n);
    assert.ok(budgets.size>0);
    assert.equal([...budgets].reduce((sum,budget)=>sum+budget.usedBytes,0),0,'producer return refunds before caller row');
    assert.equal(await statement.step(),'done');
    statement.reset();
   }
  }finally{statement.finalize();PrivateStateByteBudget.prototype.replace=original;}
 });
}

// OFFSET belongs to the row loop, not the skipped EList region. The caller
// owns EXISTS initialization, as expr.c:sqlite3CodeSubselect does before SELECT.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 for(const [suffix,expected] of [['LIMIT 1 OFFSET 1',1n],['LIMIT 1 OFFSET 2',0n],['LIMIT 0',0n],['ORDER BY value DESC LIMIT 1',1n],['ORDER BY value DESC LIMIT 1 OFFSET 2',0n]]) {
  test(`JSON EXISTS skips only EList, preserving ${suffix} (${encoding})`,async()=>{
   const builder=new SelectProgramBuilder(),output=builder.register();
   builder.ops.push({code:'Integer',p1:0n,p2:output});
   const program=compileTableSelect(parseSql(`SELECT json('malformed') FROM json_each('[1,2]') ${suffix}`).statement,
    {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
    {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
    {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'exists',register:output}});
   builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'Halt'});
   const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
   try {
    for(let run=0;run<2;run++) {
     assert.equal(await statement.step(),'row');
     assert.equal(statement.column(0),expected);
     assert.equal(await statement.step(),'done');
     statement.reset();
    }
   }finally{statement.finalize();}
  });
 }
}

// expr.c:sqlite3CodeSubselect owns the normalized LIMIT and OFFSET registers.
// A producer must consume those exact counters, not compile a second private
// LIMIT from the child AST. This is an internal handoff, not nested enrollment.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 test(`JSON EXISTS consumes enclosing prepared limit (${encoding})`,async()=>{
  const builder=new SelectProgramBuilder(),output=builder.register(),count=builder.register(),offset=builder.register(),combined=builder.register(),capacity=builder.register();
  builder.ops.push({code:'Integer',p1:0n,p2:output},{code:'Integer',p1:1n,p2:count},{code:'Integer',p1:1n,p2:offset},{code:'Integer',p1:2n,p2:combined},{code:'Integer',p1:2n,p2:capacity});
  const ifZero=builder.ops.length;builder.ops.push({code:'IfNot',p1:count,p2:0});
  const program=compileTableSelect(parseSql("SELECT json('malformed') FROM json_each('[1,2,3]') LIMIT 100 OFFSET 99").statement,
   {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
   {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
   {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'exists',register:output},scalarPrepared:true,sharedLimit:{count,offset,combined,capacity,ifZero}});
  builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'ResultRow',p1:count,p2:1},{code:'Halt'});
  const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
  try {
   for(let run=0;run<2;run++) {
    assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n,'caller offset, not AST offset');
    assert.equal(await statement.step(),'row');assert.equal(statement.column(0),0n,'caller count exhausted');
    assert.equal(await statement.step(),'done');statement.reset();
   }
  }finally{statement.finalize();}
 });
}

// expr.c TK_BETWEEN/TK_IN still bind their operands in the source's
// NameContext. EXISTS suppresses only EList, not predicate evaluation.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 for(const [predicate,expected] of [
  ['value BETWEEN 2 AND 3',1n],
  ['value NOT BETWEEN 1 AND 3',0n],
  ['value IN (2, NULL)',1n],
  ['value NOT IN (2, NULL)',0n],
  ['2 BETWEEN value AND value + 1',1n],
  ['2 IN (value, value + 1)',1n],
 ]) {
  test(`JSON EXISTS binds complete predicate ${predicate} (${encoding})`,async()=>{
   const builder=new SelectProgramBuilder(),output=builder.register();
   builder.ops.push({code:'Integer',p1:0n,p2:output});
   const program=compileTableSelect(parseSql(`SELECT json('malformed') FROM json_each('[1,2,3]') WHERE ${predicate} LIMIT 1`).statement,
    {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
    {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
    {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'exists',register:output}});
   builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'Halt'});
   const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
   try {
    for(let run=0;run<2;run++) {
     assert.equal(await statement.step(),'row');
     assert.equal(statement.column(0),expected);
     assert.equal(await statement.step(),'done');
     statement.reset();
    }
   }finally{statement.finalize();}
  });
 }
}

// json.c xRowid is the independent zero-based cursor counter, not JSON id.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 for(const [module,input,predicate,expected] of [
  ['json_each','[10,20,30]','rowid = 1 AND value = 20',1n],
  ['json_each','[10,20,30]','j._rowid_ = 2 AND value = 30',1n],
  ['json_tree','[10,20]','j.oid = 1 AND value = 10',1n],
  ['json_each','[]','rowid = 0',0n],
 ]) {
  test(`JSON EXISTS owns sequential rowid ${module} ${predicate} (${encoding})`,async()=>{
   const builder=new SelectProgramBuilder(),output=builder.register();
   builder.ops.push({code:'Integer',p1:0n,p2:output});
   const program=compileTableSelect(parseSql(`SELECT json('malformed') FROM ${module}('${input}') j WHERE ${predicate} LIMIT 1`).statement,
    {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
    {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
    {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'exists',register:output}});
   builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'Halt'});
   const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
   try {
    for(let run=0;run<2;run++) {
     assert.equal(await statement.step(),'row');assert.equal(statement.column(0),expected);
     assert.equal(await statement.step(),'done');statement.reset();
    }
   }finally{statement.finalize();}
  });
 }
}
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 for(const [sql,expected] of [
  ["SELECT rowid FROM json_each('[10,20,30]') ORDER BY rowid DESC LIMIT 1",2n],
  ["SELECT max(rowid) FROM json_each('[10,20,30]') GROUP BY type",2n],
  ["SELECT max(rowid) FROM json_each('[10,20,30]')",2n],
 ]) test(`JSON rowid survives producer reduction ${sql} (${encoding})`,async()=>{
  const builder=new SelectProgramBuilder(),output=builder.register();builder.ops.push({code:'Null',p2:output});
  const program=compileTableSelect(parseSql(sql).statement,{tables:new Map(),views:new Map()},{encoding},100,10000,10000,
   {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
   {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'mem',register:output,width:1}});
  builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'Halt'});
  const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
  try{for(let run=0;run<2;run++){assert.equal(await statement.step(),'row');assert.equal(statement.column(0),expected);assert.equal(await statement.step(),'done');statement.reset();}}finally{statement.finalize();}
 });
}

for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 test(`JSON rowid direct metadata follows cursor identity (${encoding})`,async()=>{
  for(const name of ['json_each','json_tree','jsonb_each','jsonb_tree']) {
   const program=compileTableSelect(parseSql(`SELECT j.rowid,j._rowid_,j.oid AS n,j.rowid COLLATE binary FROM ${name}('[10,20]') j`).statement,
    {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
    {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000});
   assert.deepEqual(program.columns,[
    {name:'rowid',declaredType:'INTEGER',database:'main',table:name,origin:'rowid'},
    {name:'rowid',declaredType:'INTEGER',database:'main',table:name,origin:'rowid'},
    {name:'n',declaredType:'INTEGER',database:'main',table:name,origin:'rowid'},
    {name:'j.rowid COLLATE binary',declaredType:null,database:null,table:null,origin:null},
   ]);
   const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
   try {for(let run=0;run<2;run++) {
    for(const identity of (name.endsWith('tree')?[0n,1n,2n]:[0n,1n])) {
     assert.equal(await statement.step(),'row');
     assert.deepEqual([0,1,2,3].map(i=>statement.column(i)),[identity,identity,identity,identity]);
    }
    assert.equal(await statement.step(),'done');await statement.reset();
   }} finally {await statement.finalize();}
  }
 });
}

// A nested source pair belongs to the producer too. Exhaustion must release
// both owners before the enclosing program yields its next row.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 for(const [left,right,expected] of [['[1,2]','[7,8]',8n],['[1]','[]',null],['[]','[7]',null]]) {
  test(`JSON source pair refunds on producer return ${left}/${right} (${encoding})`,async()=>{
   const builder=new SelectProgramBuilder(),output=builder.register();
   builder.ops.push({code:'Null',p2:output});
   const program=compileTableSelect(parseSql(`SELECT b.value FROM json_each('${left}') a, json_each('${right}') b`).statement,
    {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
    {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
    {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'mem',register:output,width:1}});
   builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'Halt'});
   const budgets=new Set(),original=PrivateStateByteBudget.prototype.replace;
   PrivateStateByteBudget.prototype.replace=function(...args){budgets.add(this);return original.apply(this,args)};
   const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
   try {for(let run=0;run<2;run++) {
    assert.equal(await statement.step(),'row');assert.equal(statement.column(0),expected);
    assert.ok(budgets.size>0);
    assert.equal([...budgets].reduce((sum,budget)=>sum+budget.usedBytes,0),0,'both source cursors refunded before caller row');
    assert.equal(await statement.step(),'done');statement.reset();
   }} finally {statement.finalize();PrivateStateByteBudget.prototype.replace=original;}
  });
 }
}

// SRT_Exists never evaluates EList, including a multi-source inner loop.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 test(`JSON source pair EXISTS validates without evaluating EList (${encoding})`,async()=>{
  const build=projection=>{
   const builder=new SelectProgramBuilder(),output=builder.register();
   builder.ops.push({code:'Integer',p1:0n,p2:output});
   const program=compileTableSelect(parseSql(`SELECT ${projection} FROM json_each('[1,2]') a, json_each('[7,8]') b`).statement,
    {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
    {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
    {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'exists',register:output}});
   builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'Halt'});
   return {...program,ops:builder.finish(),registers:builder.registers};
  };
  assert.throws(()=>build('b.missing'),error=>error.kind==='sqlite'&&error.code===1&&error.message==='no such column: b.missing');
  const statement=new VdbeStatement(build("json('malformed')"),()=>{},()=>()=>{},()=>{});
  try {for(let run=0;run<2;run++) {
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);
   assert.equal(await statement.step(),'done');statement.reset();
  }} finally {statement.finalize();}
 });
}

// select.c SRT_Exists stores 1 and its scalar LIMIT terminates the loop.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 test(`JSON source pair EXISTS stops and closes before next predicate (${encoding})`,async()=>{
  const builder=new SelectProgramBuilder(),output=builder.register();
  builder.ops.push({code:'Integer',p1:0n,p2:output});
  const program=compileTableSelect(parseSql(`SELECT 1 FROM json_each('[1,2]') a, json_each('["1","bad"]') b WHERE json_extract(b.value,'$')=1`).statement,
   {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
   {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
   {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'exists',register:output}});
  builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'Halt'});
  const budgets=new Set(),original=PrivateStateByteBudget.prototype.replace;
  PrivateStateByteBudget.prototype.replace=function(...args){budgets.add(this);return original.apply(this,args)};
  const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
  try {for(let run=0;run<2;run++) {
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);
   assert.equal([...budgets].reduce((sum,budget)=>sum+budget.usedBytes,0),0,'both Filter owners close before caller resumes');
   assert.equal(await statement.step(),'done');statement.reset();
  }} finally {statement.finalize();PrivateStateByteBudget.prototype.replace=original;}
 });
}

// The enclosing expr.c owner normalizes scalar LIMIT before source entry.
// selectInnerLoop applies OFFSET before SRT_Exists, then decrements that LIMIT.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 for(const [initialCount,initialOffset,input,expected] of [
  [1n,1n,'["1","2","bad"]',1n],
  [1n,9n,'["1","2"]',0n],
  [0n,0n,'malformed',0n],
 ]) {
  test(`JSON source pair consumes prepared EXISTS counters ${initialCount}/${initialOffset} (${encoding})`,async()=>{
   const builder=new SelectProgramBuilder(),output=builder.register(),count=builder.register(),offset=builder.register(),combined=builder.register(),capacity=builder.register();
   builder.ops.push({code:'Integer',p1:0n,p2:output},{code:'Integer',p1:initialCount,p2:count},{code:'Integer',p1:initialOffset,p2:offset},{code:'Integer',p1:initialCount+initialOffset,p2:combined},{code:'Integer',p1:initialCount+initialOffset,p2:capacity});
   const ifZero=builder.ops.length;builder.ops.push({code:'IfNot',p1:count,p2:0});
   const program=compileTableSelect(parseSql(`SELECT json('malformed') FROM json_each('[1]') a, json_each('${input}') b WHERE json_extract(b.value,'$')>0`).statement,
    {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
    {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
    {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'exists',register:output},scalarPrepared:true,sharedLimit:{count,offset,combined,capacity,ifZero}});
   builder.ops.push({code:'ResultRow',p1:output,p2:1},{code:'ResultRow',p1:count,p2:1},{code:'ResultRow',p1:offset,p2:1},{code:'Halt'});
   const budgets=new Set(),original=PrivateStateByteBudget.prototype.replace;
   PrivateStateByteBudget.prototype.replace=function(...args){budgets.add(this);return original.apply(this,args)};
   const statement=new VdbeStatement({...program,ops:builder.finish(),registers:builder.registers},()=>{},()=>()=>{},()=>{});
   try {for(let run=0;run<2;run++) {
    assert.equal(await statement.step(),'row');assert.equal(statement.column(0),expected);
    assert.equal([...budgets].reduce((sum,budget)=>sum+budget.usedBytes,0),0,'all source owners refunded before caller row');
    assert.equal(await statement.step(),'row');assert.equal(statement.column(0),expected===1n?0n:initialCount,'supplied count consumed');
    assert.equal(await statement.step(),'row');assert.equal(statement.column(0),initialOffset===9n?7n:0n,'supplied offset consumed');
    assert.equal(await statement.step(),'done');statement.reset();
   }} finally {statement.finalize();PrivateStateByteBudget.prototype.replace=original;}
  });
 }
}

// jsonEachFilter resets the existing cursor BEFORE the idxNum==0 return.
// Exercise that branch while a row remains positioned, not after EOF/Halt.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 test(`JSON plan-zero re-entry refunds positioned cursor before caller resumes (${encoding})`,async()=>{
  const builder=new SelectProgramBuilder(),output=builder.register();
  const program=compileTableSelect(parseSql("SELECT value FROM json_each('[1,2]')").statement,
   {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
   {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
   {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'mem',register:output,width:1}});
  const rewind=builder.ops.find(op=>op.code==='JsonTableRewind');
  assert.ok(rewind?.input!==undefined);
  // Producer slots identify columns, not materialized values. Read while
  // positioned into an owning destination that survives xClose (OP_VColumn).
  const empty={...rewind,input:undefined,p2:3};
  const ops=[{code:'String',p1:'[1,2]',p2:rewind.input},
   {...rewind,p2:9},empty,{code:'Integer',p1:7n,p2:output},
   {code:'ResultRow',p1:output,p2:1},
   {...rewind,p2:9},{code:'JsonTableColumn',p1:rewind.p1,column:1,p2:output},
   {code:'JsonTableClose',p1:rewind.p1},
   {code:'ResultRow',p1:output,p2:1},{code:'Halt'}];
  const budgets=new Set(),replace=PrivateStateByteBudget.prototype.replace;
  PrivateStateByteBudget.prototype.replace=function(...args){budgets.add(this);return replace.apply(this,args)};
  const statement=new VdbeStatement({...program,ops,registers:builder.registers},()=>{},()=>()=>{},()=>{});
  try {for(let run=0;run<2;run++) {
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),7n);
   assert.ok(budgets.size>0,'initial Filter actually opened a cursor');
   assert.equal([...budgets].reduce((sum,b)=>sum+b.usedBytes,0),0,'plan zero releases before outer continuation');
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n,'same slot can Filter again at first row');
   assert.equal([...budgets].reduce((sum,b)=>sum+b.usedBytes,0),0);
   assert.equal(await statement.step(),'done');statement.reset();
  }} finally {statement.finalize();PrivateStateByteBudget.prototype.replace=replace;}
 });
}

// jsonEachFilter resets the old parse before decoding its replacement input,
// including the malformed-input exit. Observe refund BEFORE the new charge.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 test(`JSON failed Filter replacement releases old owner before parsing (${encoding})`,async()=>{
  const builder=new SelectProgramBuilder(),output=builder.register();
  const program=compileTableSelect(parseSql("SELECT value FROM json_each('[1,2]')").statement,
   {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
   {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
   {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'mem',register:output,width:1}});
  const rewind=builder.ops.find(op=>op.code==='JsonTableRewind');assert.ok(rewind?.input!==undefined);
  const ops=[{code:'String',p1:'[1,2]',p2:rewind.input},{...rewind,p2:8},
   {code:'JsonTableColumn',p1:rewind.p1,column:1,p2:output},
   {code:'ResultRow',p1:output,p2:1},
   {code:'String',p1:'malformed',p2:rewind.input},{...rewind,p2:8},
   {code:'JsonTableColumn',p1:rewind.p1,column:1,p2:output},
   {code:'ResultRow',p1:output,p2:1},{code:'Halt'}];
  const events=[],budgets=new Set(),replace=PrivateStateByteBudget.prototype.replace;
  PrivateStateByteBudget.prototype.replace=function(oldBytes,newBytes,...rest){
   events.push([oldBytes,newBytes,this.usedBytes]);budgets.add(this);
   return replace.call(this,oldBytes,newBytes,...rest);
  };
  const statement=new VdbeStatement({...program,ops,registers:builder.registers},()=>{},()=>()=>{},()=>{});
  try {for(let run=0;run<2;run++) {
   events.length=0;
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);
   assert.ok([...budgets].some(b=>b.usedBytes>0),'old parse remains live while suspended');
   const boundary=events.length;
   let saved;
   await assert.rejects(statement.step(),error=>{saved=error;return error.kind==='sqlite'&&error.code===1&&/malformed JSON/.test(error.message)});
   const replacement=events.slice(boundary);
   assert.ok(replacement.some(([oldBytes,newBytes])=>oldBytes>0&&newBytes===0),'old owner released during replacement');
   const firstNew=replacement.findIndex(([,newBytes])=>newBytes>0);
   assert.ok(firstNew>0,'refund precedes replacement allocation');
   assert.equal(replacement[firstNew][2],0,'replacement starts with no retained old parse');
   assert.equal([...budgets].reduce((sum,b)=>sum+b.usedBytes,0),0,'error cleanup refunds all parses');
   assert.throws(()=>statement.reset(),error=>error===saved,'reset reports saved failure after cleanup');
  }} finally {statement.finalize();PrivateStateByteBudget.prototype.replace=replace;}
 });
}

// Successful xFilter re-entry resets a suspended cursor before its new scan.
for(const encoding of ['utf-8','utf-16le','utf-16be']) {
 test(`JSON successful Filter replacement restarts scan before caller resumes (${encoding})`,async()=>{
  const builder=new SelectProgramBuilder(),output=builder.register();
  const program=compileTableSelect(parseSql("SELECT key,value FROM json_each('[1,2]')").statement,
   {tables:new Map(),views:new Map()},{encoding},100,10000,10000,
   {maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},
   {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'mem',register:output,width:2}});
  const rewind=builder.ops.find(op=>op.code==='JsonTableRewind');assert.ok(rewind?.input!==undefined);
  const saved=builder.range(2);
  const ops=[{code:'String',p1:'[1,2]',p2:rewind.input},{...rewind,p2:12},
   {code:'JsonTableColumn',p1:rewind.p1,column:0,p2:saved},
   {code:'JsonTableColumn',p1:rewind.p1,column:1,p2:saved+1},
   {code:'ResultRow',p1:saved,p2:2},
   {code:'String',p1:'[9,8]',p2:rewind.input},{...rewind,p2:12},
   {code:'JsonTableColumn',p1:rewind.p1,column:0,p2:saved},
   {code:'JsonTableColumn',p1:rewind.p1,column:1,p2:saved+1},
   {code:'ResultRow',p1:saved,p2:2},
   {code:'JsonTableNext',p1:rewind.p1,p2:7,rowStart:rewind.rowStart},
   {code:'JsonTableClose',p1:rewind.p1},{code:'Halt'}];
  const events=[],budgets=new Set(),replace=PrivateStateByteBudget.prototype.replace;
  PrivateStateByteBudget.prototype.replace=function(oldBytes,newBytes,...rest){
   events.push([oldBytes,newBytes,this.usedBytes]);budgets.add(this);
   return replace.call(this,oldBytes,newBytes,...rest);
  };
  const statement=new VdbeStatement({...program,ops,registers:builder.registers},()=>{},()=>()=>{},()=>{});
  try {for(let run=0;run<2;run++) {
   events.length=0;
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),0n);assert.equal(statement.column(1),1n);
   assert.ok([...budgets].some(b=>b.usedBytes>0),'old parse remains live while suspended');
   const boundary=events.length;
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),0n);assert.equal(statement.column(1),9n);
   const replacement=events.slice(boundary);
   assert.ok(replacement.some(([oldBytes,newBytes])=>oldBytes>0&&newBytes===0),'old owner released during replacement');
   const firstNew=replacement.findIndex(([,newBytes])=>newBytes>0);
   assert.ok(firstNew>0,'refund precedes replacement allocation');
   assert.equal(replacement[firstNew][2],0,'replacement starts with no retained old parse');
   assert.ok([...budgets].some(b=>b.usedBytes>0),'new parse remains live until its own scan ends');
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);assert.equal(statement.column(1),8n);
   assert.equal(await statement.step(),'done');
   assert.equal([...budgets].reduce((sum,b)=>sum+b.usedBytes,0),0,'new owner refunded at exhaustion');
   statement.reset();
  }} finally {statement.finalize();PrivateStateByteBudget.prototype.replace=replace;}
 });
}
