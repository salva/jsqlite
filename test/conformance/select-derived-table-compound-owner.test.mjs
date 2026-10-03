import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// select.c:multiSelect and tag-select-0482 share the enclosing Parse/Vdbe.
// This slice gate complements, and does not replace, the broader owner gate.
test('table compound derived producer emits into enclosing coroutine destination',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('  }else if(tableCompoundProducer){');
 assert.ok(start>=0);
 const branch=source.slice(start,source.indexOf('  }else{',start));
 assert.match(branch,/compileSimpleTableCompound\([\s\S]*destination:\{kind:'coroutine'/);
 assert.doesNotMatch(branch,/child\.ops|relocateControlTargets/);
 const lowering=source.slice(source.indexOf('function compileSimpleTableCompound('),source.indexOf('/** select.c SRT_EphemTab'));
 assert.match(lowering,/builder=owner\?\.builder/);
 assert.match(lowering,/owner\?\.destination/);
 assert.match(lowering,/if\(!owner\)ops.push\(\{code:"Halt"\}\)/);
 assert.match(lowering,/isIntegerPrimaryKeyAlias\(item.table,item.column\)/);
});

test('ordered scalar compound derived producer owns wide rows and multiple keys',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('  }else if(setProducer||mixedProducer||ordered){',source.indexOf('function compileDerivedProducer('));
 const branch=source.slice(start,source.indexOf('  }else if(unionProducer||groupedAllProducer)',start))+source.slice(source.indexOf('function emitScalarCompoundMerge('),source.indexOf('function compileDerivedProducer('));
 assert.match(branch,/builder.range\(width\)/);
 assert.match(branch,/child.orderBy.map/);
 assert.match(branch,/emitSelectDestination\(ops,destination,row,width\)/);
 assert.doesNotMatch(branch,/child\.ops|relocateControlTargets/);
});

test('ordered and streaming compound VALUES arms emit every row in parent',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 for(const [begin,end] of [['  }else if(setProducer||mixedProducer||ordered){','  }else if(unionProducer||groupedAllProducer)'],['  }else if(unionProducer||groupedAllProducer){','  }else if(scalarProducer)']]){
  const start=source.indexOf(begin,source.indexOf('function compileDerivedProducer('));
  const branch=source.slice(start,source.indexOf(end,start))+(begin.includes("mixedProducer")?source.slice(source.indexOf("function emitScalarCompoundMerge("),source.indexOf("function compileDerivedProducer(")):"");
  assert.match(branch,/for\(const expressions of arm.valuesRows\?\?\[arm.result\]\)/);
  assert.doesNotMatch(branch,/child\.ops|relocateControlTargets/);
 }
});

test('set and mixed VALUES arms finish intersection after the complete right arm',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('  }else if(setProducer||mixedProducer||ordered)',source.indexOf('function compileDerivedProducer('));
 const branch=source.slice(start,source.indexOf('  }else if(unionProducer||groupedAllProducer)',start))+source.slice(source.indexOf('function emitScalarCompoundMerge('),source.indexOf('function compileDerivedProducer('));
 assert.match(branch,/for\(const expressions of arm.valuesRows\?\?\[arm.result\]\)/);
 assert.match(branch,/operator==='intersect'\|\|operator==='union-all'/);
 assert.match(branch,/explicitCollation/);
 assert.doesNotMatch(branch,/child\.ops|relocateControlTargets/);
});

test('set derived producer compares and yields complete multi-column keys',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('  }else if(setProducer||mixedProducer||ordered)',source.indexOf('function compileDerivedProducer('));
 const branch=source.slice(start,source.indexOf('  }else if(unionProducer||groupedAllProducer)',start))+source.slice(source.indexOf('function emitScalarCompoundMerge('),source.indexOf('function compileDerivedProducer('));
 assert.match(branch,/keyFieldCount:width/);
 assert.match(branch,/builder.range\(width\)/);
 assert.match(branch,/code:'CompareJump'/);
 assert.match(branch,/emitSelectDestination\(ops,destination,row,width\)/);
});

test('represented ordered sets sort prefix and ALL tail before shared limits',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('  }else if(setProducer||mixedProducer||ordered)',source.indexOf('function compileDerivedProducer('));
 const branch=source.slice(start,source.indexOf('  }else if(unionProducer||groupedAllProducer)',start))+source.slice(source.indexOf('function emitScalarCompoundMerge('),source.indexOf('function compileDerivedProducer('));
 assert.match(branch,/root&&limit\?\.offset/);
 assert.match(branch,/keyInfo:mergeKeyInfo/);
 assert.match(branch,/child.hasOrderBy\?child.arms.length-1/);
 assert.doesNotMatch(branch,/child\.ops|relocateControlTargets/);
});

test('grouped derived aggregate delegates complete ORDER list to aggregate owner',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const begin=source.indexOf('function compileDerivedProducer(');
 const guard=source.slice(source.indexOf('  const aggregateProducer=',begin),source.indexOf('\n',source.indexOf('  const aggregateProducer=',begin)));
 assert.doesNotMatch(guard,/aggregateOrder|orderBy.length/);
 const start=source.indexOf('  }else if(aggregateProducer){',begin);
 const branch=source.slice(start,source.indexOf('  }else if(tableProducer)',start));
 assert.match(branch,/compileAggregateSelect\(/);
 assert.match(branch,/destination:\{kind:'coroutine'/);
 assert.doesNotMatch(branch,/relocateControlTargets/);
});

test('zero-source compound DISTINCT admission stays local to single-row SELECT arms',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const begin=source.indexOf('function compileDerivedProducer(');
 for(const name of ['ordered','unionProducer','scalarSetArms']){
  const start=source.indexOf(`  const ${name}=`,begin);
  const guard=source.slice(start,source.indexOf('\n',start));
  assert.match(guard,/!arm.hasDistinct\|\|arm.origin==='select'&&!arm.valuesRows/);
  assert.doesNotMatch(guard,/!derived.select.hasDistinct/);
 }
});

test('aggregate ALL HAVING preserves semantic arm identity and destination ownership',()=>{
 const parser=fs.readFileSync(new URL('../../src/internal/parse.ts',import.meta.url),'utf8');
 assert.match(parser,/having:havingExpr\?Object.freeze/);
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const begin=source.indexOf('function compileDerivedProducer(');
 const start=source.indexOf('  }else if(unionProducer||groupedAllProducer)',begin);
 const branch=source.slice(start,source.indexOf('  }else if(scalarProducer)',start));
 assert.match(branch,/hasHaving:arm.hasHaving,having:arm.having\?\?null/);
 assert.match(branch,/compileAggregateSelect\(armSelect/);
 assert.match(branch,/destination:dest,compoundLimit:\{registers:limit,stops\}/);
 assert.doesNotMatch(branch,/OpenEphemeral|EphemeralRewind/);
 assert.doesNotMatch(branch,/relocateControlTargets|child\.ops/);
});

test('physical compound DISTINCT filters each arm before destination and limits',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const begin=source.indexOf('  const scan=(item:typeof resolved[number]',source.indexOf('function compileSimpleTableCompound('));
 const branch=source.slice(begin,source.indexOf('\n',begin));
 assert.match(branch,/item.arm.hasDistinct\?builder.cursor\(\):undefined/);
 assert.match(branch,/item.table.columns\[item.column\]!\.collation/);
 assert.ok(branch.indexOf('code:"Found"')<branch.indexOf('skip=emitResult()'));
 assert.match(branch,/\(ops\[duplicate\] as \{jump:number\}\).jump=next/);
});

test('physical compound scan rejects unrepresented GROUP/HAVING before emission',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileSimpleTableCompound(');
 const guard=source.indexOf('arm.hasGroupBy||arm.hasHaving',start);
 assert.ok(guard>start);
 assert.ok(guard<source.indexOf('const resolved=select.arms.map',start));
 assert.ok(guard<source.indexOf('const builder=owner?.builder',start));
 assert.match(source.slice(start,guard+250),/unsupportedClassification:"temporary"/);
});

test('grouped ALL owns per-arm GROUP carrier and common exhaustion',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.match(source,/const groupedAllProducer=.*hasCompound/);
 assert.match(source,/groupBy:arm.groupBy\?\?Object.freeze\(\[\]\)/);
 assert.match(source,/if\(parent\?\.compoundLimit\)parent.compoundLimit.stops.push\(\.\.\.groupLimitJumps\)/);
 assert.match(source,/if\(groupLimit&&!parent\?\.compoundLimit\)\(ops\[groupLimit.ifZero\]/);
 const parser=fs.readFileSync(new URL('../../src/internal/parse.ts',import.meta.url),'utf8');
 assert.match(parser,/return\{groupBy,having:havingExpr/);
});

test('mixed grouped ALL ordinary arm uses parent producer and common break',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.match(source,/compileInnerTableSelect\(armSelect,plan.*destination:dest,compoundLimit:\{registers:limit,stops\}/);
 assert.match(source,/if\(owner\?\.compoundLimit\)\{owner.compoundLimit.stops.push\(ops.length\);ops.push\(\{code:'DecrJumpZero'/);
 assert.match(source,/builder.jump\(destinationExit,\{code:'DecrJumpZero'/);
 assert.match(source,/if\(limit&&!owner\?\.compoundLimit\)\(ops\[limit.ifZero\]/);
});

test('grouped compound descriptor production resolves rightmost arm carriers',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.match(source,/if\(tableCompoundProducer\|\|groupedAllProducer\)\{const first=derived.select.arms\[derived.select.arms.length-1\]/);
 assert.match(source,/where:first.where,hasGroupBy:first.hasGroupBy,groupBy:first.groupBy\?\?Object.freeze\(\[\]\),hasHaving:first.hasHaving,having:first.having\?\?null/);
});

test('physical compound derived names and origins have separate semantic owners',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('if(tableCompoundProducer||groupedAllProducer)');
 assert.match(source.slice(start,start+1100),/arms\[derived.select.arms.length-1\]/);
 assert.match(source,/tableCompoundPlan\?\{columns:tableCompoundPlan.result.map\(\(result,index\)=>\(\{name:expressionName\(derived.select.arms\[0\]!.result\[index\]!\),declaredType:result.descriptor.declaredType/);
});

test('specialized joined ordered ALL emits first scan into parent sorter destination',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileJoinedUnionAll('),branch=source.slice(start,source.indexOf('function compileOrderedCteUnionAll(',start));
 assert.match(branch,/new SelectProgramBuilder<Op>/);
 assert.match(branch,/compileInnerTableSelect\(leftSelect.*destination:\{kind:'sorter',cursor:sorterCursor\}/);
 assert.doesNotMatch(branch,/producer\.ops|producer\.registers|producerEnd|relocateControlTargets|p2:op.p2\+1/);
});

test('live ordered ALL composer emits every VALUES row to its destination',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileOrderedCteUnionAll('),branch=source.slice(start,source.indexOf('function compileCteUnionAll(',start));
 assert.match(branch,/hasValues:arm.origin==='values'/);
 assert.match(branch,/compileScalarSelect\(arm,database.encoding/);
 assert.match(branch,/emitSelectDestination\(ops,destination,first,count\)/);

});

test('ordered compound producers retain arm GROUP/HAVING and dispatch groups to aggregate owner',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileOrderedCteUnionAll('),branch=source.slice(start,source.indexOf('function compileCteUnionAll(',start));
 assert.match(branch,/groupBy:arm.groupBy\?\?Object.freeze\(\[\]\),having:arm.having\?\?null/);
 assert.match(branch,/if\(selectHasAggregate\(arm\)\|\|arm.hasGroupBy\)/);
 assert.match(branch,/compileAggregateSelect\(arm.*builder,ops,parameters,destination/);
 assert.match(source,/if\(select.hasCompound\)\{\s*const compiled=compileTableCompoundProducer\([^;]*privateStateLimits,shared\)/);
 assert.match(source,/if\(compiled&&'ops' in compiled\)return compiled/);
 assert.match(source,/ops:shared\.builder\.ops,registers:shared\.builder\.registers[^\n]*columns:compiled\.columns/);
 assert.match(source.slice(source.indexOf('function compileTableCompoundProducer('),source.indexOf('function compileDerivedProducer(')),/if\(select.orderBy.length\)\{[\s\S]*compileOrderedCteUnionAll[\s\S]*rejectUnsupportedSelectClauses/);
});

test('ordered compound collation is first available resolved arm collation with ORDER override',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileOrderedCteUnionAll('),branch=source.slice(start,source.indexOf('function compileCteUnionAll(',start));
 assert.match(branch,/if\(resultCollations\[column\]!==undefined\)continue/);
 assert.match(branch,/const expanded=collationPlan/);
 assert.match(branch,/explicitCollation.*\?\?resultCollations\[orderIndexes\[index\]!\]\?\?'binary'/);
});

test('ordered compound implicit collation consumes resolver-linked source primitive',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileOrderedCteUnionAll('),branch=source.slice(start,source.indexOf('function compileCteUnionAll(',start));
 assert.match(branch,/resolvedExpressionCollation\(expression.reduction!,collationPlan\)/);
 const resolver=fs.readFileSync(new URL('../../src/internal/resolve.ts',import.meta.url),'utf8');
 assert.match(resolver,/use.expression===node/);
 assert.match(resolver,/terminals\[0\]==='\+'/);
});

test('comparison default does not mask right implicit collation or inherit through every child',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('const expressionCollation='),branch=source.slice(start,source.indexOf('const collation=',start));
 assert.match(branch,/x.kind==='cast'\|\|x.kind==='unary'&&x.op==='\+'/);
 assert.doesNotMatch(branch,/x.args.map|expressionCollation\(x.left\)/);
 assert.match(source,/expressionCollation\(left\)\?\?expressionCollation\(right\)\?\?"binary"/);
});

test('scalar NEEDCOLL producer and constant consumer share first available argument contract',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.match(source,/flags.includes\('need-collation'\)/);
 assert.match(source,/for\(const arg of args\)\{const named=expressionCollation\(arg\);if\(named!==undefined\)return named/);
 assert.match(source,/functionArgumentCollation\(expression.name,expression.args\)/);
 assert.match(source,/functionArgumentCollation\(e.name,e.args\)/);
});

test('ordered ALL admits per-arm DISTINCT without compound-wide rejection',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileOrderedCteUnionAll('),branch=source.slice(start,source.indexOf('function compileCteUnionAll(',start));
 assert.doesNotMatch(branch.split('\n')[1],/select.hasDistinct/);
 assert.match(branch,/compileInnerTableSelect\(arm,expanded/);
 assert.match(branch,/arm.hasDistinct&&arm.hasValues/);
});

test('direct and ordinary physical DISTINCT share resolved expression KeyInfo terms',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.equal((source.match(/terms:resolvedResultKeyTerms\(expanded\)/g)||[]).length,2);
 const start=source.indexOf('function resolvedResultKeyTerms('),branch=source.slice(start,source.indexOf('function compileInnerTableSelect(',start));
 assert.match(branch,/resolvedExpressionCollation\(expr,plan\)/);
 assert.match(branch,/sqliteAsciiFold\(named\)/);
 assert.match(branch,/no such collation sequence/);
});

test('unordered retained sets recursively compose source merge coroutine graph',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('  }else if(setProducer||mixedProducer||ordered){');
 assert.ok(start>=0);
 const branch=source.slice(start,source.indexOf('  }else if(unionProducer||groupedAllProducer)',start))+source.slice(source.indexOf('function emitScalarCompoundMerge('),source.indexOf('function compileDerivedProducer('));
 assert.match(branch,/emitMerge\(count-1/);
 assert.match(branch,/code:'CompareJump'/);
 assert.match(branch,/previous-key suppression precedes OFFSET/);
 assert.match(branch,/if\(root&&limit\)/);
 assert.doesNotMatch(branch,/OpenEphemeral|SetDelete|SetRetainIntersection|child\.ops/);
});

test('ordered physical DISTINCT arms compose shared merge and retain arm DISTINCT carrier',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileOrderedCteUnionAll('),branch=source.slice(start,source.indexOf('function compileCteUnionAll(',start));
 assert.match(branch,/!arm.hasDistinct\|\|arm.from.items.length>0/);
 assert.match(branch,/emitScalarCompoundMerge\(\{\.\.\.select,arms:Object.freeze/);
 assert.match(branch,/compileInnerTableSelect\(arm,expanded/);
 const merge=source.slice(source.indexOf('function emitScalarCompoundMerge('));
 assert.match(merge,/hasDistinct:arm.hasDistinct/);
});
test('general transient table uses columnType producer and shared affinity normalization',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function transientSourceTable('),branch=source.slice(start,source.indexOf('function resolveTransientArm(',start));
 assert.match(branch,/transientDeclaredType\(resolvedExpressionDeclaredType/);
 assert.doesNotMatch(branch,/declaredType:column.declaredType/);
});
test('retained derived metadata consumes resolver producer relationship, no independent recursion',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');const start=source.indexOf('function compoundArmColumns('),branch=source.slice(start,source.indexOf('  if(arm.hasValues',start));
 assert.match(branch,/result.descriptor/);assert.doesNotMatch(branch,/columns=compoundArmColumns/);assert.match(branch,/result.resolution!=='direct'/);
});
test('residual compound metadata uses current producer EList without parent projection width',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');const start=source.indexOf('  if(compoundDestinationProducer){'),branch=source.slice(start,source.indexOf('  const alias=',start));
 assert.match(branch,/arms.at\(-1\)/);assert.match(branch,/current.map/);assert.doesNotMatch(branch,/resolveTransientArm\(select,schema\)/);
});
test('coalesce lowers target-before-next argument as expr.c INLINEFUNC_coalesce',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('    if(expression.name==="coalesce"||expression.name==="ifnull")');const branch=source.slice(start,source.indexOf('\n    if(',start+8));
 assert.match(branch,/if\(index\)[\s\S]*NotNull[\s\S]*const value=emit\(arg\)/);
 assert.doesNotMatch(branch,/code:"Null"/);
});
