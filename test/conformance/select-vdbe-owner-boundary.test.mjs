import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
const derived=source.slice(source.indexOf('function compileDerivedProducer('),source.indexOf('function compileRepeatedImmutableView('));
test('migrated live joined ordered and mixed physical ALL producers consume parent destinations',()=>{
 for(const name of ['joinedOrderedAllProducer','mixedPhysicalAllProducer']){
  const branch=derived.match(new RegExp(`else if\\(${name}\\)\\{([\\s\\S]*?)\\n  \\}else`));
  assert.ok(branch,`${name} parent branch`);
  assert.match(branch[1],/builder,parameters,destination:/);
  assert.match(branch[1],/EndCoroutine/);
  assert.doesNotMatch(branch[1],/child.ops|pcMap|relocateControlTargets/);
 }
});
test('live compound-derived aggregate ordinary arms are not completed-child splices',()=>{
 const aggregate=source.slice(source.indexOf('function compileCompoundDerivedAggregate('),source.indexOf('function compileZeroSourceDerivedCount('));
 assert.doesNotMatch(aggregate,/const children=derived.select.arms.map/,'public count over physical/scalar ALL still compiles finished arm Programs');
 assert.match(aggregate,/kind:'coroutine',register:producerReturn,first:producerRows/);
 assert.match(aggregate,/code:'Yield',p1:producerReturn/);
 assert.doesNotMatch(aggregate,/OpenEphemeral|EphemeralRewind/,'streaming ALL source must not allocate a private row store');
 assert.doesNotMatch(aggregate,/child.ops|original.p1|p2:op.p2\+base/);
});

test('remaining generic derived and window fallback ownership is tracked',()=>{
 assert.doesNotMatch(derived,/pcMap/,'live generic derived fallback still copies completed child; migration incomplete');
 assert.doesNotMatch(source,/const sourceProgram=coroutineProducer/,'recursive window completed producer retired');
});

test('ordinary mixed ALL delegates arm DISTINCT to existing ordinary producer owner',()=>{
 const admission=derived.match(/const mixedPhysicalAllProducer=([^;]+);/);
 assert.ok(admission);
 // DISTINCT belongs to selectInnerLoop/codeDistinct, not compound dispatch.
 assert.doesNotMatch(admission[1],/!arm.hasDistinct/,'admitted DISTINCT physical/scalar ALL still misses shared destination owner');
 const composer=source.slice(source.indexOf('function compileCteUnionAll('),source.indexOf('function compileSimpleTableCompound('));
 assert.doesNotMatch(composer,/select.offset\|\|select.hasDistinct/);
 assert.match(composer,/compileInnerTableSelect\(arm,expanded/);
 assert.match(composer,/arm.hasDistinct&&arm.origin==='values'/);
 const ordinary=source.slice(source.indexOf('function compileInnerTableSelect('),source.indexOf('function compileJoinedUnionAll('));
 assert.match(ordinary,/if\(select.hasDistinct\)ops.push/);
 assert.match(ordinary,/resolvedResultKeyTerms\(expanded/);
});

test('mixed ordinary ALL owns compound LIMIT in enclosing destination producer',()=>{
 const admission=derived.match(/const mixedPhysicalAllProducer=([^;]+);/);
 assert.ok(admission);
 assert.doesNotMatch(admission[1],/!derived.select.limit|!derived.select.offset/,'live limited mixed ALL still copies completed child');
 const composer=source.slice(source.indexOf('function compileCteUnionAll('),source.indexOf('function compileSimpleTableCompound('));
 assert.match(composer,/compoundLimit:/,'shared compound limit must be passed into ordinary scan owner');
});

test('supported grouped window source emits on enclosing builder instead of sourceProgram copying',()=>{
 const windowOwner=source.slice(source.indexOf('function compileWindowSelectLowering('),source.indexOf('export function compileRecursiveCteSelect('));
 assert.doesNotMatch(windowOwner,/return compileAggregateSelect\(producer,schema,database,Number.MAX_SAFE_INTEGER,maxWorkUnits,maxResultBytes,privateStateLimits\);/,'grouped window builds completed AggInfo Program before source coroutine');
 const grouped=windowOwner.slice(windowOwner.indexOf('  }else if(groupedProducer){'),windowOwner.indexOf('  }else if(recursiveProducer){'));
 assert.match(grouped,/destination:\{kind:'coroutine',register:sourceCoroutine,first:groupedPayload\}/);
 assert.match(grouped,/builder.registers=registers/);
 assert.match(grouped,/registers=builder.registers/);
 assert.match(grouped,/builder.reserveCursorsThrough/);
 assert.doesNotMatch(grouped,/sourceProgram|pcMap|registerOffset|cursorOffset/);
 assert.match(windowOwner,/compileRecursiveCteSelect\(recursiveProducer.select/,'recursive source uses existing owner destination');

});

test('admitted recursive window source owns enclosing coroutine destination, not completed Program splice',()=>{
 const caller=source.slice(source.indexOf('export function compileRecursiveWindowSelect('),source.indexOf('/** Compose multiple bounded recursive producers'));
 const windowOwner=source.slice(source.indexOf('export function compileWindowSelectLowering('),source.indexOf('export function compileRecursiveCteSelect('));
 assert.match(caller,/transient,\{select,maxRows\}/);
 assert.match(windowOwner,/compileRecursiveCteSelect\(recursiveProducer.select[\s\S]*?\{builder,parameters,destination:/);
 assert.match(windowOwner,/ops:owner\?ops:builder.finish\(\)/,'publication must resolve recursive Queue empty label');
 assert.doesNotMatch(caller,/const producer=compileRecursiveCteSelect/,'live public recursive window caller compiles completed source Program');
 assert.doesNotMatch(windowOwner,/const sourceProgram=coroutineProducer|registerOffset|cursorOffset|pcMap/,'window source destination still rewrites completed op stream');
});

test('admitted ordered aggregate ALL emits arms and derived destination in enclosing builder',()=>{
 const aggregate=source.slice(source.indexOf('export function compileAggregateSelect('));
 assert.doesNotMatch(aggregate,/const armPrograms=|for\(const program of armPrograms\)/);
 assert.match(aggregate,/compileAggregateSelect\(single[\s\S]*?\{builder,ops,parameters,destination:\{kind:"sorter"/);
 const branch=derived.match(/else if\(orderedAggregateProducer\)\{([\s\S]*?)\n  \}else/);
 assert.ok(branch);assert.match(branch[1],/builder,ops,parameters,destination:/);
 assert.doesNotMatch(branch[1],/child.ops|pcMap|relocateControlTargets/);
 assert.match(derived,/orderedAggregateColumns\?/,'metadata must not compile a discarded child Program');
});

test('residual physical compound consumes the production multiSelect dispatch without a child Program',()=>{
 const branch=derived.match(/else if\(compoundDestinationProducer\)\{([\s\S]*?)\n  \}else/);assert.ok(branch);
 assert.match(branch[1],/compileTableCompoundProducer\([\s\S]*builder,parameters,destination:/);
 assert.doesNotMatch(branch[1],/child.ops|pcMap/);
 assert.match(source.slice(source.indexOf('export function compileTableSelect(')),/const compiled=compileTableCompoundProducer\([^;]*privateStateLimits,shared\)/);
 assert.match(source,/ops:shared\.builder\.ops,registers:shared\.builder\.registers[^\n]*columns:compiled\.columns/,'shared compound publication keeps the owning builder and metadata');
 assert.match(derived,/const inner=nestedProducer\?\{columns:compoundArmColumns[\s\S]*:residualCompoundColumns\?\{columns:residualCompoundColumns/);
});

test('residual compound transient descriptor production does not compile a CTE metadata Program',()=>{
 const metadata=source.slice(source.indexOf('function compoundArmColumns('),source.indexOf('function compileTableCompoundProducer('));
 assert.match(metadata,/arm.from.cteDerived/);
 assert.match(metadata,/resolveTransientArm/);assert.match(metadata,/producerColumns=compoundArmColumns/);
 assert.doesNotMatch(metadata,/compileTableSelect|compileScalarSelect|\.ops|pcMap/);
 const transient=source.slice(source.indexOf('function transientSourceTable('),source.indexOf('function transientResultCollations('));
 assert.match(transient,/uniqueTransientColumnNames/);assert.match(transient,/compoundArmColumns/);
 assert.match(transient,/bindings.set[\s\S]*transientSourceTable/);
 assert.doesNotMatch(transient,/compileTableSelect|compileScalarSelect|\.ops|pcMap/);
 const cte=source.slice(source.indexOf('    const sources=arm.from.cteDerived;',source.indexOf('function compileCteUnionAll(')),source.indexOf('function compileSimpleTableCompound('));
 assert.match(cte,/if\(physical\)compileInnerTableSelect[\s\S]*destination:\{kind:'ephemeral'/);
 assert.doesNotMatch(cte,/pcMap|child.ops/);
 assert.match(derived,/names=compoundArmColumns\(armNode\(derived.select.arms\[0\]/);assert.match(derived,/current=compoundArmColumns\(armNode\(derived.select.arms.at\(-1\)/);
});

test('residual aggregate compound forwards the production arm accumulator owner',()=>{
 const admission=derived.slice(derived.indexOf('const compoundDestinationProducer='),derived.indexOf('let residualCompoundColumns:'));
 assert.doesNotMatch(admission,/!selectHasAggregate/);
 const all=source.slice(source.indexOf('function compileCteUnionAll('),source.indexOf('function compileSimpleTableCompound('));
 assert.match(all,/if\(selectHasAggregate\(arm\)\|\|arm\.hasGroupBy\|\|arm\.hasHaving\)\{[\s\S]*compileAggregateSelect\(arm,[\s\S]*builder,ops,parameters,destination/);
});

test('persistent compound scan admission preserves transient SrcItem ownership',()=>{
 const ordinary=source.slice(source.indexOf('function compileSingleCompoundDerived('),source.indexOf('function compoundArmColumns('));
 assert.match(ordinary,/arms.some\(arm=>arm.from.derived\|\|arm.from.cteDerived\?\.length/);
 assert.match(derived,/const tableCompoundProducer=[^\n]*!arm.from.derived&&!arm.from.cteDerived\?\.length/);
});

test('window lowering preserves compound owner before rewriting its first arm',()=>{
 const lower=source.slice(source.indexOf('export function compileWindowSelectLowering('));
 assert.ok(lower.indexOf('if(resolved.source.hasCompound)throw')<lower.indexOf('const rewrite=sqlite3WindowRewrite(resolved,owner?.builder)'));
});

test('window compound arms share allocation, parameters, destination and explicit exit',()=>{
 assert.match(source,/const parameters:ParameterBuilder=owner\?\.parameters\?\?/);
 assert.match(source,/compileWindowSelectLowering\(expanded,[^\n]*builder,parameters,destination/);
 assert.match(source,/if\(owner\)\{[\s\S]*?owner\.builder\.registers=Math\.max\(owner\.builder\.registers,registers\);[\s\S]*?\(ops\[ownerExit\] as \{p2:number\}\)\.p2=ops\.length/);
 assert.match(source,/ends:number\[\]=compilation.ownerExit/);
});

test('ordinary derived flatten production is shared by descriptor and compound arm callers',()=>{
 assert.match(source,/as SelectNode\)\)\.map\(flattenOrdinaryDerived\)/);
 assert.match(source,/function compoundArmColumns[^\n]*\{\n  arm=flattenOrdinaryDerived\(arm\)/);
 assert.match(source,/const flattened=flattenOrdinaryDerived\(select\)/);
});

test('parser never erases single-source renamed projection solely for absent alias',()=>{
 const parse=fs.readFileSync(new URL('../../src/internal/parse.ts',import.meta.url),'utf8');
 assert.match(parse,/\(select\.from\.items\.length!==1\|\|directProjection\)/);
});

test('retained derived compound arms call existing shared destination before schema resolution',()=>{
 const dispatch=source.slice(source.indexOf('function compileCteUnionAll('),source.indexOf('function compileSimpleTableCompound('));
 assert.match(dispatch,/else if\(arm\.from\.derived\)\{[\s\S]*?compileDerivedProducer\(arm,[\s\S]*?builder,parameters,destination[\s\S]*?else if\(arm\.from\.items/);
});

test('retained physical source feeds window payload without a finished child splice',()=>{
 const window=source.slice(source.indexOf('export function compileWindowSelectLowering('),source.indexOf('export function programOpcodeNames('));
 const branch=window.slice(window.indexOf('if(owner?.retainedSource){'),window.indexOf('}else if(groupedProducer){'));
 assert.match(branch,/const destination:SelectDest=\{kind:'coroutine'/);
 assert.match(branch,/compileInnerTableSelect\([\s\S]*\{builder,ops,parameters,destination\}/);
 assert.match(branch,/compileTableCompoundProducer\([\s\S]*\{builder,parameters,destination\}/);
 assert.match(branch,/groupedPayload=builder.range\(owner.retainedSource.result.length\)/);
 assert.match(branch,/EndCoroutine/);
 assert.doesNotMatch(branch,/child.ops|pcMap|compileTableSelect\(/);
 assert.match(window,/kind:'register',register:groupedPayload\+ref.columnIndex,phase:'producer-row'/);
 assert.match(window,/ownedFilter.filterCarrier/);
});

test('nested retained child delegates same builder coroutine instead of synthetic table scan',()=>{
 const branch=derived.match(/else if\(nestedProducer\)\{([\s\S]*?)\n  \}else/);assert.ok(branch);
 assert.match(branch[1],/compileDerivedProducer\([\s\S]*builder,parameters,destination:\{kind:'coroutine'/);
 assert.doesNotMatch(branch[1],/child.ops|pcMap|compileTableSelect/);
});

test('residual retained producer metadata and emission use semantic owners on one builder',()=>{
 const fallback=derived.slice(derived.indexOf('// select.c sqlite3Select dispatches semantic SELECT owners'),derived.indexOf('  const consumer='));
 assert.match(fallback,/emitScalarCompoundMerge\([\s\S]*builder,parameters,destination/);
 assert.match(fallback,/compileTableCompoundProducer\([\s\S]*builder,parameters,destination/);
 assert.match(fallback,/compileAggregateSelect\([\s\S]*builder,ops,parameters,destination/);
 assert.match(fallback,/compileInnerTableSelect\([\s\S]*builder,ops,parameters,destination/);
 assert.match(fallback,/compileScalarSelect\([\s\S]*builder,parameters,emitRow:/);
 assert.match(fallback,/EndCoroutine/);
 assert.doesNotMatch(fallback,/child.ops|pcMap|relocateControlTargets|compileTableSelect/);
 const metadata=derived.slice(derived.indexOf('  const inner=nestedProducer'),derived.indexOf('  const alias='));
 assert.match(metadata,/compoundArmColumns\(derived.select,schema\)/);
 assert.doesNotMatch(metadata,/compileTableSelect|compileScalarSelect/);
});
test('recursive aggregate and zero-source count consume source destinations before Program publication',()=>{
 const recursive=source.slice(source.indexOf('export function compileRecursiveAggregateSelect('),source.indexOf('export function compileRecursiveWindowSelect('));
 const count=source.slice(source.indexOf('// Retain this count-only admission;'),source.indexOf('export function compileAggregateSelect('));
 for(const owner of [recursive,count]){
  assert.doesNotMatch(owner,/producer\.ops|original\.code|op\.code/,'completed opcode rewriting is not a SELECT destination');
  assert.match(owner,/builder\.finish\(\)/);
 }
 assert.match(count,/aggregate-expression/);
 assert.doesNotMatch(recursive,/aggregate-expression|OpenRead/);
 assert.match(recursive,/prepareRecursiveSource\(select,owner,schema\)/);
 assert.match(recursive,/compileRecursiveCteSelect\([\s\S]*true,\{builder,parameters,destination:\{kind:'coroutine',register:coroutine,first\}\}/);
 assert.match(recursive,/EndCoroutine[\s\S]*Yield[\s\S]*consume\(\)/);
 assert.match(recursive,/compileAggregateSelect\([\s\S]*\{builder,ops,parameters,linkedPlan,input,destination:shared\?\.destination/);
 assert.match(recursive,/parameters:Object\.freeze\(parameters\.names/);
 const grouped=source.slice(source.indexOf(' if(select.hasGroupBy){',source.indexOf('export function compileAggregateSelect(')),source.indexOf(' // select.c:resetAccumulator precedes WHERE positioning'));
 assert.match(grouped,/if\(!parent\?\.input&&groupedStream\)/);
 assert.match(grouped,/else if\(!parent\?\.input\)\{[\s\S]*OpenRead/);
 assert.match(grouped,/parent\.input\.emit\(insertGroupedRow\)/);
 assert.match(grouped,/inputReject[\s\S]*SorterInsert[\s\S]*inputReject/);
 assert.match(grouped,/streamScan===undefined&&!parent\?\.input/);
});
