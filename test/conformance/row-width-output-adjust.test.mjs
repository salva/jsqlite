import test from 'node:test';import assert from 'node:assert/strict';import {parseSql} from '../../src/internal/parse.ts';import {btreeLoops,whereClause,sourceBit} from '../../src/internal/where-plan.ts';
const table=Object.freeze({kind:'table',name:'t',tableName:'t',rootPage:2,szTabRow:16,nRowLogEst:200,hasStat1:false,columns:[],indexes:[],withoutRowid:false,primaryKey:[]}),source=Object.freeze({table,cursorId:0});
function term(sql,id=0){return {id,expression:parseSql(`SELECT 1 WHERE ${sql}`).statement.where,origin:{kind:'where'},operator:sql.includes('=')?'eq':'gt',left:null,rightAffinity:null,effectiveCollation:'binary',originalIndexedOperand:'left',prereqRight:0n,prereqAll:sourceBit(0),parentId:null,childIds:[],virtual:false,outerJoinSafe:{mayDrive:false,mayOmitResidual:false}}}
const scan=terms=>btreeLoops(source,0,whereClause(terms),{forcedIndex:null,neededColumns:new Set(),orderBy:[]})[0];
for(const [sql,expected] of [['a=0',190n],['a=1',190n],['a=-1',190n],['a=2',180n],['a=?1',180n],['a>2',199n]])test(`source full-scan residual ${sql}`,()=>{const loop=scan([term(sql)]);assert.equal(loop.outputRows,expected);assert.equal(loop.runCost,216n)});
test('residual prerequisite and virtual branches skip unavailable terms',()=>{assert.equal(scan([{...term('a=2'),prereqAll:3n}]).outputRows,200n);assert.equal(scan([{...term('a=2'),virtual:true}]).outputRows,200n)});
test('multiple residuals subtract each then clamp against strongest equality',()=>assert.equal(scan([term('a>2'),term('a=2',1),term('a=1',2)]).outputRows,180n));

for(const [sql,expected] of [['a=(1)',190n],['a=+(-1)',190n],['a=-(-1)',190n],['a=0x0001',190n],['a=0xffffffffffffffff',180n],['a=2147483648',180n],['a=1+0',180n],['a=1.0',180n]])test(`EP_IntValue residual ${sql}`,()=>assert.equal(scan([term(sql)]).outputRows,expected));
test('foreign-only and no-self residual terms skipped',()=>assert.equal(scan([{...term('a=2'),prereqAll:2n}]).outputRows,200n));
test('admitted IPK equality and its virtual parent are not residual decrements',()=>{
 const parent=term('a=2',0),used={...term('a=2',1),virtual:true,parentId:0,left:{source,sourceOrdinal:0,column:null,columnIndex:-1,rowid:true},outerJoinSafe:{mayDrive:true,mayOmitResidual:true}};
 const loop=scan([parent,used]);assert.equal(loop.kind,'rowid');assert.equal(loop.outputRows,0n);
});
test('residual single-row output may become negative, without changing IPK work',()=>{
 const used={...term('a=2'),left:{source,sourceOrdinal:0,column:null,columnIndex:-1,rowid:true},outerJoinSafe:{mayDrive:true,mayOmitResidual:true}};
 const base=scan([used]),filtered=scan([used,term('a>2',1)]);assert.equal(base.outputRows,0n);assert.equal(filtered.outputRows,-1n);assert.equal(filtered.runCost,base.runCost);
});
