import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';import {openFixture} from './public-api-adapter.mjs';
const contract=JSON.parse(fs.readFileSync(new URL('./cases/stage3-compound-values.json',import.meta.url)));
const fixtures={empty:'empty',metadata:'compound-metadata',collation:'compound-collation'};
const bridge=await startFixtureServer(path.resolve('test/fixtures'));let passed=0,credited=0;
const declaredOperations=c=>c.operations.map((op,index)=>({index,op}));
const validateEligibility=c=>{
  assert.equal(c.credit,'public-exact',`${c.id}: stale case credit`);
  assert.equal(c.ts.disposition,'public-exact-attempted',`${c.id}: stale TS disposition`);
  assert.equal(c.ts.credit,true,`${c.id}: TS credit disabled`);
  const accounted=[...c.ts.attempted,...c.ts.unattempted].sort((a,b)=>a.index-b.index).map(({index,op})=>({index,op}));
  assert.deepEqual(accounted,declaredOperations(c),`${c.id}: operation accounting is not an exact partition`);
};
const value=v=>v.type==='null'?null:v.type==='integer'?BigInt(v.value):v.type==='real'?Buffer.from(v.ieee754be,'hex').readDoubleBE():v.type==='text'?Buffer.from(v.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(v.hex,'hex'));
try{
  for(const c of contract.cases){
    validateEligibility(c);
    let db,statement,error=null,rows=[],metadata=[];const attempted=[];
    const record=op=>{const index=c.operations.indexOf(op);assert.notEqual(index,-1,`${c.id}: undeclared operation ${op}`);attempted.push({index,op});};
    try{
      record('openFixture');try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${fixtures[c.setup]}`))}catch(e){error=e}
      if(db){record('prepare');try{statement=db.prepare(c.sql).statement}catch(e){error??=e}}
      if(statement){record('metadata');metadata=Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i));record('stepAll');try{while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)))}catch(e){error??=e}record('finalize');try{statement.finalize()}catch(e){error??=e}}
      const terminal=c.native.terminal;
      if(terminal.kind==='error'){assert(error,`${c.id}: expected error`);assert.equal(error.code,terminal.firstError.primaryCode,c.id);assert.equal(error.message,terminal.firstError.message,c.id)}
      else{if(error)throw error;assert.deepEqual(rows,terminal.rows.map(r=>r.map(value)),c.id);if(c.native.columns)for(let i=0;i<c.native.columns.length;i++){const got=metadata[i],want=c.native.columns[i];assert.deepEqual({name:got.name,declType:got.declaredType,database:got.database,table:got.table,origin:got.origin},{name:want.name,declType:want.declType,database:want.database,table:want.table,origin:want.origin},c.id)}}
    }finally{if(db){record('close');try{db.closeDeferred()}catch{}}}
    assert.deepEqual(attempted,c.ts.attempted.map(({index,op})=>({index,op})),`${c.id}: recorded operation attempts differ from execution`);
    passed++;credited++;console.log(JSON.stringify({id:c.id,outcome:'pass'}));
  }
  console.log(JSON.stringify({summary:{declared:contract.cases.length,attempted:contract.cases.length,passed,failed:contract.cases.length-passed,credited}}));
}finally{await new Promise((r,j)=>bridge.server.close(e=>e?j(e):r()))}
