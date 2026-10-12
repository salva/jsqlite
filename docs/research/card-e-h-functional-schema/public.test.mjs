import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadSchemaGraph,SchemaStateError} from '../../../src/internal/schema.ts';
import {parseSql} from '../../../src/internal/parse.ts';
import {open} from '../../../src/index.ts';
const capture=JSON.parse(fs.readFileSync(`${process.env.SAIVAGE_CARD_WORK_ROOT}/schema-functional/fixtures/capture.json`));
const pin=JSON.parse(fs.readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,pin.sqliteSourceId);
for(const v of capture.variants)test(`${v.encoding}/${v.kind}: pinned ordinary rows`,async()=>{
 const bytes=fs.readFileSync(v.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,st;
 try{
  db=await open('https://fixture.test/schema');
  if(v.kind.startsWith('trigger')){
   const abort=new Error('schema load interrupted');let reached=false;
   assert.throws(()=>loadSchemaGraph(db,{check(){reached=true;throw abort;}}),error=>error===abort);
   assert.ok(reached,'trigger load participates in atomic resource callback');
   const graph=loadSchemaGraph(db),trigger=graph.triggers.get(v.kind==='trigger-same-name'?'t':'log');
   assert.equal(trigger.target,v.kind==='trigger-view'?graph.views.get('v'):graph.tables.get('t'));assert.equal(graph.objects.filter(o=>o===trigger).length,1);
   assert.ok(Object.isFrozen(trigger));assert.ok(Object.isFrozen(trigger.declaration.steps));
   assert.equal(trigger.declaration.event,v.kind==='trigger-realistic'?'update':'insert');
   assert.equal(trigger.declaration.steps.length,v.kind==='trigger-realistic'?2:1);
   for(const step of trigger.initializedSteps)if(step.target){assert.deepEqual(step.target.semantic,{schema:'main',fixedSchema:true,fromDDL:true,notCte:false,hadSchema:false});assert.ok(Object.isFrozen(step.target.semantic));}
   if(v.kind==='trigger-main-read'){
    const reductions=[];const stack=[trigger.initializedSteps[0].select];
    while(stack.length){const node=stack.pop();if(node?.kind!=='reduction')continue;reductions.push(node);stack.push(...node.children);}
    const source=reductions.find(node=>node.signature.startsWith('seltablist ::=')&&node.semantic?.fixedSchema);
    assert.deepEqual(source.semantic,{schema:'main',fixedSchema:true,fromDDL:true,notCte:true,hadSchema:true});
    assert.ok(Object.isFrozen(source.semantic));
    assert.ok(source.children.some(node=>node.kind==='reduction'&&node.signature==='dbnm ::='&&node.children.length===0));
    assert.ok(JSON.stringify(trigger.declaration.steps[0].select).includes('dbnm ::= DOT nm'),'original qualification retained');
   }
   if(v.kind==='trigger-overflow')assert.ok(trigger.sql.length>10000);
   if(v.kind==='trigger-view')assert.equal(trigger.declaration.timing,'instead');
   if(v.kind==='trigger-variable'){assert.equal(trigger.initializedWhen.signature,'term ::= NULL|FLOAT|BLOB');assert.deepEqual(trigger.initializedWhen.semantic,{fromDDL:true});assert.ok(Object.isFrozen(trigger.initializedWhen.semantic));assert.equal(trigger.declaration.when.reduction.signature,'expr ::= VARIABLE');assert.ok(JSON.stringify(trigger.initializedSteps).includes('term ::= NULL|FLOAT|BLOB'));}
   if(v.kind==='trigger-realistic'){assert.deepEqual(trigger.declaration.updateColumns,['a']);assert.ok(trigger.declaration.when?.reduction)}
   assert.equal(graph.indexes.get('t_a').table,graph.tables.get('t'));
   const parsed=parseSql(trigger.sql+'; SELECT 99');assert.equal(parsed.statement.kind,'create-trigger');
   assert.equal(parsed.tailCodeUnit,trigger.sql.length+1);
  }
  st=db.prepare(v.sql).statement;
  const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{
   const type=st.columnType(i),value=st.column(i);
   return type==='null'?{type}:type==='integer'?{type,value:String(value)}:{type,utf8Hex:Buffer.from(value).toString('hex')};
  }));assert.deepEqual(rows,v.rows);
  if(v.kind==='generated-virtual'){
   const graph=loadSchemaGraph(db),column=graph.tables.get('t').columns[2];
   assert.ok(column.generatedExpr.reduction,'generated expression retains Lemon identity');
   for(const [sql,expected] of [
    ['SELECT * FROM t ORDER BY id',[[1n,4n,5n,'tail'],[2n,null,null,'end']]],
    ['SELECT b+1 FROM t WHERE b=5',[[6n]]],
    ['SELECT b FROM t ORDER BY b',[[null],[5n]]],
   ]){
    const query=db.prepare(sql).statement,result=[];
    try{while(await query.step()==='row')result.push(Array.from({length:query.columnCount},(_,i)=>query.column(i)));}finally{query.finalize();}
    assert.deepEqual(result,expected);
   }
  }

  st.reset();assert.equal(await st.step(),"row");
  if(v.kind.startsWith("trigger")){const graph=loadSchemaGraph(db);st.finalize();st=null;db.close();db=null;assert.throws(()=>graph.assertOpen(),SchemaStateError);}
 }finally{try{st?.finalize();db?.closeDeferred()}finally{globalThis.fetch=old}}
});
for(const v of JSON.parse(fs.readFileSync(`${process.env.SAIVAGE_CARD_WORK_ROOT}/schema-functional/fixtures/errors.json`)))test(`${v.encoding}/invalid-trigger-${v.kind}: native corruption`,async()=>{
 const bytes=fs.readFileSync(v.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://fixture.test/invalid');for(let i=0;i<2;i++)assert.throws(()=>db.prepare('SELECT a FROM t'),e=>e.code===v.code&&e.message===v.message)}finally{db?.close();globalThis.fetch=old}
});
