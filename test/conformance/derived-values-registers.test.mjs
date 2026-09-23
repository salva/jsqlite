import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const here=path.dirname(new URL(import.meta.url).pathname);
const current=JSON.parse(fs.readFileSync(path.join(here,'../fixtures/CURRENT.json'),'utf8'));
const generated=path.join(here,'../fixtures/generations',current.generationId,'generated');

async function withPublicDb(encoding,options,body){
  const bytes=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));
  const server=http.createServer((_request,response)=>{
    response.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});
    response.end(bytes);
  });
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try {
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),options);
    return await body(db);
  } finally {
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
}

async function rows(db,sql){
  const statement=db.prepare(sql).statement;
  try {
    const result=[];
    while(await statement.step()==='row'){
      result.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
    }
    return result;
  } finally {
    statement.finalize();
  }
}

test('derived multirow VALUES yields each row register range',()=>withPublicDb('utf8',{},async db=>{
  assert.deepEqual(
    await rows(db,'SELECT * FROM (VALUES(1),(2),(3))'),
    [[1n],[2n],[3n]],
  );
}));

test('ordered derived multicolumn VALUES preserves each row payload',()=>withPublicDb('utf8',{},async db=>{
  assert.deepEqual(
    await rows(db,"SELECT * FROM (VALUES(1,'a'),(2,'b')) ORDER BY 1 DESC"),
    [[2n,'b'],[1n,'a']],
  );
}));

test('table-derived producer rejects unfaithful child scan shapes atomically',()=>withPublicDb('utf8',{},async db=>{
  assert.deepEqual(
    await rows(db,'SELECT a,b FROM t1 WHERE a<6 ORDER BY a'),
    [[1n,2n],[3n,4n],[5n,6n]],
    'forward rowid upper-bound exits after the last admitted row',
  );
  assert.deepEqual(await rows(db,'SELECT a,b FROM t1 WHERE a>1 ORDER BY a'),[[3n,4n],[5n,6n],[7n,8n]],'forward lower-bound seek resumes through the seek cursor');
  assert.deepEqual(
    await rows(db,'SELECT * FROM (SELECT * FROM (SELECT a,b FROM t1 WHERE a<7) WHERE b>2) ORDER BY a'),
    [[3n,4n],[5n,6n]],
    'rowid bound omits only its own term and retains the flattened residual',
  );
  for(const sql of [
    'SELECT * FROM (SELECT a FROM t1 ORDER BY a DESC)',
    'SELECT * FROM (SELECT a FROM t1 ORDER BY a DESC LIMIT 2)',
    'SELECT * FROM (SELECT a FROM t1 WHERE a>1 ORDER BY a DESC)',
    'SELECT a FROM (SELECT a FROM t1) ORDER BY a LIMIT 1',
  ])assert.throws(()=>db.prepare(sql),/derived table scan shape is not implemented/,sql);
  assert.deepEqual(await rows(db,'SELECT * FROM (SELECT a FROM t1 LIMIT 2 OFFSET 1)'),[[3n],[5n]]);
}));

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} derived VALUES preserves parameters, storage classes, OFFSET/LIMIT, and reset`,()=>withPublicDb(encoding,{},async db=>{
  const statement=db.prepare("SELECT * FROM (VALUES(?1,NULL,x'00',1.5),(?2,'x',x'ff',2),(?3,'z',x'7f',3)) ORDER BY 1 LIMIT 2 OFFSET 1").statement;
  try {
    statement.bind(1,3n);
    statement.bind(2,1n);
    statement.bind(3,2n);
    const collect=async()=>{
      const result=[];
      while(await statement.step()==='row')result.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
      return result;
    };
    const expected=[[2n,'z',new Uint8Array([127]),3n],[3n,null,new Uint8Array([0]),1.5]];
    assert.deepEqual(await collect(),expected);
    statement.reset();
    assert.deepEqual(await collect(),expected,'reset restarts every VALUES term');
  } finally {
    statement.finalize();
  }
}));

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} derived VALUES cancellation and budget cleanup restore admission`,()=>withPublicDb(encoding,{limits:{maxPrivateBytes:1}},async db=>{
  let statement=db.prepare("SELECT * FROM (VALUES(1,'aaaaaaaa'),(2,'bbbbbbbb')) ORDER BY 1").statement;
  await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>error.kind==='limit'&&error.message==='sorter exceeds total byte limit');
  assert.throws(()=>statement.finalize(),error=>error.kind==='limit','first resource error survives finalize');
  statement=db.prepare('SELECT * FROM (VALUES(1),(2))').statement;
  await assert.rejects(statement.step({signal:AbortSignal.abort('derived-values cancellation')}),error=>error.kind==='cancelled');
  assert.throws(()=>statement.finalize(),error=>error.kind==='cancelled','cancellation survives finalize');
  assert.deepEqual(await rows(db,'SELECT 1'),[[1n]],'cleanup restores connection admission');
}));
