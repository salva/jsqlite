import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {compileWindowSelectLowering} from '../../src/internal/vdbe.ts';
const column=Object.freeze({name:'a',declaredType:'INTEGER',affinity:'integer',collation:null});
const table=Object.freeze({kind:'table',name:'t1',tableName:'t1',rootPage:2,sql:'',columns:Object.freeze([column]),indexes:Object.freeze([]),withoutRowid:false,primaryKey:[],storageKey:[],nRowLogEst:200});
const schema={tables:new Map([['t1',table]])};
function compile(expression){return compileWindowSelectLowering(expandAndResolveSelect(parseSql(`SELECT a,${expression} FROM t1 ORDER BY a`).statement,schema),'utf-8',{encoding:'utf-8'}).program;}
// window.c1452–1460 /1718–1724 /1930–1955: non-EXCLUDE first/nth
// owns regApp endpoints and csrApp seek, not callback inverse or frame rescans.
for(const expression of [
 'first_value(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)',
 'nth_value(a,2) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)',
])test(`non-EXCLUDE endpoint seek owner: ${expression}`,()=>{
 const program=compile(expression);
 const callback=program.ops.filter(op=>['AggStep','AggInverse'].includes(op.code)&&['first_value','nth_value'].includes(op.name));
 assert.equal(callback.length,0,'first/nth must consume frame endpoints instead of callback full-scan state');
 assert.ok(program.ops.some(op=>op.code==='EphemeralSeekRowid'),'windowReturnOneRow must seek the frame-relative target');
});
test('EXCLUDE CURRENT retains aggregate frame-scan ownership',()=>{
 const program=compile('sum(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING EXCLUDE CURRENT ROW)');
 assert.ok(program.ops.some(op=>op.code==='AggReset'));
 assert.ok(program.ops.some(op=>op.code==='AggStep'&&op.name==='sum'));
 assert.ok(program.ops.some(op=>op.code==='EphemeralNext'));
});
