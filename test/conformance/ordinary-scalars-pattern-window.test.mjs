import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const fixture=path.join(root,'test/fixtures/expression-cursor/users-utf8.db');

async function serveFixture(){
  const server=http.createServer((request,response)=>{
    if(request.url!=='/db')return response.writeHead(404).end();
    const stat=fs.statSync(fixture);
    response.writeHead(200,{'Content-Length':stat.size});
    fs.createReadStream(fixture).pipe(response);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  return server;
}

async function rows(statement){
  const result=[];
  while(await statement.step()==='row'){
    result.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
  }
  return result;
}

test('LIKE in represented WHERE survives window rewrite and matches pinned SQLite',async()=>{
  const server=await serveFixture();
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    // SQLite 3.53.4 returns Alice and Cara, with count(*) OVER () == 2 for both.
    // This exercises the window subquery rewrite's duplicate expression tree and
    // the normal Function opcode path instead of calling the matcher directly.
    statement=db.prepare("SELECT name, count(*) OVER () FROM users WHERE name LIKE '%a%' ORDER BY id").statement;
    assert.deepEqual(await rows(statement),[['Alice',2n],['Cara',2n]]);
  }finally{
    try{statement?.finalize()}catch{}
    db?.closeDeferred();
    await new Promise(resolve=>server.close(resolve));
  }
});
