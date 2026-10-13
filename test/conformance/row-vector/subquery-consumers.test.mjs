import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from '../public-api-adapter.mjs';

// expr.c codeVectorCompare/exprVectorRegister/sqlite3CodeSubselect:
// SELECT vectors are operands, EXISTS is never an SRT_Mem destination.
for(const encoding of ['utf8','utf16le','utf16be'])test(`shared SELECT vector consumers ${encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [sql,expected] of [
   ['SELECT (SELECT a,b FROM pairs LIMIT 1)=(SELECT CAST(a AS TEXT),b FROM pairs LIMIT 1) AS result',1n],
   ['SELECT (SELECT a,b FROM pairs LIMIT 1) IN (SELECT CAST(a AS TEXT),b FROM pairs) AS result',1n],
   ['SELECT (SELECT * FROM pairs LIMIT 1) IN (SELECT id,a,b FROM pairs) AS result',1n],
   ['SELECT (SELECT * FROM pairs LIMIT 1)=(SELECT id,a,b FROM pairs LIMIT 1) AS result',1n],
   ['SELECT (SELECT * FROM pairs LIMIT 1)=(SELECT id,CAST(a AS TEXT),b FROM pairs LIMIT 1) AS result',1n],
   ['SELECT (SELECT * FROM pairs LIMIT 1) IN (SELECT id,CAST(a AS TEXT),b FROM pairs) AS result',1n],
   ["SELECT (SELECT * FROM pairs LIMIT 1)=(SELECT '0'||id,a,b FROM pairs LIMIT 1) AS result",1n],
   ['SELECT EXISTS(SELECT * FROM pairs) AS result FROM pairs p JOIN pairs q ON p.id=q.id LIMIT 1',1n],
   ['SELECT (SELECT * FROM pairs LIMIT 1)=(SELECT id,a,b FROM pairs LIMIT 1) AS result FROM pairs p JOIN pairs q ON p.id=q.id LIMIT 1',1n],
   ['SELECT sum(EXISTS(SELECT * FROM pairs r WHERE r.id=p.id AND p.id=1)) AS result FROM pairs p',1n],
   ['SELECT (SELECT count(*),sum(id) FROM pairs)=(4,10) AS result',1n],
   ['SELECT EXISTS(SELECT count(*),sum(id) FROM pairs) AS result',1n],
   ['SELECT (SELECT id,a,b FROM pairs WHERE id=1 UNION ALL SELECT id,a,b FROM pairs WHERE id=2)=(SELECT id,a,b FROM pairs WHERE id=1) AS result',1n],
   ['SELECT (SELECT id,a,b FROM pairs WHERE id=0 UNION ALL SELECT id,a,b FROM pairs WHERE id=1)=(SELECT id,a,b FROM pairs WHERE id=1) AS result',1n],
   ['SELECT (SELECT id,a,b FROM pairs WHERE id=1 UNION ALL SELECT id,a,b FROM pairs WHERE id=2 LIMIT 1 OFFSET 1)=(SELECT id,a,b FROM pairs WHERE id=2) AS result',1n],
   ['SELECT EXISTS(SELECT id,a,b FROM pairs WHERE id=0 UNION ALL SELECT id,a,b FROM pairs WHERE id=0) AS result',0n],
   ['SELECT (SELECT id,a,b FROM pairs WHERE id=2) IN (SELECT id,a,b FROM pairs WHERE id=1 UNION ALL SELECT id,a,b FROM pairs WHERE id=2 LIMIT 1 OFFSET 1) AS result',1n],
   ['SELECT (SELECT id,a,b FROM pairs WHERE id=2) IN (SELECT id,a,b FROM pairs WHERE id=1 UNION ALL SELECT id,a,b FROM pairs WHERE id=2 LIMIT 1) AS result',0n],
   ["SELECT (SELECT 'a' COLLATE BINARY,1)=(SELECT 'A' COLLATE NOCASE,1) AS result",0n],
   ["SELECT (SELECT 'a',1)=(SELECT 'A' COLLATE NOCASE,1) AS result",1n],
   ["SELECT (SELECT 'a',1) IN (SELECT 'A' COLLATE NOCASE,1) AS result",1n],
   ["SELECT (SELECT b,id FROM pairs WHERE id=1)=(SELECT upper(b) COLLATE NOCASE,id FROM pairs WHERE id=1) AS result",1n],
   ["SELECT (SELECT b,id FROM pairs WHERE id=1) IN (SELECT upper(b) COLLATE NOCASE,id FROM pairs WHERE id=1) AS result",1n],
   ["SELECT (SELECT b,id FROM pairs WHERE id=1)=(SELECT upper(b) COLLATE BINARY,id FROM pairs WHERE id=1) AS result",0n],
   ["SELECT (SELECT b,id FROM pairs WHERE id=1) IN (SELECT upper(b) COLLATE BINARY,id FROM pairs WHERE id=1) AS result",0n],
   ["SELECT (SELECT b FROM pairs WHERE id=1)=(SELECT upper(b) FROM pairs WHERE id=1) AS result",0n],
   ["SELECT (SELECT a FROM pairs WHERE id=1)='01' AS result",1n],
   ["SELECT (SELECT a FROM pairs WHERE id=1 UNION ALL SELECT CAST(a AS TEXT) FROM pairs WHERE id=2)='01' AS result",0n],
   ["SELECT (SELECT CAST(a AS TEXT) FROM pairs WHERE id=1 UNION ALL SELECT a FROM pairs WHERE id=2)='01' AS result",1n],
   ["SELECT (SELECT (SELECT a FROM pairs WHERE id=1),1)=('01',1) AS result",1n],
   ["SELECT (SELECT (SELECT * FROM (SELECT a FROM pairs WHERE id=1)),1)=('01',1) AS result",1n],
   ['SELECT EXISTS(SELECT * FROM pairs) AS result',1n],
   ['SELECT EXISTS(SELECT * FROM pairs WHERE 0) AS result',0n],
   ['SELECT EXISTS(SELECT p.* FROM pairs p) AS result',1n],
   ['SELECT EXISTS(SELECT 7,2) AS result',1n],
   ['SELECT EXISTS(SELECT 7,2 WHERE 0) AS result',0n],
   ['SELECT (SELECT 1,2)=(SELECT 1,2) AS result',1n],
   ['SELECT (SELECT 1,2) IN (SELECT 1,2) AS result',1n],
   ['SELECT (SELECT 1,2) NOT IN (SELECT 1,2 WHERE 0) AS result',1n],
   ['SELECT (SELECT 1,2 WHERE 0)=(SELECT 1,2) AS result',null],
   ['SELECT (SELECT 1,2 UNION ALL SELECT 9,9)=(SELECT 1,2) AS result',1n],
   ['SELECT (SELECT 1,2 LIMIT 0)=(SELECT 1,2) AS result',null],
  ]){
   const st=db.prepare(sql).statement;
   try{
    assert.equal(st.columnCount,1);assert.equal(st.columnMetadata(0).name,'result');
    for(let run=0;run<2;run++){
     assert.equal(await st.step(),'row');assert.equal(st.column(0),expected,sql);
     assert.equal(st.columnType(0),expected===null?'null':'integer');
     assert.equal(await st.step(),'done');st.reset();
    }
   }finally{st.finalize()}
  }
  for(const [sql,expected] of [
   ["SELECT p.a IN (VALUES('01'),(NULL)) AS result FROM pairs p",[1n,null,null,1n]],
   ["SELECT '01' IN (VALUES(0),(p.a)) AS result FROM pairs p",[1n,0n,null,1n]],
   ['SELECT EXISTS(VALUES(abs(-9223372036854775808),p.a),(1,p.id)) AS result FROM pairs p',[1n,1n,1n,1n]],
   ['SELECT EXISTS(SELECT abs(-9223372036854775808),p.a UNION ALL SELECT 1,p.id) AS result FROM pairs p',[1n,1n,1n,1n]],
   ['SELECT EXISTS(SELECT abs(-9223372036854775808),p.a LIMIT (SELECT id FROM pairs WHERE id=1) OFFSET (SELECT id FROM pairs WHERE id=1)) AS result FROM pairs p',[0n,0n,0n,0n]],
   ['SELECT EXISTS(SELECT abs(-9223372036854775808),p.a LIMIT (SELECT id FROM pairs WHERE id=1)) AS result FROM pairs p',[1n,1n,1n,1n]],
   ['SELECT EXISTS(SELECT * FROM pairs r WHERE r.id=p.id LIMIT 1 OFFSET (SELECT id FROM pairs WHERE id=1)) AS result FROM pairs p',[0n,0n,0n,0n]],
   ['SELECT EXISTS(SELECT * FROM pairs r WHERE r.id=p.id LIMIT (SELECT id FROM pairs WHERE id=1)) AS result FROM pairs p',[1n,1n,1n,1n]],
   ['SELECT EXISTS(SELECT * FROM pairs r WHERE r.id=p.id LIMIT 0 OFFSET (SELECT id FROM pairs WHERE id=1)) AS result FROM pairs p',[0n,0n,0n,0n]],
   ['SELECT (SELECT r.a FROM pairs r WHERE r.id=p.id LIMIT 1 OFFSET (SELECT id FROM pairs WHERE id=1)) AS result FROM pairs p',[null,null,null,null]],
   ['SELECT (SELECT r.a FROM pairs r WHERE r.id=p.id LIMIT (SELECT id FROM pairs WHERE id=1)) AS result FROM pairs p',[1n,2n,null,1n]],
   ['SELECT p.a IN (SELECT p.a LIMIT 1 OFFSET (SELECT id FROM pairs WHERE id=1)) AS result FROM pairs p',[0n,0n,0n,0n]],
   ['SELECT p.a IN (SELECT p.a LIMIT (SELECT id FROM pairs WHERE id=1)) AS result FROM pairs p',[1n,1n,null,1n]],
   ['SELECT p.a IN (SELECT p.a LIMIT (SELECT 1)) AS result FROM pairs p',[1n,1n,null,1n]],
   ['SELECT p.a IN (SELECT p.a LIMIT 1 OFFSET (SELECT 1)) AS result FROM pairs p',[0n,0n,0n,0n]],
   ['SELECT p.a IN (SELECT p.a WHERE p.id=1) AS result FROM pairs p',[1n,0n,0n,0n]],
   ['SELECT p.a NOT IN (SELECT NULL WHERE 0) AS result FROM pairs p',[1n,1n,1n,1n]],
   ['SELECT p.a IN (SELECT NULL WHERE 0) AS result FROM pairs p',[0n,0n,0n,0n]],
   ['SELECT p.a IN (VALUES(0),(p.a)) AS result FROM pairs p',[1n,1n,null,1n]],
   ['SELECT (SELECT p.a IN (VALUES(0),(p.a)),1)=(1,1) AS result FROM pairs p',[1n,1n,null,1n]],
   ['SELECT (SELECT (SELECT * FROM (SELECT a FROM pairs r WHERE r.id=p.id)),1)=(p.a,1) AS result FROM pairs p',[1n,1n,null,1n]],
   ['SELECT (SELECT (SELECT a FROM pairs r WHERE r.id=p.id),1)=(p.a,1) AS result FROM pairs p',[1n,1n,null,1n]],
   ['SELECT (SELECT id,a,b FROM pairs r WHERE r.id=p.id) IN (SELECT id,a,b FROM pairs r WHERE r.id=0 UNION ALL SELECT id,a,b FROM pairs r WHERE r.id=p.id) AS result FROM pairs p',[1n,1n,null,1n]],
   ['SELECT EXISTS(SELECT * FROM pairs r WHERE r.id=p.id AND p.id=1) AS result FROM pairs p JOIN pairs q ON p.id=q.id',[1n,0n,0n,0n]],
   ['SELECT (SELECT * FROM pairs r WHERE r.id=p.id) IN (SELECT id,a,b FROM pairs r WHERE r.id=p.id) AS result FROM pairs p JOIN pairs q ON p.id=q.id',[1n,1n,null,1n]],
  ]){const st=db.prepare(sql).statement;try{for(let run=0;run<2;run++){for(const value of expected){assert.equal(await st.step(),'row');assert.equal(st.column(0),value,sql);assert.equal(st.columnType(0),value===null?'null':'integer');}assert.equal(await st.step(),'done');st.reset();}}finally{st.finalize();}}
  for(let attempt=0;attempt<2;attempt++)assert.throws(()=>db.prepare('SELECT (SELECT id,a,b FROM pairs WHERE id=1 UNION SELECT id,a,b FROM pairs WHERE id=2)=(SELECT id,a,b FROM pairs WHERE id=1) AS result'),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary');
  // A wide child must rerun against the current linked outer row; its
  // zero-row destination must reset from the preceding nonempty invocation.
  const correlated=db.prepare('SELECT EXISTS(SELECT p.a,p.b WHERE p.a=1) AS hit FROM pairs p ORDER BY p.a').statement;
  const expectedSource=db.prepare('SELECT p.a=1 AS hit FROM pairs p ORDER BY p.a').statement;
  try{
   for(let run=0;run<2;run++){
    while(await expectedSource.step()==='row'){
     assert.equal(await correlated.step(),'row');
     assert.equal(correlated.column(0),expectedSource.column(0)===1n?1n:0n);
    }
    assert.equal(await correlated.step(),'done');correlated.reset();expectedSource.reset();
   }
  }finally{correlated.finalize();expectedSource.finalize()}
  // resolve.c resolveSelectStep uses an empty NameContext for LIMIT/OFFSET:
  // neither local nor correlated column names are legal in these clauses.
  for(const [sql,message] of [
   ['SELECT EXISTS(VALUES(1),(missing))','no such column: missing'],
   ['SELECT (VALUES(1),(missing))','no such column: missing'],
   ['SELECT 1 IN (VALUES(1),(missing))','no such column: missing'],
   ['SELECT EXISTS(VALUES(1),(1,2))','all VALUES must have the same number of terms'],
   ['SELECT 1 IN (VALUES(1),(1,2))','all VALUES must have the same number of terms'],
   ['SELECT EXISTS(SELECT 1 UNION ALL VALUES(1,2))','all VALUES must have the same number of terms'],
   ['SELECT EXISTS(VALUES(1,2) UNION ALL SELECT 1)','SELECTs to the left and right of UNION ALL do not have the same number of result columns'],
   ['SELECT 1 IN (SELECT id FROM pairs UNION ALL SELECT id,a FROM pairs)','SELECTs to the left and right of UNION ALL do not have the same number of result columns'],
   ['SELECT (SELECT id FROM pairs UNION ALL SELECT id,a FROM pairs)','SELECTs to the left and right of UNION ALL do not have the same number of result columns'],
   ['SELECT (SELECT id,a FROM pairs UNION ALL SELECT id,a FROM pairs)','sub-select returns 2 columns - expected 1'],
   ['SELECT EXISTS(SELECT id FROM pairs UNION ALL SELECT id,a FROM pairs) AS result','SELECTs to the left and right of UNION ALL do not have the same number of result columns'],
   ['SELECT EXISTS(SELECT 1,2 LIMIT 1 OFFSET p.a) FROM pairs p','no such column: p.a'],
   ['SELECT EXISTS(SELECT 1,2 LIMIT p.a) FROM pairs p','no such column: p.a'],
   ['SELECT (SELECT * FROM pairs LIMIT 1)','sub-select returns 3 columns - expected 1'],
   ['SELECT abs((SELECT * FROM pairs LIMIT 1))','sub-select returns 3 columns - expected 1'],
   ['SELECT 1+(SELECT * FROM pairs LIMIT 1)','sub-select returns 3 columns - expected 1'],
   ['SELECT EXISTS(SELECT 1,2 LIMIT 1 OFFSET missing)','no such column: missing'],
  ])for(let attempt=0;attempt<2;attempt++)assert.throws(()=>{const unexpected=db.prepare(sql);unexpected.finalize();},e=>e.kind==='sqlite'&&e.code===1&&e.message===message);
  assert.throws(()=>db.prepare('SELECT (SELECT 1,2)'),e=>e.kind==='sqlite'&&e.code===1&&e.message==='sub-select returns 2 columns - expected 1');
  assert.throws(()=>db.prepare('SELECT (SELECT 1,2) IN (SELECT 1)'),e=>e.kind==='sqlite'&&e.code===1&&e.message==='sub-select returns 1 columns - expected 2');
 }finally{await db?.close();await new Promise(resolve=>server.close(resolve))}
});
