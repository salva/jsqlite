import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {productions} from '../../src/generated/parser-tables.ts';
import {expandAndResolveSelect,NameResolutionError} from '../../src/internal/resolve.ts';
const columns=[{name:'x',declaredType:'INTEGER',affinity:'integer',collation:null}];
const schema={tables:new Map([['a',{kind:'table',name:'a',tableName:'a',rootPage:2,sql:'',columns,indexes:[],withoutRowid:false,primaryKey:[],storageKey:[]}]])};
const pairs=[['-1_0','-10',true],['1_0','10',true],['0x1_0','16',true],['1_0.0','10.0',true],['1e1_0','1e10',true],['1_0.0','10',false],['1_0.0','1e1',false],['1_0','11',false],['-1_0','+10',false],["'1_0'","'10'",false]];
for(const [a,b,equal] of pairs)test(`canonical numeric compound identity ${a} vs ${b}`,()=>{
 const sql=`SELECT a.x+(${a}) FROM a UNION ALL SELECT a.x FROM a ORDER BY x+(${b})`;
 const resolve=()=>expandAndResolveSelect(parseSql(sql).statement,schema);
 if(equal)assert.doesNotThrow(resolve);else assert.throws(resolve,NameResolutionError);
});
test('numeric canonical production retains source spelling and actual Lemon trace',()=>{
 const parsed=parseSql('SELECT 1_0,10,1_0.0,10.0');
 const term=n=>n.kind==='reduction'&&n.signature.startsWith('term ::=')?n:n.children?.map(term).find(Boolean);
 const terms=parsed.statement.result.map(x=>term(x.reduction));
 assert.equal(terms[0].signature,terms[1].signature);assert.equal(terms[0].rule,terms[1].rule);
 assert.equal(terms[2].signature,terms[3].signature);assert.equal(terms[2].rule,terms[3].rule);
 assert.equal(parsed.statement.result[0].sourceText,'1_0');assert.ok(parsed.lemon.reductions.includes(productions.find(p=>p.signature==='term ::= QNUMBER').id));
});
