import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const capture=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/audit-in-list.json')));

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

let match=0,mismatch=0;
for(const [encoding,entry] of Object.entries(capture.encodings)){
  const body=fs.readFileSync(path.join(root,`test/fixtures/in-list/orders-${encoding}.db`));
  const server=http.createServer((_request,response)=>{response.writeHead(200,{'Content-Length':body.length});response.end(body)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let db;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    for(const c of entry.cases){
      let statement,actual,error,resetError,finalizeError,firstErrorIdentity=false;
      try{
        statement=db.prepare(c.sql).statement;
        for(let i=0;i<c.bindings.length;i++)statement.bind(i+1,BigInt(c.bindings[i]));
        const columns=Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name);
        const rows=[];
        while(await statement.step(c.operation)==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>typed(statement,i)));
        statement.reset();
        const resetRows=[];
        while(await statement.step(c.operation)==='row')resetRows.push(Array.from({length:statement.columnCount},(_,i)=>typed(statement,i)));
        actual={columns,rows,resetRows,resetCode:0};
      }catch(caught){
        error=publicError(caught);
        if(statement){
          try{statement.reset()}catch(resetCaught){resetError=publicError(resetCaught);firstErrorIdentity=resetCaught===caught}
        }
      }finally{
        try{statement?.finalize()}catch(caught){finalizeError=publicError(caught)}
      }
      const expected=c.native;
      const ok=expected.error
        ? error?.kind==='sqlite'&&error.code===expected.error.code&&error.message===expected.error.message&&
          expected.error.phase==='step'&&resetError?.code===expected.resetCode&&resetError.message===expected.error.message&&
          firstErrorIdentity&&finalizeError===undefined
        : actual!==undefined&&same(actual.columns,expected.columns)&&same(actual.rows,expected.rows)&&
          same(actual.resetRows,expected.rows)&&actual.resetCode===expected.resetCode&&error===undefined&&finalizeError===undefined;
      ok?match++:mismatch++;
      console.log(JSON.stringify({encoding,id:c.id,outcome:ok?'match':'mismatch-or-unimplemented',actual,error,resetError,firstErrorIdentity,finalizeError,credit:0}));
    }
  }finally{
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
}
console.log(JSON.stringify({summary:{declared:63,match,mismatch,credit:0}}));
