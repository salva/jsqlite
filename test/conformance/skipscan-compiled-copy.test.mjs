import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {SelectProgramBuilder} from '../../src/internal/select-program.ts';
import {IndexCursor} from '../../src/internal/btree.ts';

// Native-first public proof: SKIPSCAN_DEFAULT_PROOF uses actual workspace
// production admission; historical SKIPSCAN_COPY_PROOF is copy-only evidence.
test('compiled skipped cursors against native-first companions',{
 skip:process.env.SKIPSCAN_COPY_PROOF!=='1'&&process.env.SEEKSCAN_DEFAULT_PROOF!=='1'&&process.env.SKIPSCAN_DEFAULT_PROOF!=='1',
},async()=>{
 if(process.env.SEEKSCAN_DEFAULT_PROOF==='1')assert.ok(['lowmul-native.json','joined-lowmul-native.json','transitive-native.json'].includes(process.env.SKIPSCAN_CAPTURE),'default proof restricted to no-skip companion captures');
 const budgetProof=process.env.SKIPSCAN_BUDGET_PROOF==='1';
 const originalEmit=SelectProgramBuilder.prototype.emit,originalCursor=SelectProgramBuilder.prototype.cursor,budgetOwners=new Map();
 const originalFinish=SelectProgramBuilder.prototype.finish;
 if(process.env.SKIPSCAN_CAPTURE==='desc-selected-native.json')SelectProgramBuilder.prototype.finish=function(){const ops=originalFinish.call(this);for(const [at,op] of ops.entries())if(op.code==='IndexRangeEnd')assert.ok(op.p2>at,'range exhaustion must advance IN/prefix/arm, never reset statement at zero');return ops;};

 function observe(builder){let values=budgetOwners.get(builder);if(!values){values=[];budgetOwners.set(builder,values);const budget=builder.wherePlanBudget;let remaining=budget.remaining;values.push(remaining);Object.defineProperty(budget,'remaining',{get(){return remaining;},set(value){assert.equal(typeof value,'bigint');assert.ok(value>=0n);values.push(value);remaining=value;},configurable:true});}return values;}
 if(budgetProof){SelectProgramBuilder.prototype.cursor=function(){observe(this);return originalCursor.call(this);};SelectProgramBuilder.prototype.emit=function(op){observe(this);return originalEmit.call(this,op);};}
 const scanProof=process.env.SKIPSCAN_SEEKSCAN_PROOF==='1',originalScan=IndexCursor.prototype.seekScan,scanCounts=new Map();
 if(scanProof)IndexCursor.prototype.seekScan=function(...args){const result=originalScan.apply(this,args);scanCounts.set(result,(scanCounts.get(result)??0)+1);return result;};
 const work=process.env.SAIVAGE_CARD_WORK_ROOT;
 const evidence=process.env.SKIPSCAN_NATIVE_ROOT;
 assert.ok(work&&evidence);
 // The immutable tail capture has erroneous hardcoded selection metadata.
 // Its corrected companion preserves native rows/opcodes and classifies controls.
 const requestedCapture=process.env.SKIPSCAN_CAPTURE??'native.json';
 const captureName=requestedCapture==='tail-native.json'?'tail-selected-native.json':requestedCapture;
 if(captureName!==requestedCapture)console.log(`capture correction: ${requestedCapture} -> ${captureName} (selection metadata only; original retained)`);
 const capture=JSON.parse(fs.readFileSync(path.join(evidence,captureName),'utf8'));
 if(captureName==='tail-selected-native.json'){
  const original=JSON.parse(fs.readFileSync(path.join(evidence,'tail-native.json'),'utf8'));
  const withoutSelection=x=>({...x,variants:x.variants.map(v=>({...v,cases:v.cases.map(({nSkip,...c})=>c)}))});
  assert.deepEqual(withoutSelection(capture),withoutSelection(original),'corrected companion must preserve all native observations');
  for(const v of capture.variants)for(const c of v.cases){
   assert.equal(c.nSkip,Math.max(0,...c.eqp.flat().map(x=>(String(x).match(/ANY\(/g)??[]).length)),'tail selection owned by native EQP');
  }
 }
 const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url),'utf8'));
 assert.equal(capture.sourceId??capture.source?.sqliteSourceId,pin.sqliteSourceId);
 // Companion captures without explicit metadata derive selection from oracle EQP,
 // never treat absent nSkip as a selected one-key prefix.
 for(const v of capture.variants??[])for(const c of v.cases??[])if(c.nSkip===undefined&&c.eqp)c.nSkip=Math.max(0,...c.eqp.flat().map(x=>(String(x).match(/ANY\(/g)??[]).length));
 const originalTranche=!!capture.source;
 if(originalTranche)capture.variants=capture.variants.filter(v=>v.control==='stat1').map(v=>({encoding:v.encoding,tail:'18',fixture:'fixtures/'+v.fixture.path,sha256:v.fixture.sha256,cases:v.cases.filter(c=>c.prepareRc===0&&c.plans?.length&&c.runs?.length).map(c=>({id:c.id,sql:c.sql,columns:c.columns,runs:c.runs,rows:c.runs[0].rows,eqp:c.plans[0].eqp.map(row=>row.filter(x=>x.type==='text').map(x=>Buffer.from(x.utf8Hex,'hex').toString('utf8'))),nSkip:Math.max(...c.plans[0].eqp.map(row=>row.filter(x=>x.type==='text').map(x=>(Buffer.from(x.utf8Hex,'hex').toString('utf8').match(/ANY\(/g)??[]).length)).flat())}))}));
 const root=path.join(work,'compiled-prefix-public'),generation='native-prefix',dir=path.join(root,'generations',generation);
 fs.mkdirSync(dir,{recursive:true});
 const variants=capture.variants.filter(v=>process.env.SKIPSCAN_ALL_VARIANTS==='1'||v.tail==='18');
 const fixtures=variants.map((v,i)=>{assert.equal(createHash('sha256').update(fs.readFileSync(path.join(evidence,v.fixture))).digest('hex'),v.sha256);const file=`prefix-${i}.db`;fs.copyFileSync(path.join(evidence,v.fixture),path.join(dir,file));return{id:`prefix-${i}`,path:file,bytes:fs.statSync(path.join(dir,file)).size};});
 fs.writeFileSync(path.join(root,'CURRENT.json'),JSON.stringify({generationId:generation}));
 fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify({semantic:{fixtures}}));
 const bridge=await startFixtureServer(root);
 const original=IndexCursor.prototype.seekKey;let calls=[],abortAtRestart=null;
 IndexCursor.prototype.seekKey=function(values,info,direction){calls.push({length:values.length,direction});const result=original.call(this,values,info,direction);if(abortAtRestart&&values.length===1&&direction==='gt'){const controller=abortAtRestart;abortAtRestart=null;controller.abort();}return result;};
 const cell=v=>v===null?{type:'null'}:typeof v==='bigint'?{type:'integer',value:String(v)}:typeof v==='number'?{type:'real',ieee754be:(()=>{const b=Buffer.alloc(8);b.writeDoubleBE(v);return b.toString('hex');})()}:typeof v==='string'?{type:'text',utf8Hex:Buffer.from(v).toString('hex')}:{type:'blob',hex:Buffer.from(v).toString('hex')};
 try{for(const [i,v] of variants.entries()){
  const db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/prefix-${i}`));
  try{for(const c of v.cases.filter(c=>process.env.SKIPSCAN_ALL_VARIANTS==='1'||['stat1-companions/native.json','in-tail-native.json','lowmul-native.json','joined-lowmul-native.json','transitive-native.json'].includes(process.env.SKIPSCAN_CAPTURE)||c.eqp.flat().some(x=>JSON.stringify(x).includes('ANY(')))){
   if(process.env.SKIPSCAN_CAPTURE==='desc-recursive-native.json'){
    const controller=new AbortController();controller.abort('construction regression');
    await assert.rejects(async()=>db.prepare(c.sql,{signal:controller.signal}),e=>e.kind==='cancelled');
    await assert.rejects(async()=>db.prepare(c.sql,{timeoutMs:0}),e=>e.kind==='timeout');
   }
   calls=[];const beforeOwners=new Set(budgetOwners.keys());const {statement}=await db.prepare(c.sql);assert.ok(statement);

   try{
   if(budgetProof){const fresh=[...budgetOwners.entries()].filter(([builder])=>!beforeOwners.has(builder));assert.ok(fresh.length>0,'fresh statement builder');for(const [builder,values] of fresh){assert.equal([...budgetOwners.keys()].filter(other=>other!==builder&&other.wherePlanBudget===builder.wherePlanBudget).length,0,'no cross-statement shared budget');assert.ok(values.some((value,i)=>i>0&&value===values[i-1]-1n),'actual planner insertion debit');console.log('budget-owner',String(values[0]),String(values.at(-1)),values.length);assert.ok(builder.wherePlanBudget.remaining<22000n,'joined planner consumes replenished frontier');}}
    if(c.columns)assert.deepEqual(Array.from({length:statement.columnCount},(_,j)=>statement.columnMetadata(j).name),c.columns);
    if(process.env.SKIPSCAN_OR_CLEANUP_PROOF==='1'&&c.sql.includes(' OR ')){
     const controller=new AbortController();abortAtRestart=controller;
     await assert.rejects(async()=>{while(await statement.step({signal:controller.signal})==='row'){}},e=>e.kind==='cancelled');
     assert.equal(abortAtRestart,null,'cancel after actual strict prefix restart');
     assert.throws(()=>statement.reset(),e=>e.kind==='cancelled');
     calls=[]; // Subsequent native runs prove RowSet/match/cursor reset recovery.
    }
    const runs=c.runs??[{rows:c.rows,bindings:[]},{rows:c.rows,bindings:[]}];
    for(const [runIndex,run] of runs.entries()){
     if(runIndex)await statement.reset();
     statement.clearBindings();
     // Original capture.py explicitly binds the third affinity rerun as REAL.
     // JSON's 2.0 is otherwise indistinguishable from INTEGER 2 here.
     for(const [j,b] of run.bindings.entries())statement.bind(j+1,run.bindingTypes?.[j]==='real'||c.id==='prefix-null-desc-affinity'&&runIndex===2?b:Number.isInteger(b)?BigInt(b):b);
     const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,j)=>cell(statement.column(j))));
     const canonical=r=>[...r].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
     assert.deepEqual(process.env.SKIPSCAN_CAPTURE==='mixed-native.json'?canonical(rows):rows,process.env.SKIPSCAN_CAPTURE==='mixed-native.json'?canonical(run.rows):run.rows,`${v.encoding}: ${c.sql} run${runIndex}`);
     if(['order-native.json','stat1-companions/native.json'].includes(process.env.SKIPSCAN_CAPTURE)){const sorted=c.eqp.flat().some(x=>String(x).includes('TEMP B-TREE'));assert.equal(statement.privateAccounting().sorterRows>0,sorted,`actual sort owner: ${v.encoding}/${v.control}/${c.sql}`);}
    }
    if(process.env.SEEKSCAN_DEFAULT_PROOF==='1'&&process.env.SKIPSCAN_CAPTURE==='lowmul-native.json'){
     assert.ok(calls.some(call=>call.direction===(c.sql.includes('id>0')?'gt':'ge')&&call.length===(c.sql.includes('id>0')?4:3)),'native full physical suffix seek selection');
    }
    if(process.env.SKIPSCAN_CAPTURE==='mixed-native.json'&&c.sql.includes('LEFT JOIN')){assert.equal(calls.filter(call=>call.direction==='gt'&&call.length===1).length,16,'both LEFT OR arms exhaust each physical prefix across reset');if(c.sql.includes('b>1005'))assert.deepEqual(c.rows,[[{type:'null'},{type:'null'},{type:'null'},{type:'null'}]],'one null-extension after all arms/prefixes');}
    if(process.env.SKIPSCAN_CAPTURE==='transitive-native.json')assert.ok(calls.some(call=>call.direction==='ge'&&call.length===3),'actual selected scalar transitive physical suffix');
    if(process.env.SKIPSCAN_CAPTURE==='null-in-native.json'&&c.sql.includes('b=NULL')){assert.equal(calls.length,0,'EQ NULL final-level exit before suffix seek/restart');}else if(c.sql.includes('b>=NULL')&&['null-in-native.json','notnull-directions-native.json'].includes(process.env.SKIPSCAN_CAPTURE)){assert.ok(!calls.some(call=>call.length>c.nSkip),'bound NULL exits each prefix before suffix seek');assert.ok(calls.some(call=>call.length===c.nSkip&&['gt','lt'].includes(call.direction)),'bound NULL prefix continuation');}else if(process.env.SKIPSCAN_CAPTURE==='notnull-directions-native.json'&&c.sql.includes('WHERE a IS NOT NULL')){if(c.sql.includes('ORDER BY a DESC'))assert.equal(calls.length,0,'reverse VNULL end uses Last, not zero-field seek');else assert.ok(calls.some(call=>call.direction==='lt'&&call.length===1),'DESC physical VNULL start strict LT NULL');}else if(c.nSkip===0){assert.ok(!calls.some(call=>call.length===1&&['gt','lt'].includes(call.direction)),`nonselected stat1 control: ${v.control}`);}else{
    assert.ok(calls.some(call=>call.length===(c.nSkip??1)&&['gt','lt'].includes(call.direction)),`strict physical prefix consumed: ${c.sql}`);
    if(process.env.SKIPSCAN_CAPTURE==='prefix-position-native.json'&&c.nSkip>0&&!c.sql.includes(' OR ')){assert.ok(calls.every(call=>call.length===c.nSkip&&call.direction==='lt'),'positioned prefix needs no suffix re-seek');}else assert.ok(calls.some(call=>call.length>(c.nSkip??1)),`full suffix seek consumed: ${c.sql}`);
    }
    if(process.env.SKIPSCAN_CAPTURE==='desc-selected-native.json'&&c.nSkip){assert.ok(calls.every(call=>call.direction==='ge'&&call.length===2||call.direction==='gt'&&call.length===1),'nested IN physical-forward suffix/prefix owner');assert.equal(calls.filter(call=>call.direction==='gt').length,8,'four prefixes on each reset execution');}
    if(process.env.SKIPSCAN_CAPTURE==='desc-recursive-native.json'){assert.ok(calls.every(call=>call.direction==='gt'||call.direction==='ge'),'recursive OR physical-forward traversal despite DESC keys');assert.equal(calls.filter(call=>call.direction==='gt'&&call.length===1).length,16,'both OR arms restart four prefixes on each reset');}
    if(process.env.SKIPSCAN_CAPTURE==='desc-or-end-native.json'){if(c.nSkip){assert.ok(calls.some(call=>call.direction==='gt'&&call.length===1),'DESC leading key still strict physical-forward restart');assert.ok(calls.some(call=>call.direction===(c.sql.includes('>=')?'ge':'gt')&&call.length===2),'physical DESC range start');}else assert.equal(calls.length,0,'native SCAN control stays nonselected');}
    if(process.env.SKIPSCAN_CAPTURE==='or-order-position-native.json'){assert.ok(calls.length>0,'selected recursive OR cursor path');assert.ok(calls.every(call=>call.direction==='ge'||call.direction==='gt'),'OR subplan has no ORDER BY: outer DESC cannot reverse its cursors');assert.ok(calls.some(call=>call.direction==='gt'&&call.length===1),'strict forward prefix restart');}
    console.log('compiled-prefix',v.encoding,c.sql,JSON.stringify(calls.reduce((out,c)=>(out[`${c.direction}/${c.length}`]=(out[`${c.direction}/${c.length}`]??0)+1,out),{})));
   }finally{await statement.finalize();}
  }}finally{await db.close();}
 }}finally{IndexCursor.prototype.seekScan=originalScan;IndexCursor.prototype.seekKey=original;SelectProgramBuilder.prototype.finish=originalFinish;if(budgetProof){SelectProgramBuilder.prototype.emit=originalEmit;SelectProgramBuilder.prototype.cursor=originalCursor;}await new Promise(resolve=>bridge.server.close(resolve));}
 if(scanProof){IndexCursor.prototype.seekScan=originalScan;assert.ok(scanCounts.get('seek')>0);assert.ok(scanCounts.get('exhausted')>0);console.log('production SeekScan outcomes',Object.fromEntries(scanCounts));}
});
