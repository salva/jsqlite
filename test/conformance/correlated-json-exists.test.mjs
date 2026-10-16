import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';

// Nested jsonEachConnect/SrcItem resolution must retain the outer argument,
// then feed SRT_Exists rather than OpenRead on a fabricated schema table.
// The encoding fixtures each contain t1(a PRIMARY KEY,b,c), a='one'.
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
for(const encoding of ['utf8','utf16le','utf16be']) {
 // whereexpr.c sqlite3WhereTabFuncArgs rejects excess hidden arguments
 // during prepare, before evaluating even the JSON input expression.
 for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree']) {
  test(`standalone hidden argument arity ${module} in ${encoding}`,async()=>{
   const bridge=await startFixtureServer(root);let db;
   try {
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
    assert.throws(()=>db.prepare(`SELECT value FROM ${module}(json('malformed'),'$',0)`),error=>{
     assert.equal(error.code,1);
     assert.equal(error.message,`too many arguments on ${module}() - max 2`);
     return true;
    });
   } finally {db?.closeDeferred();await closeTestServer(bridge.server);}
  });
 }
 // whereexpr.c:sqlite3WhereTabFuncArgs also runs for retained SELECTs.
 // EList skipping in SRT_Exists and LIMIT 0 must not suppress prepare-time
 // hidden-column arity validation or evaluate the malformed JSON argument.
 for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree']) {
  test(`nested EXISTS hidden argument arity ${module} in ${encoding}`,async()=>{
   const bridge=await startFixtureServer(root);let db;
   try {
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
    assert.throws(()=>db.prepare(`SELECT EXISTS(SELECT 1 FROM ${module}(json('malformed'),'$',0) LIMIT 0)`),error=>{
     assert.equal(error.code,1);
     assert.equal(error.extendedCode,1);
     assert.equal(error.unsupportedClassification??null,null);
     assert.equal(error.message,`too many arguments on ${module}() - max 2`);
     return true;
    });
    const statement=db.prepare('SELECT 1').statement;
    try {
     assert.equal(await statement.step(),'row');
     assert.equal(statement.columnType(0),'integer');
     assert.equal(statement.columnInteger(0),1n);
     assert.equal(await statement.step(),'done');
    } finally {statement.finalize();}
   } finally {db?.closeDeferred();await closeTestServer(bridge.server);}
  });
 }
 // BestIndex plan0 must not evaluate a root-only argument, even when it
 // would throw if executed. Filter receives no argv and returns EOF.
 for(const sql of ["SELECT value FROM json_each", "SELECT value FROM json_each WHERE root=json('malformed')"]) {
  test(`standalone plan0 ${sql} in ${encoding}`,async()=>{
   const bridge=await startFixtureServer(root);let db,statement;
   try {
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
    statement=db.prepare(sql).statement;
    for(let run=0;run<2;run++){assert.equal(await statement.step(),'done');statement.reset();}
   } finally {try{statement?.finalize();}finally{db?.closeDeferred();await closeTestServer(bridge.server);}}
  });
 }
 for(const sql of [
  "SELECT value FROM json_each(json('malformed')) LIMIT 0",
  "SELECT value FROM json_each('[1]',json('malformed')) LIMIT 0",
  "SELECT value FROM json_each WHERE json=json('malformed') LIMIT 0",
 ]) {
  test(`standalone LIMIT zero bypasses argument evaluation ${sql} in ${encoding}`,async()=>{
   const bridge=await startFixtureServer(root);let db,statement;
   try {
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
    statement=db.prepare(sql).statement;
    for(let run=0;run<2;run++){assert.equal(await statement.step(),'done');statement.reset();}
   } finally {try{statement?.finalize();}finally{db?.closeDeferred();await closeTestServer(bridge.server);}}
  });
 }
 // resolve.c:lookupName validates EList before runtime LIMIT/Filter. A
 // declared module with an unknown column is a name error, not unsupported.
 for(const [label,sql] of [
  ['nonempty',"SELECT j.missing FROM json_each('[1]') j"],
  ['empty',"SELECT j.missing FROM json_each('[]') j"],
  ['LIMIT zero',"SELECT j.missing FROM json_each('malformed') j LIMIT 0"],
  ['wrong qualifier',"SELECT other.value FROM json_each('[1]') j"],
 ]) test(`standalone module validates column ${label} in ${encoding}`,async()=>{
  const bridge=await startFixtureServer(root);let db;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
   assert.throws(()=>db.prepare(sql),error=>{
    assert.equal(error.code,1);
    assert.equal(error.extendedCode,1);
    assert.equal(error.unsupportedClassification,null);
    assert.equal(error.message,`no such column: ${label==='wrong qualifier'?'other.value':'j.missing'}`);
    return true;
   });
   const statement=db.prepare('SELECT 1').statement;
   try {
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnInteger(0),1n);
    assert.equal(await statement.step(),'done');
   } finally {statement.finalize();}
  } finally {db?.closeDeferred();await closeTestServer(bridge.server);}
 });
 // Separate module enrollment from correlation and pFuncArg binding. The same
 // module must be executable both directly and through the shared Exists owner.
 for(const [label,sql,expected] of [
  ['standalone module',`SELECT value FROM json_each('["one"]')`,'one'],
  // No pFuncArg at all: hidden-column EQ must select the module input. This
  // distinguishes module declaration enrollment from table-function syntax.
  ['standalone hidden EQ',`SELECT value FROM json_each WHERE json='["one"]'`,'one'],
  ['standalone duplicate hidden EQ retains residual',`SELECT value FROM json_each WHERE json='["one"]' AND json='["one"]'`,'one'],
  ['standalone hidden root EQ',`SELECT value FROM json_each WHERE json='{"a":["one"]}' AND root='$.a'`,'one'],
  ['standalone argument retains explicit EQ',`SELECT value FROM json_each('["one"]') WHERE json='["one"]'`,'one'],
  ['uncorrelated nested hidden EQ',`SELECT EXISTS(SELECT 1 FROM json_each WHERE json='["one"]')`,1n],
  ['uncorrelated nested module',`SELECT EXISTS(SELECT 1 FROM json_each('["one"]'))`,1n],
  ['scalar module first',`SELECT (SELECT value FROM json_each('[4,5]'))`,4n],
  ['scalar module offset',`SELECT (SELECT value FROM json_each('[4,5]') LIMIT 1 OFFSET 1)`,5n],
  ['set module all rows',`SELECT 5 IN (SELECT value FROM json_each('[4,5]'))`,1n],
  ['set module offset',`SELECT 4 IN (SELECT value FROM json_each('[4,5]') LIMIT 1 OFFSET 1)`,0n],
  ['scalar module nested Exists',`SELECT (SELECT EXISTS(SELECT 1 FROM json_each('[1]')) FROM json_each('[4]'))`,1n],
  ['module aggregate shared input',`SELECT (SELECT count(*) FROM json_each('[4,5]'))`,2n],
  ['module aggregate sum register',`SELECT (SELECT sum(value) FROM json_each('[4,5]'))`,9n],
  ['module aggregate rowid register',`SELECT (SELECT sum(rowid) FROM json_each('[4,5]'))`,1n],
  ['module aggregate where',`SELECT (SELECT count(*) FROM json_each('[4,5]') WHERE value=5)`,1n],
  ['module aggregate empty',`SELECT (SELECT count(*) FROM json_each('[]'))`,0n],
  ['module aggregate limit zero',`SELECT (SELECT count(*) FROM json_each('malformed') LIMIT 0)`,null],
  ['module aggregate group',`SELECT (SELECT sum(value) FROM json_each('[4,5]') GROUP BY type)`,9n],
  ['module mixed selected input',`SELECT EXISTS(SELECT 1 FROM t1 CROSS JOIN json_each(json_array(t1.a)) j WHERE j.value=t1.a)`,1n],
  ['module mixed inherited IN predicate',`SELECT EXISTS(SELECT 1 FROM t1 a WHERE a.a IN (SELECT j.value FROM t1 b CROSS JOIN json_each(json_array(a.a)) j))`,1n],
  ['module mixed inherited scalar projection',`SELECT (SELECT (SELECT j.value FROM t1 b CROSS JOIN json_each(json_array(a.a)) j) FROM t1 a)`,"one"],
  ['module mixed aggregate WHERE',`SELECT (SELECT count(*) FROM t1 CROSS JOIN json_each('[4,5]') j WHERE j.value=5)`,1n],
  ['module mixed aggregate GROUP',`SELECT (SELECT sum(j.value) FROM t1 CROSS JOIN json_each('[4,5]') j GROUP BY j.type)`,9n],
  ['module mixed aggregate empty LEFT',`SELECT (SELECT count(j.value) FROM t1 LEFT JOIN json_each('[]') j ON 1)`,0n],
  ['module mixed aggregate correlated',`SELECT (SELECT (SELECT count(*) FROM t1 b CROSS JOIN json_each(json_array(a.a)) j WHERE j.value=a.a) FROM t1 a)`,1n],
  ['module mixed aggregate correlated LEFT',`SELECT (SELECT (SELECT count(j.value) FROM t1 b LEFT JOIN json_each(json_array(a.a)) j ON j.value='absent') FROM t1 a)`,0n],
  ['module mixed aggregate correlated GROUP',`SELECT (SELECT (SELECT sum(j.rowid) FROM t1 b CROSS JOIN json_each(json_array(a.a,a.a)) j GROUP BY j.type) FROM t1 a)`,1n],
  ['module mixed aggregate LIMIT zero',`SELECT (SELECT count(*) FROM t1 CROSS JOIN json_each(json('malformed')) j LIMIT 0)`,null],
  ['module mixed aggregate count',`SELECT (SELECT count(*) FROM t1 CROSS JOIN json_each('[4,5]') j)`,2n],
  ['module mixed aggregate rowid',`SELECT (SELECT sum(j.rowid) FROM t1 CROSS JOIN json_each('[4,5]') j)`,1n],
  ['module mixed inherited binding',`SELECT EXISTS(SELECT 1 FROM t1 a WHERE EXISTS(SELECT 1 FROM t1 b CROSS JOIN json_each(json_array(a.a)) j WHERE j.value=a.a))`,1n],
  ['module mixed hidden EQ',`SELECT (SELECT j.value FROM t1 CROSS JOIN json_each j WHERE j.json='[4,5]' AND j.value=5)`,5n],
  ['module mixed NULL input',`SELECT EXISTS(SELECT 1 FROM t1 CROSS JOIN json_each(NULL) j)`,0n],
  ['module mixed OFFSET',`SELECT (SELECT j.value FROM t1 CROSS JOIN json_each('[4,5]') j LIMIT 1 OFFSET 1)`,5n],
  ['module mixed rowid',`SELECT (SELECT j.rowid FROM t1 CROSS JOIN json_each('[4,5]') j WHERE j.value=5)`,1n],
  ['module mixed nested predicate',`SELECT EXISTS(SELECT 1 FROM t1 CROSS JOIN json_each('[4,5]') j WHERE EXISTS(SELECT 1 FROM json_each(json_array(j.value)) k WHERE k.value=5))`,1n],
  ['module mixed nested scalar',`SELECT (SELECT (SELECT k.value FROM json_each(json_array(j.value)) k) FROM t1 CROSS JOIN json_each('[4,5]') j WHERE j.value=5)`,5n],
  ['module mixed second row',`SELECT EXISTS(SELECT 1 FROM t1 CROSS JOIN json_each('[4,5]') j WHERE j.value=5)`,1n],
  ['module mixed scalar payload',`SELECT (SELECT j.value FROM t1 CROSS JOIN json_each('[4,5]') j WHERE j.value=5)`,5n],
  ['module mixed IN full scan',`SELECT 5 IN (SELECT j.value FROM t1 CROSS JOIN json_each('[4,5]') j)`,1n],
  ['module mixed LEFT null row',`SELECT (SELECT j.value FROM t1 LEFT JOIN json_each('[]') j ON j.value=5)`,null],
  ['module mixed LEFT on rejection',`SELECT (SELECT j.value FROM t1 LEFT JOIN json_each('[4,5]') j ON j.value=6)`,null],
  ['module mixed LEFT matched',`SELECT (SELECT j.value FROM t1 LEFT JOIN json_each('[4,5]') j ON j.value=5)`,5n],
  ['module mixed LIMIT bypass',`SELECT EXISTS(SELECT 1 FROM t1 CROSS JOIN json_each('malformed') j LIMIT 0)`,0n],
  // select.c:selectInnerLoop skips EList code for SRT_Exists. Enrollment
  // must still validate names during prepare, but runtime projection errors
  // must not be evaluated, even while OFFSET discards the first input row.
  ['nested Exists skips throwing projection',`SELECT EXISTS(SELECT json('malformed') FROM json_each('[1]'))`,1n],
  ['nested Exists skips projection before OFFSET',`SELECT EXISTS(SELECT json('malformed') FROM json_each('[1,2]') LIMIT 1 OFFSET 1)`,1n],
  ['nested Exists empty input',`SELECT EXISTS(SELECT json('malformed') FROM json_each('[]'))`,0n],
  ['nested Exists NULL input',`SELECT EXISTS(SELECT json('malformed') FROM json_each(NULL))`,0n],
  ['nested Exists LIMIT zero skips Filter',`SELECT EXISTS(SELECT 1 FROM json_each('malformed') LIMIT 0)`,0n],
  // jsonEachFilter parses JSON before ROOT, but NULL JSON returns before
  // path validation. Exercise those branches through the linked destination.
  ['nested dynamic root',`SELECT EXISTS(SELECT 1 FROM json_each('{"a":[1]}', '$.'||'a') j WHERE j.value=1)`,1n],
  ['nested NULL JSON precedes bad root',`SELECT EXISTS(SELECT 1 FROM json_each(NULL, 'bad'))`,0n],
  ['nested valid JSON NULL root',`SELECT EXISTS(SELECT 1 FROM json_each('[1]', NULL))`,0n],
 ]) test(`JSON EXISTS enrollment control ${label} in ${encoding}`,async()=>{
  const bridge=await startFixtureServer(root);let db,statement;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
   statement=db.prepare(sql).statement;
   assert.equal(statement.columnCount,1);
   for(let run=0;run<2;run++) {
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnType(0),expected===null?'null':typeof expected==='bigint'?'integer':'text');
    assert.equal(typeof expected==='bigint'?statement.columnInteger(0):statement.columnText(0),expected);
    assert.equal(await statement.step(),'done');
    statement.reset();
   }
  } finally {try{statement?.finalize();}finally{db?.closeDeferred();await closeTestServer(bridge.server);}}
 });
 // json.c:jsonEachFilter parses argv[0] before testing a NULL argv[1].
 // NULL root must not mask malformed JSON; after the error/reset the same
 // statement must fail consistently and an independent statement must recover.
 for(const [label,sql] of [
  ['standalone',"SELECT value FROM json_each('malformed',NULL)"],
  ['nested',"SELECT EXISTS(SELECT 1 FROM json_each('malformed',NULL))"],
 ]) test(`JSON Filter malformed input precedes NULL root ${label} in ${encoding}`,async()=>{
  const bridge=await startFixtureServer(root);let db,statement;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
   statement=db.prepare(sql).statement;
   for(let run=0;run<2;run++) {
    let saved;
    await assert.rejects(()=>statement.step(),error=>{
     saved=error;
     assert.equal(error.code,1);
     assert.equal(error.extendedCode,1);
     assert.equal(error.unsupportedClassification??null,null);
     assert.match(error.message,/malformed JSON/);
     return true;
    });
    assert.throws(()=>statement.reset(),error=>error===saved);
   }
   const recovery=db.prepare('SELECT 1').statement;
   try {
    assert.equal(await recovery.step(),'row');
    assert.equal(recovery.columnInteger(0),1n);
    assert.equal(await recovery.step(),'done');
   } finally {recovery.finalize();}
  } finally {try{statement?.finalize();}finally{db?.closeDeferred();await closeTestServer(bridge.server);}}
 });
 // resolve.c:resolveSelectStep resolves the complete EList before WHERE and
 // LIMIT code generation. SRT_Exists suppresses value production, not prepare
 // validation: neither an empty source nor LIMIT 0 hides an invalid name.
 for(const [label,sql] of [
  ['nonempty source',"SELECT EXISTS(SELECT j.missing FROM json_each('[1]') j)"],
  ['empty source',"SELECT EXISTS(SELECT j.missing FROM json_each('[]') j)"],
  ['LIMIT zero',"SELECT EXISTS(SELECT j.missing FROM json_each('malformed') j LIMIT 0)"],
 ]) test(`nested JSON EXISTS validates EList ${label} in ${encoding}`,async()=>{
  const bridge=await startFixtureServer(root);let db;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
   assert.throws(()=>db.prepare(sql),error=>{
    assert.equal(error.code,1);
    assert.equal(error.extendedCode,1);
    assert.equal(error.unsupportedClassification,null);
    assert.equal(error.message,'no such column: j.missing');
    return true;
   });
   // Failed preparation must not poison the connection or leave a module
   // cursor alive. This is an API recovery control, not a budget receipt.
   const statement=db.prepare('SELECT 1').statement;
   try {
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnInteger(0),1n);
    assert.equal(await statement.step(),'done');
   } finally {statement.finalize();}
  } finally {db?.closeDeferred();await closeTestServer(bridge.server);}
 });
 for(const [label,sql] of [
  ['argument-only',"SELECT a FROM t1 WHERE EXISTS(SELECT 1 FROM json_each(json_array(t1.a)) j)"],
  ['predicate-only',"SELECT a FROM t1 WHERE EXISTS(SELECT 1 FROM json_each('[\"one\"]') j WHERE j.value=t1.a)"],
 ]) test(`correlated JSON EXISTS ${label} in ${encoding}`,async()=>{
  const bridge=await startFixtureServer(root);let db,statement;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
   statement=db.prepare(sql).statement;
   assert.equal(statement.columnCount,1);
   assert.deepEqual(statement.columnMetadata(0),{name:'a',declaredType:null,database:'main',table:'t1',origin:'a'});
   for(let run=0;run<2;run++) {
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnType(0),'text');
    assert.equal(statement.columnText(0),'one');
    assert.equal(await statement.step(),'done');
    statement.reset();
   }
  } finally {try{statement?.finalize();}finally{db?.closeDeferred();await closeTestServer(bridge.server);}}
 });
 test(`correlated JSON EXISTS retains linked outer argument in ${encoding}`,async()=>{
  const bridge=await startFixtureServer(root);let db,statement;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
   statement=db.prepare("SELECT a FROM t1 WHERE EXISTS(SELECT 1 FROM json_each(json_array(t1.a)) j WHERE j.value=t1.a)").statement;
   assert.equal(statement.columnCount,1);
   assert.deepEqual(statement.columnMetadata(0),{name:'a',declaredType:null,database:'main',table:'t1',origin:'a'});
   for(let run=0;run<2;run++) {
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnType(0),'text');
    assert.equal(statement.columnText(0),'one');
    assert.equal(await statement.step(),'done');
    statement.reset();
   }
  } finally {try{statement?.finalize();}finally{db?.closeDeferred();await closeTestServer(bridge.server);}}
 });
}

// resolve.c:resolveSelectStep resolves LIMIT/OFFSET in an empty NameContext
// before expanding sources. Linked JSON arguments may capture outer columns;
// those same columns must not leak into either limiting clause. In particular,
// a missing module enrollment must not mask this earlier prepare-time error.
for(const encoding of ['utf8','utf16le','utf16be']) {
 for(const clause of ['LIMIT t1.a','LIMIT 1 OFFSET t1.a']) {
  test(`nested JSON EXISTS keeps limiting context empty (${clause}) in ${encoding}`,async()=>{
   const bridge=await startFixtureServer(root);let db;
   try {
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
    assert.throws(()=>db.prepare(`SELECT a FROM t1 WHERE EXISTS(SELECT 1 FROM json_each(json_array(t1.a)) j ${clause})`),error=>{
     assert.equal(error.code,1);
     assert.equal(error.extendedCode,1);
     assert.equal(error.unsupportedClassification,null);
     assert.equal(error.message,'no such column: t1.a');
     return true;
    });
    const statement=db.prepare('SELECT 1').statement;
    try {
     for(let run=0;run<2;run++) {
      assert.equal(await statement.step(),'row');
      assert.equal(statement.columnInteger(0),1n);
      assert.equal(await statement.step(),'done');
      statement.reset();
     }
    } finally {statement.finalize();}
   } finally {db?.closeDeferred();await closeTestServer(bridge.server);}
  });
 }
}

for(const encoding of ['utf8','utf16le','utf16be'])test(`retained physical aggregate input owns ephemeral storage in ${encoding}`,async()=>{
 const bridge=await startFixtureServer(root);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
  const statement=db.prepare("WITH c AS (SELECT a FROM t1) SELECT c.a,count(j.value) FROM c JOIN json_each(json_array(c.a)) j GROUP BY c.a").statement;
  try{for(let run=0;run<2;run++){
   assert.equal(await statement.step(),'row');assert.equal(statement.column(0),'one');assert.equal(statement.column(1),1n);assert.equal(await statement.step(),'done');statement.reset();
  }}finally{statement.finalize();}
 }finally{db?.closeDeferred();await closeTestServer(bridge.server);}
});
