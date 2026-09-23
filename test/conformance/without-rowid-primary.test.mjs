import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import { openFixture, privateAccounting } from './public-api-adapter.mjs';

const fixtures={
  'utf-8':'./fixtures/advanced-index-utf8.db',
  'utf-16le':'./fixtures/advanced-index-utf16le.db',
  'utf-16be':'./fixtures/advanced-index-utf16be.db',
};

async function withFixture(file,run){
  const body=fs.readFileSync(new URL(file,import.meta.url));
  const server=http.createServer((_request,response)=>{
    response.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':body.length});
    response.end(body);
  });
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    await run(db);
  }finally{
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
}

test('represented WITHOUT ROWID primary and secondary covering cases match pinned rows in every encoding',async()=>{
  for(const [encoding,file] of Object.entries(fixtures))await withFixture(file,async db=>{
    const cases=[
      ['SELECT a,b,typeof(c),c,payload FROM wr WHERE a=?1 AND b=?2',['ALPHA',2n],[['alpha',2n,'real',2.5,'w2']]],
      ['SELECT a,b,payload FROM wr WHERE a=?1 ORDER BY b',['alpha'],[['Alpha',1n,'w1'],['alpha',2n,'w2']]],
      ['SELECT a,b,typeof(c),c FROM wr WHERE c>=?1 ORDER BY c,a,b',[2.5],[['alpha',2n,'real',2.5],['beta',1n,'real',3],['gamma',2n,'real',5]]],
    ];
    for(const [sql,bindings,expected] of cases){
      const statement=db.prepare(sql).statement;
      try{
        bindings.forEach((value,index)=>statement.bind(index+1,value));
        const actual=[];while(await statement.step()==='row')actual.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
        assert.deepEqual(actual,expected,`${encoding}: ${sql}`);
      }finally{statement.finalize()}
    }
    const statement=db.prepare(cases[0][0]).statement;
    try{
      statement.bind(1,'beta');statement.bind(2,1n);
      assert.equal(await statement.step(),'row',`${encoding} reset/rebind`);
      assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)),['beta',1n,'real',3,'w3'],encoding);
      assert.equal(await statement.step(),'done');statement.reset();statement.bind(1,'ALPHA');statement.bind(2,2n);
      const limited=await statement.step({maxWorkUnits:1}).then(()=>null,error=>error);assert.equal(limited?.kind,'limit');
      assert.throws(()=>statement.finalize(),error=>error===limited);
    }finally{try{statement.finalize()}catch{}}
  });
});

test('WITHOUT ROWID unconstrained scan uses BLOBKEY storage safely',async()=>withFixture(fixtures['utf-8'],async db=>{
  const statement=db.prepare('SELECT a,b,payload FROM wr ORDER BY a,b').statement;
  try{const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1),statement.column(2)]);assert.deepEqual(rows,[['Alpha',1n,'w1'],['alpha',2n,'w2'],['beta',1n,'w3'],['gamma',2n,'w4']]);}finally{statement.finalize()}
}));

test('partial-index residual needing a non-index table column never becomes false covering',async()=>{
  for(const [encoding,file] of Object.entries(fixtures))await withFixture(file,async db=>{
    // p_live stores (a,b,rowid), not c. Partial-index implication is sibling
    // scope, so this card must retain a table-reading path for c rather than
    // evaluating the residual from a missing index-record value.
    const statement=db.prepare('SELECT c FROM p WHERE a=?1 AND c IS NOT NULL ORDER BY b').statement;
    try{
      statement.bind(1,1n);
      const actual=[];while(await statement.step()==='row')actual.push(statement.column(0));
      assert.deepEqual(actual,[1],encoding);
      const accounting=privateAccounting(statement);
      assert.equal(accounting.indexSeeks,0,`${encoding}/no sibling partial selection`);
      assert.ok(accounting.tableNext>=3,`${encoding}/table values read`);
      assert.ok(accounting.residualTests>=4,`${encoding}/residual tested from table`);
    }finally{try{statement.finalize()}catch{}}
  });
});

test('WITHOUT ROWID non-covering secondary performs primary BLOBKEY lookup in every encoding',async()=>{
  for(const [encoding,file] of Object.entries(fixtures))await withFixture(file,async db=>{
    // wherecode.c:2171-2185: a non-covering secondary loop on a WITHOUT
    // ROWID table extracts the complete PK suffix and OP_NotFound seeks the
    // primary b-tree. This assertion distinguishes that branch from a false
    // covering read while retaining public typed-row behavior.
    const statement=db.prepare('SELECT payload FROM wr INDEXED BY wr_c WHERE c=?1').statement;
    try{
      statement.bind(1,2.5);
      assert.equal(await statement.step(),'row',`${encoding}/row`);
      assert.equal(statement.column(0),'w2',`${encoding}/payload`);
      assert.equal(await statement.step(),'done',`${encoding}/done`);
      const accounting=privateAccounting(statement);
      assert.equal(accounting.indexSeeks,1,`${encoding}/secondary seek`);
      assert.equal(accounting.tableSeeks,1,`${encoding}/primary BLOBKEY seek`);
      assert.equal(accounting.tableNext,0,`${encoding}/no primary scan`);
      assert.equal(accounting.residualTests,0,`${encoding}/no residual fallback`);
    }finally{try{statement.finalize()}catch{}}
  });
});
