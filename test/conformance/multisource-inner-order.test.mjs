import {closeTestServer} from './close-test-server.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);

async function rows(statement){
 const result=[];
 while(await statement.step()==='row')result.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
 return result;
}

test('public two- and three-source INNER loops preserve source scan order and predicate placement',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));

  s=db.prepare('SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b').statement;
  assert.deepEqual(s.columnMetadata(0),{name:'f1',declaredType:'int',database:'main',table:'test1',origin:'f1'});
  assert.deepEqual(await rows(s),[[11n,11n],[11n,33n],[33n,11n],[33n,33n]]);
  s.finalize();s=null;

  s=db.prepare('SELECT a.f1,b.f1,c.f1 FROM test1 AS a,test1 AS b,test1 AS c').statement;
  assert.deepEqual(await rows(s),[
   [11n,11n,11n],[11n,11n,33n],[11n,33n,11n],[11n,33n,33n],
   [33n,11n,11n],[33n,11n,33n],[33n,33n,11n],[33n,33n,33n],
  ]);
  s.finalize();s=null;

  s=db.prepare('SELECT a.f1,b.f1 FROM test1 AS a INNER JOIN test1 AS b ON a.f1<b.f1').statement;
  assert.deepEqual(await rows(s),[[11n,33n]]);
  s.finalize();s=null;

  s=db.prepare('SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b WHERE a.f1<b.f1').statement;
  assert.deepEqual(await rows(s),[[11n,33n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public multi-row INNER loop resets partial execution and rebinds without stale cursor state',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));
  s=db.prepare('SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b WHERE a.f1<?1').statement;
  assert.equal(s.parameterCount,1);
  assert.equal(s.parameterName(1),'?1');

  s.bind(1,20n);
  assert.equal(await s.step(),'row');
  assert.deepEqual([s.column(0),s.column(1)],[11n,11n]);

  // Reset while the first execution has another row. Rebinding must restart
  // both source scans rather than resume either forward-only cursor.
  s.reset();
  s.bind('?1',40n);
  assert.deepEqual(await rows(s),[[11n,11n],[11n,33n],[33n,11n],[33n,33n]]);

  s.reset();
  s.clearBindings();
  assert.deepEqual(await rows(s),[]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public multi-row INNER loop releases execution ownership after cancel, deadline, and work failures',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 const sql='SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b';
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));

  const aborted=new AbortController();aborted.abort('test cancellation');
  s=db.prepare(sql).statement;
  await assert.rejects(s.step({signal:aborted.signal}),error=>error.kind==='cancelled'&&error.message==='statement execution was cancelled');
  assert.throws(()=>s.finalize(),error=>error.kind==='cancelled');s=null;

  s=db.prepare(sql).statement;
  await assert.rejects(s.step({timeoutMs:0}),error=>error.kind==='timeout'&&error.message==='statement execution timed out');
  assert.throws(()=>s.finalize(),error=>error.kind==='timeout');s=null;

  s=db.prepare(sql).statement;
  await assert.rejects(s.step({maxWorkUnits:0}),error=>error.kind==='limit'&&error.message==='statement exceeds maxWorkUnits');
  assert.throws(()=>s.finalize(),error=>error.kind==='limit');s=null;

  // Every failed statement finalized above must have released connection
  // ownership and scan state for an independent execution.
  s=db.prepare(sql).statement;
  assert.deepEqual(await rows(s),[[11n,11n],[11n,33n],[33n,11n],[33n,33n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER sorter releases private state after budget failure',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 const request=()=>new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`);
 const sql='SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b ORDER BY a.f1,b.f1';
 try{
  db=await openFixture(request(),{limits:{maxPrivateEntries:1}});
  s=db.prepare(sql).statement;
  await assert.rejects(s.step(),error=>error.kind==='limit');
  assert.throws(()=>s.finalize(),error=>error.kind==='limit');s=null;
  // The private-state failure and finalize release all statement/connection state.
  db.close();db=null;

  db=await openFixture(request());
  s=db.prepare(sql).statement;
  assert.deepEqual(await rows(s),[[11n,11n],[11n,33n],[33n,11n],[33n,33n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public multi-row USING and NATURAL joins merge star columns and filter at the join boundary',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));

  s=db.prepare('SELECT * FROM test1 AS a INNER JOIN test1 AS b USING(f1)').statement;
  assert.equal(s.columnCount,3);
  assert.deepEqual(Array.from({length:3},(_,i)=>s.columnMetadata(i).name),['f1','f2','f2']);
  assert.deepEqual(await rows(s),[[11n,22n,22n],[33n,44n,44n]]);
  s.finalize();s=null;

  s=db.prepare('SELECT * FROM test1 AS a NATURAL JOIN test1 AS b').statement;
  assert.equal(s.columnCount,2);
  assert.deepEqual(Array.from({length:2},(_,i)=>s.columnMetadata(i).name),['f1','f2']);
  assert.deepEqual(await rows(s),[[11n,22n],[33n,44n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER execution preserves direct metadata and storage classes in every database encoding',async()=>{
 const bridge=await startFixtureServer(root);
 try{
  for(const fixture of ['storage-p4096','storage-p4096-utf16le','storage-p4096-utf16be']){
   let db,s;
   try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${fixture}`));
    s=db.prepare("SELECT a.i,b.r,a.t,b.b FROM storage_values AS a INNER JOIN storage_values AS b ON a.k=b.k WHERE a.k='min' LIMIT 1").statement;
    assert.deepEqual(Array.from({length:4},(_,i)=>s.columnMetadata(i)),[
     {name:'i',declaredType:null,database:'main',table:'storage_values',origin:'i'},
     {name:'r',declaredType:null,database:'main',table:'storage_values',origin:'r'},
     {name:'t',declaredType:null,database:'main',table:'storage_values',origin:'t'},
     {name:'b',declaredType:null,database:'main',table:'storage_values',origin:'b'},
    ]);
    assert.equal(await s.step(),'row');
    assert.deepEqual(Array.from({length:4},(_,i)=>s.columnType(i)),['integer','real','text','blob']);
    assert.equal(s.column(0),-9223372036854775808n);
    assert.equal(s.column(1),1);
    assert.equal(s.column(2),'');
    assert.deepEqual(s.column(3),new Uint8Array());
    assert.equal(await s.step(),'done');
   }finally{
    try{s?.finalize()}catch{}
    try{db?.closeDeferred()}catch{}
   }
  }
 }finally{
  await closeTestServer(bridge.server);
 }
});

test('public compound SELECT executes join-bearing arms in either arm position',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));
  const join="SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b WHERE a.f1<b.f1";
  for(const [sql,expected,metadata] of [
   [`${join} UNION ALL SELECT 99,100`,[[11n,33n],[99n,100n]],['f1','f1']],
   [`SELECT 99,100 UNION ALL ${join}`,[[99n,100n],[11n,33n]],['99','100']],
  ]){
   s=db.prepare(sql).statement;
   assert.deepEqual(await rows(s),expected,sql);
   assert.deepEqual(Array.from({length:2},(_,i)=>s.columnMetadata(i).name),metadata,sql);
   s.finalize();s=null;
  }
  // Completed compound execution must not retain connection or statement state.
  s=db.prepare(join).statement;
  assert.deepEqual(await rows(s),[[11n,33n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER predicates preserve NULL and storage-class comparison distinctions',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  s=db.prepare('SELECT a.rowid,b.rowid,typeof(a.v),typeof(b.v) FROM distinct_edge AS a INNER JOIN distinct_edge AS b ON a.v=b.v ORDER BY a.rowid,b.rowid').statement;
  assert.deepEqual(await rows(s),[
   [3n,3n,'integer','integer'],[3n,4n,'integer','real'],
   [4n,3n,'real','integer'],[4n,4n,'real','real'],
   [5n,5n,'text','text'],[6n,6n,'blob','blob'],
  ]);
  s.finalize();s=null;

  s=db.prepare('SELECT a.rowid,b.rowid FROM distinct_edge AS a INNER JOIN distinct_edge AS b ON a.v IS b.v ORDER BY a.rowid,b.rowid').statement;
  assert.deepEqual(await rows(s),[
   [1n,1n],[1n,2n],[2n,1n],[2n,2n],
   [3n,3n],[3n,4n],[4n,3n],[4n,4n],[5n,5n],[6n,6n],
  ]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER ON comparison inherits BINARY, NOCASE, and RTRIM column collations',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  const expected={
   bin:[[1n,1n],[2n,2n],[3n,3n],[4n,4n],[5n,5n],[6n,6n]],
   nc:[[1n,1n],[1n,2n],[2n,1n],[2n,2n],[3n,3n],[4n,4n],[4n,5n],[5n,4n],[5n,5n],[6n,6n]],
   rt:[[1n,1n],[1n,2n],[1n,3n],[2n,1n],[2n,2n],[2n,3n],[3n,1n],[3n,2n],[3n,3n],[4n,4n],[4n,5n],[5n,4n],[5n,5n],[6n,6n]],
  };
  for(const column of ['bin','nc','rt']){
   s=db.prepare(`SELECT a.rowid,b.rowid FROM distinct_edge AS a INNER JOIN distinct_edge AS b ON a.${column}=b.${column} ORDER BY a.rowid,b.rowid`).statement;
   assert.deepEqual(await rows(s),expected[column]);
   s.finalize();s=null;
  }
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER ON honors explicit COLLATE and left-operand declared-collation precedence',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 const binary=[[1n,1n],[2n,2n],[3n,3n],[4n,4n],[5n,5n],[6n,6n]];
 const nocase=[[1n,1n],[1n,2n],[2n,1n],[2n,2n],[3n,3n],[4n,4n],[4n,5n],[5n,4n],[5n,5n],[6n,6n]];
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  const cases=[
   ['a.bin COLLATE NOCASE=b.bin',nocase],
   ['a.bin=b.bin COLLATE NOCASE',nocase],
   ['a.bin=b.nc',binary],
   ['a.nc=b.bin',nocase],
  ];
  for(const [predicate,expected] of cases){
   s=db.prepare(`SELECT a.rowid,b.rowid FROM distinct_edge AS a INNER JOIN distinct_edge AS b ON ${predicate} ORDER BY a.rowid,b.rowid`).statement;
   assert.deepEqual(await rows(s),expected);
   s.finalize();s=null;
  }
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public three-source USING chains distinguish merged star from qualified stars',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));
  s=db.prepare('SELECT * FROM test1 AS a JOIN test1 AS b USING(f1) JOIN test1 AS c USING(f1) ORDER BY f1').statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),['f1','f2','f2','f2']);
  assert.deepEqual(await rows(s),[[11n,22n,22n,22n],[33n,44n,44n,44n]]);
  s.finalize();s=null;

  s=db.prepare('SELECT a.*,b.*,c.* FROM test1 AS a JOIN test1 AS b USING(f1) JOIN test1 AS c USING(f1) ORDER BY a.f1').statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),['f1','f2','f1','f2','f1','f2']);
  assert.deepEqual(await rows(s),[[11n,22n,11n,22n,11n,22n],[33n,44n,33n,44n,33n,44n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public three-source NATURAL chains derive every common-column boundary and star shape',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));
  s=db.prepare('SELECT * FROM test1 AS a NATURAL JOIN test1 AS b NATURAL JOIN test1 AS c ORDER BY f1').statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),['f1','f2']);
  assert.deepEqual(await rows(s),[[11n,22n],[33n,44n]]);
  s.finalize();s=null;

  s=db.prepare('SELECT a.*,b.*,c.* FROM test1 AS a NATURAL JOIN test1 AS b NATURAL JOIN test1 AS c ORDER BY a.f1').statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),['f1','f2','f1','f2','f1','f2']);
  assert.deepEqual(await rows(s),[[11n,22n,11n,22n,11n,22n],[33n,44n,33n,44n,33n,44n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER loop enforces row budget after partial progress and releases execution state',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`),{limits:{maxRows:1}});
  s=db.prepare('SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b').statement;
  assert.equal(await s.step(),'row');
  assert.deepEqual([s.column(0),s.column(1)],[11n,11n]);
  await assert.rejects(s.step(),error=>error.kind==='limit'&&error.message==='statement exceeds maxRows');
  assert.throws(()=>s.finalize(),error=>error.kind==='limit'&&error.message==='statement exceeds maxRows');
  s=null;
  // A new statement proves the failed nested loop released operation/cursor ownership.
  s=db.prepare('SELECT f1 FROM test1 ORDER BY f1 LIMIT 1').statement;
  assert.deepEqual(await rows(s),[[11n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER loop cancellation after an emitted row releases execution state',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));
  s=db.prepare('SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b').statement;
  assert.equal(await s.step(),'row');
  assert.deepEqual([s.column(0),s.column(1)],[11n,11n]);
  const abort=new AbortController();abort.abort();
  await assert.rejects(s.step({signal:abort.signal}),error=>error.kind==='cancelled'&&error.message==='statement execution was cancelled');
  assert.throws(()=>s.finalize(),error=>error.kind==='cancelled'&&error.message==='statement execution was cancelled');
  s=null;
  s=db.prepare('SELECT f1 FROM test1 ORDER BY f1 LIMIT 1').statement;
  assert.deepEqual(await rows(s),[[11n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER loop deadline after an emitted row releases execution state',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));
  s=db.prepare('SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b').statement;
  assert.equal(await s.step(),'row');
  assert.deepEqual([s.column(0),s.column(1)],[11n,11n]);
  await assert.rejects(s.step({timeoutMs:0}),error=>error.kind==='timeout'&&error.message==='statement execution timed out');
  assert.throws(()=>s.finalize(),error=>error.kind==='timeout'&&error.message==='statement execution timed out');
  s=null;
  s=db.prepare('SELECT f1 FROM test1 ORDER BY f1 LIMIT 1').statement;
  assert.deepEqual(await rows(s),[[11n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER sorter releases private state after key and aggregate-byte budget failures',async()=>{
 const bridge=await startFixtureServer(root);
 const request=()=>new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`);
 const sql='SELECT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b ORDER BY a.f1,b.f1';
 try{
  for(const [limits,message] of [
   [{maxPrivateKeyBytes:1},'sorter key exceeds byte limit'],
   [{maxPrivateBytes:1},'sorter exceeds total byte limit'],
  ]){
   let db,s;
   try{
    db=await openFixture(request(),{limits});
    s=db.prepare(sql).statement;
    await assert.rejects(s.step(),error=>error.kind==='limit'&&error.message===message);
    assert.throws(()=>s.finalize(),error=>error.kind==='limit'&&error.message===message);s=null;
    db.close();db=null;
    db=await openFixture(request());
    s=db.prepare(sql).statement;
    assert.deepEqual(await rows(s),[[11n,11n],[11n,33n],[33n,11n],[33n,33n]]);
   }finally{
    try{s?.finalize()}catch{}
    try{db?.closeDeferred()}catch{}
   }
  }
 }finally{
  await closeTestServer(bridge.server);
 }
});

test('public INNER DISTINCT releases ephemeral state after every private budget failure',async()=>{
 const bridge=await startFixtureServer(root);
 const request=()=>new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`);
 const sql='SELECT DISTINCT a.f1,b.f1 FROM test1 AS a CROSS JOIN test1 AS b';
 try{
  for(const [limits,message,firstRow] of [
   [{maxPrivateEntries:1},'ephemeral index exceeds entry limit',true],
   [{maxPrivateKeyBytes:1},'ephemeral key exceeds byte limit',false],
   [{maxPrivateBytes:1},'ephemeral index exceeds total byte limit',false],
  ]){
   let db,s;
   try{
    db=await openFixture(request(),{limits});s=db.prepare(sql).statement;
    if(firstRow){assert.equal(await s.step(),'row');assert.deepEqual([s.column(0),s.column(1)],[11n,11n]);}
    await assert.rejects(s.step(),error=>error.kind==='limit'&&error.message===message);
    assert.throws(()=>s.finalize(),error=>error.kind==='limit'&&error.message===message);s=null;
    db.close();db=null;
    db=await openFixture(request());s=db.prepare(sql).statement;
    assert.deepEqual(await rows(s),[[11n,11n],[11n,33n],[33n,11n],[33n,33n]]);
   }finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}}
  }
 }finally{await closeTestServer(bridge.server);}
});

test('public INNER computed projection enforces result-size limit and resets cleanly',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`),{limits:{maxResultBytes:32}});
  s=db.prepare("SELECT replace(?1,'x','0123456789') AS expanded FROM test1 AS a CROSS JOIN test1 AS b LIMIT 1").statement;
  s.bind(1,'x'.repeat(16));
  let primary;try{await s.step()}catch(error){primary=error}
  assert.equal(primary?.kind,'limit');assert.equal(primary?.message,'string or blob too big');
  assert.throws(()=>s.reset(),error=>error===primary);
  s.bind(1,'xx');assert.equal(await s.step(),'row');
  assert.equal(s.columnText(0),'01234567890123456789');assert.equal(await s.step(),'done');
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public heterogeneous three-source INNER chain preserves source metadata and order',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  s=db.prepare('SELECT d.nc,t2.a,t1.x,d.bin FROM t1 INNER JOIN t2 ON t2.a=t1.y INNER JOIN distinct_edge AS d ON d.v=t2.a ORDER BY t1.x DESC,d.rowid').statement;
  assert.deepEqual(Array.from({length:4},(_,i)=>s.columnMetadata(i)),[
   {name:'nc',declaredType:'TEXT',database:'main',table:'distinct_edge',origin:'nc'},
   {name:'a',declaredType:null,database:'main',table:'t2',origin:'a'},
   {name:'x',declaredType:'INT',database:'main',table:'t1',origin:'x'},
   {name:'bin',declaredType:'TEXT',database:'main',table:'distinct_edge',origin:'bin'},
  ]);
  assert.deepEqual(await rows(s),[
   ['a ',1n,23n,'a '],['a\0x',1n,23n,'a\0x'],
   ['a ',1n,13n,'a '],['a\0x',1n,13n,'a\0x'],
   ['a ',1n,3n,'a '],['a\0x',1n,3n,'a\0x'],
  ]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER computed projection observes cancellation inside one long step and cleans up',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));
  s=db.prepare('SELECT hex(?1) FROM test1 AS a CROSS JOIN test1 AS b LIMIT 1').statement;
  s.bind(1,'z'.repeat(256*1024));
  const abort=new AbortController(),reason=new Error('injected INNER abort');
  setTimeout(()=>abort.abort(reason),0);
  let primary;try{await s.step({signal:abort.signal})}catch(error){primary=error}
  assert.equal(primary?.kind,'cancelled');
  assert.equal(primary?.message,'statement execution was cancelled');
  assert.equal(primary?.cause,reason);
  await assert.rejects(s.step(),error=>error===primary);
  assert.throws(()=>s.reset(),error=>error===primary);
  s.bind(1,'ok');assert.equal(await s.step(),'row');assert.equal(s.columnText(0),'6F6B');
  assert.equal(await s.step(),'done');
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER computed projection observes deadline inside one long step and cleans up',async()=>{
 const bridge=await startFixtureServer(root);let db,s;const realNow=Date.now;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select1-where`));
  s=db.prepare('SELECT hex(?1) FROM test1 AS a CROSS JOIN test1 AS b LIMIT 1').statement;
  s.bind(1,'z'.repeat(256*1024));
  let ticks=0;Date.now=()=>ticks++<10?1000:1002;
  let primary;try{await s.step({timeoutMs:2})}catch(error){primary=error}finally{Date.now=realNow}
  assert.equal(primary?.kind,'timeout');assert.equal(primary?.message,'statement execution timed out');
  await assert.rejects(s.step(),error=>error===primary);
  assert.throws(()=>s.reset(),error=>error===primary);
  s.bind(1,'ok');assert.equal(await s.step(),'row');assert.equal(s.columnText(0),'6F6B');
  assert.equal(await s.step(),'done');
 }finally{
  Date.now=realNow;
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER sorter observes cancellation while scanning and filling private state',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  const sql='SELECT a.x,b.x FROM t1 AS a CROSS JOIN t1 AS b ORDER BY b.x,a.x';
  s=db.prepare(sql).statement;
  const abort=new AbortController(),reason=new Error('injected sorter abort');setTimeout(()=>abort.abort(reason),0);
  let primary;try{await s.step({signal:abort.signal})}catch(error){primary=error}
  assert.equal(primary?.kind,'cancelled');assert.equal(primary?.message,'statement execution was cancelled');assert.equal(primary?.cause,reason);
  assert.throws(()=>s.finalize(),error=>error===primary);s=null;
  s=db.prepare('SELECT x FROM t1 ORDER BY x LIMIT 2').statement;
  assert.deepEqual(await rows(s),[[0n],[1n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public INNER sorter observes deadline while scanning and filling private state',async()=>{
 const bridge=await startFixtureServer(root);let db,s;const realNow=Date.now;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  s=db.prepare('SELECT a.x,b.x FROM t1 AS a CROSS JOIN t1 AS b ORDER BY b.x,a.x').statement;
  let ticks=0;Date.now=()=>ticks++<40?1000:1002;
  let primary;try{await s.step({timeoutMs:2})}catch(error){primary=error}finally{Date.now=realNow}
  assert.equal(primary?.kind,'timeout');assert.equal(primary?.message,'statement execution timed out');
  assert.throws(()=>s.finalize(),error=>error===primary);s=null;
  s=db.prepare('SELECT x FROM t1 ORDER BY x LIMIT 2').statement;
  assert.deepEqual(await rows(s),[[0n],[1n]]);
 }finally{
  Date.now=realNow;
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public unordered INNER product streams with zero private-state budgets',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`),{limits:{maxPrivateEntries:0,maxPrivateKeyBytes:0,maxPrivateBytes:0}});
  s=db.prepare('SELECT a.x,b.x FROM t1 AS a CROSS JOIN t1 AS b LIMIT 3').statement;
  assert.deepEqual(await rows(s),[[31n,31n],[31n,30n],[31n,29n]]);
  s.finalize();s=null;
  s=db.prepare('SELECT a.x,b.a FROM t1 AS a INNER JOIN t2 AS b ON b.a=a.y LIMIT 2').statement;
  assert.deepEqual(await rows(s),[[23n,1n],[13n,1n]]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public unordered INNER LIMIT stops before the remaining Cartesian product',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  s=db.prepare('SELECT a.x,b.x FROM t1 AS a CROSS JOIN t1 AS b LIMIT 1').statement;
  assert.equal(await s.step({maxWorkUnits:20}),'row');assert.deepEqual([s.column(0),s.column(1)],[31n,31n]);
  assert.equal(await s.step({maxWorkUnits:20}),'done');s.finalize();s=null;
  s=db.prepare('SELECT a.x,b.x FROM t1 AS a CROSS JOIN t1 AS b ORDER BY b.x,a.x LIMIT 1').statement;
  await assert.rejects(s.step({maxWorkUnits:20}),error=>error.kind==='limit'&&error.message==='statement exceeds maxWorkUnits');
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public heterogeneous USING and NATURAL use left collation and suppress the right column',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-collation`));
  for(const keyword of ['JOIN binary_values AS b USING(name)','NATURAL JOIN binary_values AS b']){
   s=db.prepare(`SELECT * FROM nocase_values AS n ${keyword}`).statement;
   assert.equal(s.columnCount,1);assert.deepEqual(s.columnMetadata(0),{name:'name',declaredType:'TEXT',database:'main',table:'nocase_values',origin:'name'});
   assert.deepEqual(await rows(s),[['a']]);s.finalize();s=null;
  }
  for(const keyword of ['JOIN nocase_values AS n USING(name)','NATURAL JOIN nocase_values AS n']){
   s=db.prepare(`SELECT * FROM binary_values AS b ${keyword}`).statement;
   assert.equal(s.columnCount,1);assert.deepEqual(s.columnMetadata(0),{name:'name',declaredType:'TEXT',database:'main',table:'binary_values',origin:'name'});
   assert.deepEqual(await rows(s),[]);s.finalize();s=null;
  }
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});

test('public three-source heterogeneous USING and NATURAL retain the first merged owner',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-collation`));
  for(const joins of ['JOIN binary_values AS b USING(name) JOIN binary_values AS c USING(name)','NATURAL JOIN binary_values AS b NATURAL JOIN binary_values AS c']){
   s=db.prepare(`SELECT * FROM nocase_values AS n ${joins}`).statement;
   assert.equal(s.columnCount,1);assert.deepEqual(s.columnMetadata(0),{name:'name',declaredType:'TEXT',database:'main',table:'nocase_values',origin:'name'});
   assert.deepEqual(await rows(s),[['a']]);s.finalize();s=null;
  }
  s=db.prepare('SELECT n.*,b.*,c.* FROM nocase_values AS n JOIN binary_values AS b USING(name) JOIN binary_values AS c USING(name)').statement;
  assert.deepEqual(Array.from({length:3},(_,i)=>s.columnMetadata(i).table),['nocase_values','binary_values','binary_values']);
  assert.deepEqual(await rows(s),[['a','A','A']]);
 }finally{
  try{s?.finalize()}catch{}
  try{db?.closeDeferred()}catch{}
  await closeTestServer(bridge.server);
 }
});
