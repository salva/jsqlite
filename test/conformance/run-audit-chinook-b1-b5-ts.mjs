import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const capture=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/audit-chinook-b1-b5.json')));
const chinook=process.argv[2];
if(!chinook)throw new Error('usage: run-audit-chinook-b1-b5-ts.mjs CHINOOK_DB');

function typed(statement,index){
  const type=statement.columnType(index),value=statement.column(index);
  if(type==='integer')return{type,value:String(value)};
  if(type==='real'){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(Number(value));return{type,ieee754be:bytes.toString('hex')}}
  if(type==='text')return{type,utf8Hex:Buffer.from(value).toString('hex')};
  if(type==='blob')return{type,hex:Buffer.from(value).toString('hex')};
  return{type:'null'};
}
function publicError(error){return{name:error.name,kind:error.kind??null,code:error.code??null,message:error.message}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}

async function execute(db,c){
  let statement,actual,error,resetError,finalizeError,firstErrorIdentity=false,phase='prepare';
  try{
    statement=db.prepare(c.sql).statement;
    for(let i=0;i<(c.bindings??[]).length;i++)statement.bind(i+1,BigInt(c.bindings[i]));
    const columns=Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name),rows=[];
    phase='step';
    while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>typed(statement,i)));
    statement.reset();
    const resetRows=[];
    while(await statement.step()==='row')resetRows.push(Array.from({length:statement.columnCount},(_,i)=>typed(statement,i)));
    actual={columns,rows,resetRows,resetCode:0};
  }catch(caught){
    error=publicError(caught);
    if(statement){
      try{statement.reset()}catch(resetCaught){resetError=publicError(resetCaught);firstErrorIdentity=resetCaught===caught}
    }
  }finally{
    try{statement?.finalize()}catch(caught){finalizeError=publicError(caught)}
  }
  return{actual,error,errorPhase:error?phase:null,resetError,firstErrorIdentity,finalizeError};
}
function matches(run,expected){
  if(expected.error)return same(run.actual?.columns??expected.columns,expected.columns)&&
    run.errorPhase===expected.error.phase&&run.error?.kind==='sqlite'&&run.error.code===expected.error.code&&run.error.message===expected.error.message&&
    run.resetError?.code===expected.resetCode&&run.resetError.message===expected.error.message&&
    run.firstErrorIdentity&&run.finalizeError===undefined;
  return run.actual!==undefined&&same(run.actual.columns,expected.columns)&&same(run.actual.rows,expected.rows)&&
    same(run.actual.resetRows,expected.rows)&&run.actual.resetCode===expected.resetCode&&run.error===undefined&&run.finalizeError===undefined;
}

const bodies={
  chinook:fs.readFileSync(chinook),
  utf8:fs.readFileSync(path.join(root,'test/fixtures/chinook-b1-b5/synthetic-utf8.db')),
  utf16le:fs.readFileSync(path.join(root,'test/fixtures/chinook-b1-b5/synthetic-utf16le.db')),
  utf16be:fs.readFileSync(path.join(root,'test/fixtures/chinook-b1-b5/synthetic-utf16be.db'))
};
let match=0,mismatch=0;
for(const [key,body] of Object.entries(bodies)){
  const server=http.createServer((_request,response)=>{response.writeHead(200,{'Content-Length':body.length});response.end(body)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let db;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    const encoding=key==='chinook'?'UTF-8':({utf8:'UTF-8',utf16le:'UTF-16le',utf16be:'UTF-16be'})[key];
    for(const c of capture.executions.filter(entry=>entry.encoding===encoding&&((key==='chinook')===(entry.fixture==='chinook')))){
      const first=await execute(db,c),reprepared=await execute(db,c);
      const ok=matches(first,c.native)&&matches(reprepared,c.native)&&same(first,reprepared);
      ok?match++:mismatch++;
      console.log(JSON.stringify({id:c.id,encoding,outcome:ok?'match':'mismatch-or-unimplemented',...first,repreparedStable:same(first,reprepared),credit:0}));
    }
  }finally{
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
}
console.log(JSON.stringify({summary:{declared:capture.executions.length,match,mismatch,credit:0}}));
if(mismatch)process.exitCode=1;
