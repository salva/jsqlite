import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere} from '../../src/internal/where-plan.ts';
import {emitSelectedInRhs,selectedVectorInStorage} from '../../src/internal/where-in-producer.ts';
import {physicalIndex,columnTypeEstimate,sqliteLogEst} from '../../src/internal/schema.ts';
import {compileScalarSelect,VdbeStatement} from '../../src/internal/vdbe.ts';
import {SelectProgramBuilder,emitSelectDestination} from '../../src/internal/select-program.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {beginInLoop,finishInLoops} from '../../src/internal/where-in-loop.ts';
function rhs(sql){
 const resolved=expandAndResolveSelect(parseSql(sql).statement,{objects:[]});
 const carrier=analyzeWhere(resolved).clause.terms.find(t=>t.inSelectRhs)?.inSelectRhs;
 assert.ok(carrier);return carrier;
}
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`${encoding}: selected RHS construction shares destination and exact linked identity, no membership tail`,()=>{
 const carrier=rhs('SELECT ?3 WHERE 1 IN (SELECT ?2 WHERE ?1)');
 const builder=new SelectProgramBuilder();builder.reserveCursorsThrough(40);builder.range(20);
 const info=new KeyInfo({encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:'nocase'}]});
 let calls=0;
 const set=emitSelectedInRhs(builder,carrier,info,'numeric',(resolved,destination)=>{
  calls++;assert.equal(resolved,carrier.resolved);assert.equal(resolved.source,carrier.select);
  assert.equal(destination.cursor,41);assert.equal(destination.packedRegister,22);
  // This witness stands in for child row production, not RHS execution. The
  // real SRT_Set emitter below owns affinity, MakeRecord and unique insertion.
  emitSelectDestination(builder.ops,destination,10,1);
 });
 assert.equal(calls,1);assert.equal(set.rhs,carrier);assert.equal(set.keyInfo,info);
 assert.equal(set.cursor,41);assert.equal(set.onceRegister,21);assert.equal(builder.cursors,42);assert.equal(builder.registers,22);
 assert.deepEqual(builder.ops.map(op=>op.code),['Once','OpenEphemeral','Affinity','MakeRecord','IdxInsert']);
 assert.equal(builder.ops[0].p2,5);assert.equal(builder.ops[1].p4KeyInfo,info);
 assert.equal(builder.ops[4].p1,set.cursor);assert.equal(builder.ops[4].consumeRecord,true);
 assert.deepEqual(carrier.parameterOccurrences.map(t=>t.text),['?2','?1']);
 assert.ok(Object.isFrozen(set));assert.ok(Object.isFrozen(set.destination.affinities));
 const loop=beginInLoop(builder.ops,set.cursor,23,false);
 const exit=builder.ops.length+1;finishInLoops(builder.ops,[loop],exit);
 assert.equal(builder.ops[0].p2,loop.start,'Once resumes at positioning, not past it');
 assert.equal(builder.ops[loop.start].p1,set.cursor);
 assert.equal(builder.finish().some(op=>op.code==='InSet'),false,'selected LOOP cannot execute a membership tail');
});
test('LOOP physical vector mapping uses distinct RHS columns, exact collation and uniqueness',()=>{
 const columns=['x','y'].map(name=>({name,declaredType:'',affinity:'blob',szEst:columnTypeEstimate('').szEst,collation:null,primaryKeyPosition:null}));
 const table={kind:'table',name:'rhs',tableName:'rhs',rootPage:2,columns,indexes:[],withoutRowid:false,primaryKey:[],storageKey:[],sql:'',nRowLogEst:200,hasStat1:false,szTabRow:33};
 const index={kind:'index',name:'rhs_yx',tableName:'rhs',rootPage:3,table,terms:[columns[1],columns[0]].map(column=>({column,expression:null,expressionSql:null,descending:true,collation:null,nulls:null})),unique:true,partialWhere:null,origin:'create',rowLogEst:[200,33,0],szIdxRow:33,hasStat1:false,unordered:false,noSkipScan:false,sql:''};
 index.physical=physicalIndex(index,'utf-8');table.indexes.push(index);
 const schema={tables:new Map([['rhs',table]])};
 const carrier=sql=>analyzeWhere(expandAndResolveSelect(parseSql(sql).statement,schema)).clause.terms.find(term=>term.inSelectRhs).inSelectRhs;
 const analysis=analyzeWhere(expandAndResolveSelect(parseSql('SELECT 1 FROM rhs WHERE (x,y) IN (SELECT y,x FROM rhs)').statement,schema));
 const slices=analysis.clause.terms.filter(term=>term.inField!==undefined);
 assert.deepEqual(slices.map(term=>term.inField),[0,1]);assert.equal(slices[0].inSelectRhs,slices[1].inSelectRhs);
 assert.deepEqual(slices.map(term=>term.left.column.name),['x','y']);
 assert.ok(slices.every(term=>term.virtual&&term.parentId!==null&&!term.outerJoinSafe.mayOmitResidual));
 const rhs=carrier('SELECT 1 WHERE (1,2) IN (SELECT x,y FROM rhs)');
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
 const storage=selectedVectorInStorage(rhs,info,['blob','blob']);
 assert.equal(storage.kind,'index');assert.equal(storage.physical,index.physical);assert.equal(storage.descending,true);assert.deepEqual(storage.fieldMap,[1,0]);assert.ok(Object.isFrozen(storage.fieldMap));
 const builder=new SelectProgramBuilder();
 const set=emitSelectedInRhs(builder,rhs,info,['blob','blob'],()=>assert.fail('physical cursor must not materialize'),storage);
 assert.deepEqual(set.fieldMap,[1,0]);assert.equal(set.keyInfo,index.physical.keyInfo);assert.deepEqual(builder.ops.map(op=>op.code),['Once','OpenIndex']);
 const repeated=carrier('SELECT 1 WHERE (1,2) IN (SELECT x,x FROM rhs)');
 assert.equal(selectedVectorInStorage(repeated,info,['blob','blob']).kind,'ephemeral');
 index.unique=false;assert.equal(selectedVectorInStorage(rhs,info,['blob','blob']).kind,'ephemeral');index.unique=true;
 const mismatch=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{collation:'nocase'},{}]});
 assert.equal(selectedVectorInStorage(rhs,mismatch,['blob','blob']).kind,'ephemeral');
});
test('vector SRT_Set retains linked width, affinities and original parameter inventory',()=>{
 const carrier=rhs('SELECT 1 WHERE (1,2) IN (SELECT ?2,?1)');
 assert.equal(carrier.scalar,false);assert.equal(carrier.resolved.result.length,2);
 const builder=new SelectProgramBuilder();
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{collation:'nocase'},{collation:'binary'}]});
 const affinities=['text','numeric'];let called=false;
 const set=emitSelectedInRhs(builder,carrier,info,affinities,(resolved,destination)=>{
  called=true;assert.equal(resolved,carrier.resolved);assert.equal(destination.width,2);
  assert.deepEqual(destination.affinities,affinities);
  emitSelectDestination(builder.ops,destination,10,2);
 });
 assert.ok(called);affinities[0]='blob';assert.deepEqual(set.destination.affinities,['text','numeric']);
 assert.deepEqual(carrier.parameterOccurrences.map(t=>t.text),['?2','?1']);
 assert.equal(builder.ops.find(op=>op.code==='MakeRecord').p2,2);
 assert.equal(builder.ops[0].p2,builder.ops.length);
 assert.equal(builder.ops.filter(op=>op.code==='IdxInsert').length,1);
 const invalid=new SelectProgramBuilder();
 assert.throws(()=>emitSelectedInRhs(invalid,carrier,info,['blob'],()=>assert.fail()),/matching field/);
 assert.equal(invalid.cursors,0);assert.deepEqual(invalid.ops,[]);
});
test('correlated producer rebuilds an invocation-owned set without Once',()=>{
 const scalar=rhs('SELECT 1 WHERE 1 IN (SELECT ?1)');
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const builder=new SelectProgramBuilder();let calls=0;
 emitSelectedInRhs(builder,{...scalar,correlated:true,prereq:1n},info,'blob',()=>calls++);
 assert.equal(calls,1);assert.equal(builder.ops.filter(op=>op.code==='Once').length,0);
 assert.equal(builder.ops[0].code,'OpenEphemeral');
});
test('unsupported RHS fails before allocation/publication; child compile error remains primary',()=>{
 const scalar=rhs('SELECT 1 WHERE 1 IN (SELECT ?1)');
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 for(const changed of [{scalar:false}]){
  const builder=new SelectProgramBuilder();
  assert.throws(()=>emitSelectedInRhs(builder,{...scalar,...changed},info,'blob',()=>assert.fail('child must not compile')),/field contract/);
  assert.equal(builder.cursors,0);assert.equal(builder.registers,0);assert.deepEqual(builder.ops,[]);
 }
 const primary=new Error('child SELECT compile failure'),builder=new SelectProgramBuilder();
 assert.throws(()=>emitSelectedInRhs(builder,scalar,info,'blob',()=>{throw primary}),e=>e===primary);
 // Failed prepare discards its builder, not a usable partially compiled set.
 assert.equal(builder.ops.length,2);
});
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`${encoding}: original linked scalar SELECT compiler feeds LOOP destination with retained parameter slots and LIMIT`,async()=>{
 const carrier=rhs('SELECT ? WHERE 1 IN (SELECT ? WHERE ? LIMIT ?)');
 const builder=new SelectProgramBuilder();
 const tokens=carrier.parameterOccurrences;
 // Enclosing prepare has already assigned the outer anonymous occurrence to
 // slot1. Use its real positional map so child lowering must not renumber.
 const parameters={maximum:4,names:[null,null,null,null],named:new Map(),positions:new Map(tokens.map((token,index)=>[token.startByte,index+2]))};
 const info=new KeyInfo({encoding,totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const limits={maxEntries:100,maxKeyBytes:10000,maxBytes:1000000};
 const set=emitSelectedInRhs(builder,carrier,info,'numeric',(resolved,destination)=>{
  compileScalarSelect(resolved.source,encoding,100000,100000,limits,undefined,undefined,100,{
   builder,parameters,destination,linkedPlan:resolved,
   emitRow:(first,count)=>emitSelectDestination(builder.ops,destination,first,count),
  });
 });
 const ops=builder.ops;
 assert.deepEqual(ops.filter(op=>op.code==='Variable').map(op=>op.p1).sort(),[2,3,4]);
 assert.equal(parameters.maximum,4);assert.equal(parameters.positions.size,3);
 assert.equal(ops.filter(op=>op.code==='IdxInsert').length,1);
 assert.equal(ops.find(op=>op.code==='IdxInsert').p1,set.cursor);
 assert.equal(ops.filter(op=>op.code==='MakeRecord').length,1);
 assert.equal(ops[0].p2,ops.length);
 assert.ok(ops.some(op=>op.code==='IfNot'),'child WHERE/LIMIT controls are retained');
 assert.equal(ops.some(op=>op.code==='ResultRow'||op.code==='InSet'),false);
 // Execute the actual compiled child (including anonymous slots/WHERE/LIMIT)
 // through existing VDBE membership, independently of missing LOOP dispatch.
 const key=builder.register(),found=builder.register();
 ops.push({code:'Variable',p1:2,p2:key},{code:'Integer',p1:0n,p2:found});
 const check=ops.length;ops.push({code:'Found',p1:set.cursor,keyStart:key,keyCount:1,jump:check+2},{code:'Goto',p2:check+3},{code:'Integer',p1:1n,p2:found},{code:'ResultRow',p1:found,p2:1},{code:'Halt'});
 const statement=new VdbeStatement({encoding,registers:builder.registers,parameters:parameters.names.map(name=>({name})),columns:[{name:'found'}],maxWorkUnits:100000,maxResultBytes:100000,privateStateLimits:limits,ops:builder.finish()},()=>{},()=>()=>{},()=>{});
 try{
  for(const [value,where,limit,expected] of [[7n,1n,1n,1n],[9n,0n,1n,0n],[8n,1n,0n,0n],[11n,1n,1n,1n]]){
   statement.bind(2,value);statement.bind(3,where);statement.bind(4,limit);
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),expected);
   await statement.reset();
  }
 }finally{await statement.finalize()}
});
