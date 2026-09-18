import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import * as vdbe from '../../src/internal/vdbe.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

const fixtures = path.resolve(new URL('../fixtures', import.meta.url).pathname);

const column = (name) => Object.freeze({
  name,
  declaredType: 'INTEGER',
  affinity: 'integer',
  collation: null,
});
const table = Object.freeze({
  kind: 'table',
  name: 't1',
  tableName: 't1',
  rootPage: 2,
  sql: '',
  columns: Object.freeze([column('a'), column('b')]),
  indexes: Object.freeze([]),
  withoutRowid: false,
  primaryKey: Object.freeze([]),
  storageKey: Object.freeze([]),
});
const schema = {tables: new Map([['t1', table]])};
const resolve = (sql) => expandAndResolveSelect(parseSql(sql).statement, schema);

// Pinned SQLite 3.53.4 window.c:sqlite3WindowRewrite is the required handoff
// between the resolved Window graph and ordinary SELECT/coroutine lowering.
test('compiler exposes the source-shaped window rewrite handoff', () => {
  assert.equal(
    typeof vdbe.sqlite3WindowRewrite,
    'function',
    'resolved windows currently have no sqlite3WindowRewrite-shaped compiler handoff',
  );
});

test('rewrite shares compatible windows and nests incompatible windows in source order', () => {
  const resolved = resolve(
    'SELECT sum(a) OVER w, avg(a) OVER w, row_number() OVER (ORDER BY a) ' +
    'FROM t1 WHERE a > 0 WINDOW w AS (PARTITION BY b ORDER BY a) ' +
    'ORDER BY b LIMIT 2 OFFSET 1',
  );
  const graph = vdbe.sqlite3WindowRewrite(resolved);

  assert.deepEqual(
    graph.layers.map((layer) => layer.windows.map((entry) => entry.window.functionName)),
    [['sum', 'avg'], ['row_number']],
    'compatible functions must share one producer scan while the first incompatible window owns a later nested layer',
  );
  assert.deepEqual(
    graph.layers.map((layer) => layer.compatibleGroup),
    [0, 1],
    'nested rewrite order must follow resolved source occurrence, not a host sort or partition bucket',
  );
  assert.equal(graph.multipleWindowPartitions, true);

  const [shared, nested] = graph.layers;
  assert.ok(shared && nested);
  assert.equal(shared.producer.nonFlattenable, true);
  assert.equal(shared.producer.kind, 'original');
  assert.equal(shared.producer.from, resolved.source.from);
  assert.equal(shared.producer.where, resolved.source.where);
  assert.equal(nested.producer.kind, 'rewritten-select');
  assert.equal(nested.producer.select.compatibleGroup, shared.compatibleGroup);
  assert.equal(graph.outer.originalOrderBy, resolved.source.orderBy);
  assert.deepEqual(graph.outer.orderBy, [], 'parent ORDER BY prefix is elided when the producer sort already supplies it');
  assert.equal(graph.outer.orderPrefixElided, true);
  assert.equal(graph.outer.limit, resolved.source.limit);
  assert.equal(graph.outer.offset, resolved.source.offset);
  assert.deepEqual(graph.movedClauses, ['from', 'where', 'groupBy', 'having']);
  assert.deepEqual(graph.retainedClauses, ['orderBy', 'limit', 'offset']);

  assert.deepEqual(shared.duplicateCursors, [shared.iEphCsr + 1, shared.iEphCsr + 2, shared.iEphCsr + 3]);
  assert.equal(nested.iEphCsr, shared.iEphCsr + 4, 'each layer owns one ephemeral cursor and three OpenDup cursors');
  assert.deepEqual(shared.handoff, [
    {code: 'Gosub', register: shared.regGosub, address: shared.addrGosub},
    {code: 'Return', register: shared.regGosub},
  ]);
  assert.notEqual(shared.regGosub, nested.regGosub);
  assert.equal(graph.frameExecution, 'unsupported');
});

test('incompatible rewrites form recursive producer ownership and compile inside-out', () => {
  const resolved = resolve(
    'SELECT sum(a) OVER (PARTITION BY b), row_number() OVER (ORDER BY a), ' +
    'avg(b) OVER (ORDER BY b) FROM t1 WHERE a > 0 GROUP BY a HAVING b > 0',
  );
  const compilation = vdbe.compileWindowSelectSetup(resolved, 'utf-8');
  const {rewrite} = compilation;

  const walked = [];
  let select = rewrite.root;
  while (select) {
    walked.push(select.compatibleGroup);
    select = select.subquery.kind === 'rewritten-select' ? select.subquery.select : null;
  }
  assert.deepEqual(walked, [2, 1, 0], 'outer rewrite must consume the previously rewritten SELECT');
  const originalOwners = rewrite.layers.filter((layer) => layer.producer.kind === 'original');
  assert.equal(originalOwners.length, 1, 'original clauses must have exactly one producer owner');
  assert.equal(originalOwners[0].producer.from, resolved.source.from);
  assert.equal(originalOwners[0].producer.where, resolved.source.where);
  assert.equal(originalOwners[0].producer.groupBy, resolved.source.groupBy);
  assert.equal(originalOwners[0].producer.having, resolved.source.having);
  for (const layer of rewrite.layers.slice(1)) {
    assert.equal(layer.producer.kind, 'rewritten-select');
    assert.equal(layer.producer.parentCompatibleGroup, layer.compatibleGroup);
  }

  assert.deepEqual(
    compilation.program.ops.filter((op) => op.code === 'OpenEphemeral').map((op) => op.p1),
    rewrite.layers.map((layer) => layer.iEphCsr),
    'compiler setup must visit the recursive graph inside-out, matching sqlite3Select recursion',
  );
});

test('rewrite lifts each window-function argument instead of the owner expression', () => {
  const resolved = resolve('SELECT group_concat(a, b) OVER () FROM t1');
  const graph = vdbe.sqlite3WindowRewrite(resolved);
  const layer = graph.layers[0];
  const window = layer?.windows[0];

  assert.ok(layer && window);
  assert.equal(window.argumentColumn, 0);
  assert.equal(
    layer.bufferExpressions.length,
    2,
    'window.c appends both entries from pOwner->x.pList to the producer result list',
  );
  assert.deepEqual(
    layer.bufferExpressions.map((expr) => expr.tokens.map((token) => token.text).join('')),
    ['a', 'b'],
  );
  assert.notEqual(layer.bufferExpressions[0], resolved.windows[0]?.owner);
});

test('rewrite copies integer window sort terminals to NULL without mutating the frame expression', () => {
  const resolved = resolve('SELECT sum(a) OVER (ORDER BY 1) FROM t1');
  const original = resolved.windows[0]?.orderBy[0];
  const copied = vdbe.sqlite3WindowRewrite(resolved).layers[0]?.producerOrderBy[0];

  assert.ok(original && copied);
  assert.equal(original.tokens.map((token) => token.text).join(''), '1');
  assert.notEqual(copied.expression, original, 'exprListAppendList must own a copied expression');
  assert.equal(copied.expression.tokens.map((token) => token.text).join('').toUpperCase(), 'NULL');
  assert.equal(copied.copiedIntegerToNull, true);
});

test('rewrite lifts an unqualified outer column but not a scalar subquery local column', () => {
  const resolved = resolve(
    'SELECT row_number() OVER (), (SELECT a), ' +
    '(SELECT local.a FROM t1 AS local) FROM t1 AS outer_t',
  );
  const lifted = vdbe.sqlite3WindowRewrite(resolved).layers[0]?.lifted ?? [];

  assert.deepEqual(
    lifted.map((entry) => ({
      sql: entry.expression.tokens.map((token) => token.text).join(''),
      depth: entry.selectDepth,
      correlated: entry.correlatedFromScalarSubquery,
    })),
    [{sql: 'a', depth: 1, correlated: true}],
    'window.c filters nested TK_COLUMN nodes by resolved outer cursor identity, not by whether the SQL spelling has a qualifier',
  );
});


test('rewrite repairs only aggregate depth that crosses the inserted producer layer', () => {
  const correlated = vdbe.sqlite3WindowRewrite(resolve(
    'SELECT row_number() OVER (), (SELECT sum(a)) FROM t1',
  )).layers[0]?.aggregateDepthRepairs ?? [];
  assert.deepEqual(correlated.map((repair) => ({
    sql: repair.expression.tokens.map((token) => token.text).join(''),
    selectDepth: repair.selectDepth,
    before: repair.aggregateDepthBefore,
    after: repair.aggregateDepthAfter,
  })), [{sql: 'sum(a)', selectDepth: 1, before: 1, after: 2}]);

  const local = vdbe.sqlite3WindowRewrite(resolve(
    'SELECT row_number() OVER (), (SELECT sum(local.a) FROM t1 AS local) FROM t1',
  )).layers[0]?.aggregateDepthRepairs ?? [];
  assert.deepEqual(local, [], 'a nested aggregate over a local cursor must not cross the generated layer');
});


test('public prepare applies the window compiler gate to scalar SELECTs', async () => {
  const backend = await startFixtureServer(fixtures);
  let db;
  try {
    db = await openFixture(new Request(
      `http://127.0.0.1:${backend.port}/fixture/${backend.token}/empty`,
    ));
    assert.throws(
      () => db.prepare('SELECT row_number() OVER ()'),
      (error) => error?.kind === 'unsupported' &&
        error?.message === 'window functions are not implemented',
      'the no-FROM compiler route must not bypass the post-rewrite atomic publication gate',
    );
  } finally {
    try { db?.closeDeferred(); } catch {}
    await new Promise((resolve, reject) => backend.server.close((error) => error ? reject(error) : resolve()));
  }
});


test('public table prepare preserves window rewrite ORDER BY aggregate misuse timing', async () => {
  const backend = await startFixtureServer(fixtures);
  let db;
  try {
    db = await openFixture(new Request(
      `http://127.0.0.1:${backend.port}/fixture/${backend.token}/expr-relational`,
    ));
    assert.throws(
      () => db.prepare('SELECT row_number() OVER () FROM t1 ORDER BY sum(x)'),
      (error) => error?.kind === 'sqlite' &&
        error?.code === 1 &&
        error?.message === 'misuse of aggregate: sum()',
      'window.c must run disallowAggregatesInOrderByCb before rewrite mutation and the temporary frame-execution gate',
    );
  } finally {
    try { db?.closeDeferred(); } catch {}
    await new Promise((resolve, reject) => backend.server.close((error) => error ? reject(error) : resolve()));
  }
});

test('compiler emits window init cursors, result registers, and select-loop handoff', () => {
  assert.equal(
    typeof vdbe.compileWindowSelectSetup,
    'function',
    'the window rewrite still has metadata-only cursor/register/handoff records',
  );
  const resolved = resolve(
    'SELECT sum(a) OVER w, avg(a) OVER w, row_number() OVER (ORDER BY a) ' +
    'FROM t1 WINDOW w AS (PARTITION BY b ORDER BY a)',
  );
  const compilation = vdbe.compileWindowSelectSetup(resolved, 'utf-8');
  assert.equal(compilation.rewrite.layers.length, 2);
  const ops = compilation.program.ops;
  assert.equal(ops.filter((op) => op.code === 'OpenEphemeral').length, 2);
  assert.equal(ops.filter((op) => op.code === 'OpenDup').length, 6);
  assert.equal(ops.filter((op) => op.code === 'Gosub').length, 2);
  assert.equal(ops.filter((op) => op.code === 'Return').length, 2);
  assert.equal(ops.filter((op) => op.code === 'Halt').length, 1);
  const allocatedRegisters = new Set();
  for (const [index, layer] of compilation.rewrite.layers.entries()) {
    const setup = compilation.setup[index];
    assert.equal(setup.compatibleGroup, layer.compatibleGroup);
    const open = ops.find((op) => op.code === 'OpenEphemeral' && op.p1 === layer.iEphCsr);
    assert.ok(open, 'each nested layer must open its own ephemeral cursor');
    assert.equal(open.keyInfo.totalFieldCount, layer.bufferExpressions.length);
    assert.equal(open.keyInfo.keyFieldCount, 0);
    assert.deepEqual(
      ops.filter((op) => op.code === 'OpenDup' && op.p2 === layer.iEphCsr).map((op) => op.p1),
      layer.duplicateCursors,
    );
    const partitionCount = layer.producerOrderBy.filter((term) => term.source === 'partition').length;
    assert.equal(setup.partitionRegisters.length, partitionCount);
    assert.equal(setup.regPart, setup.partitionRegisters[0] ?? null);
    for (const register of setup.partitionRegisters) {
      assert.ok(ops.some((op) => op.code === 'Null' && op.p2 === register));
      assert.equal(allocatedRegisters.has(register), false);
      allocatedRegisters.add(register);
    }
    assert.ok(ops.some((op) => op.code === 'Integer' && op.p1 === 1n && op.p2 === setup.regOne));
    assert.equal(allocatedRegisters.has(setup.regOne), false);
    allocatedRegisters.add(setup.regOne);
    for (const win of layer.windows) {
      assert.ok(ops.some((op) => op.code === 'Null' && op.p2 === win.regAccum));
      assert.equal(allocatedRegisters.has(win.regAccum), false);
      assert.equal(allocatedRegisters.has(win.regResult), false);
      allocatedRegisters.add(win.regAccum);
      allocatedRegisters.add(win.regResult);
    }
    assert.equal(allocatedRegisters.has(layer.regGosub), false);
    allocatedRegisters.add(layer.regGosub);
    const gosub = ops.find((op) => op.code === 'Gosub' && op.p1 === layer.regGosub);
    assert.ok(gosub, 'the producer select-loop must enter the window subroutine');
    assert.equal(ops[gosub.p2]?.code, 'Return');
    assert.equal(ops[gosub.p2]?.p1, layer.regGosub);
  }
  assert.ok([...allocatedRegisters].every((register) => register <= compilation.program.registers));
  assert.equal(compilation.rewrite.layers[0].windows.length, 2);
  assert.notEqual(compilation.rewrite.layers[0].iEphCsr, compilation.rewrite.layers[1].iEphCsr);
});
