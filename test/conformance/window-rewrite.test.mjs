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
  const compilation = vdbe.compileWindowSelectLowering(resolved, 'utf-8');
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


test('compiler evaluates and checks ROWS and RANGE offsets before producer loops', () => {
  const rows = vdbe.compileWindowSelectLowering(
    resolve('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN 2 PRECEDING AND 1 FOLLOWING) FROM t1'), 'utf-8');
  const range = vdbe.compileWindowSelectLowering(
    resolve('SELECT sum(a) OVER (ORDER BY a RANGE 1.5 PRECEDING) FROM t1'), 'utf-8');
  const checks = (program) => program.ops
    .map((op, index) => ({op, index}))
    .filter(({op}) => op.code === 'WindowCheck');
  assert.deepEqual(checks(rows.program).map(({op}) => [op.boundary, op.numeric]),
    [['starting', false], ['ending', false]]);
  assert.deepEqual(checks(range.program).map(({op}) => [op.boundary, op.numeric]),
    [['starting', true]]);
  assert.ok(checks(rows.program).every(({index}) => index < rows.loopBindings[0].loopBody));
  assert.ok(checks(range.program).every(({index}) => index < range.loopBindings[0].loopBody));
});


test('window offset checks preserve SQLite numeric-affinity acceptance', async () => {
  for (const sql of [
    "SELECT sum(a) OVER (ORDER BY a ROWS '2' PRECEDING) FROM t1",
    'SELECT sum(a) OVER (ORDER BY a ROWS 2.0 PRECEDING) FROM t1',
    "SELECT sum(a) OVER (ORDER BY a RANGE '1.5' PRECEDING) FROM t1",
  ]) {
    const compiled = vdbe.compileWindowSelectLowering(resolve(sql), 'utf-8').program;
    const check = compiled.ops.findIndex((op) => op.code === 'WindowCheck');
    assert.notEqual(check, -1);
    const program = {...compiled, ops: Object.freeze([
      ...compiled.ops.slice(0, check + 1), {code: 'Halt'},
    ])};
    const statement = new vdbe.VdbeStatement(program, () => {}, () => () => {}, () => {});
    assert.equal(await statement.step(), 'done');
    statement.finalize();
  }
});


test('parameterized window offsets re-evaluate after reset and rebind', async () => {
  for (const [sql, valid, invalid, message] of [
    ['SELECT sum(a) OVER (ORDER BY a ROWS ?1 PRECEDING) FROM t1', 2n, -1n,
      'frame starting offset must be a non-negative integer'],
    ['SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN CURRENT ROW AND ?1 FOLLOWING) FROM t1', '1.5', 'x',
      'frame ending offset must be a non-negative number'],
  ]) {
    const compiled = vdbe.compileWindowSelectLowering(resolve(sql), 'utf-8').program;
    const check = compiled.ops.findIndex((op) => op.code === 'WindowCheck');
    assert.notEqual(check, -1);
    const program = {...compiled, ops: Object.freeze([
      ...compiled.ops.slice(0, check + 1), {code: 'Halt'},
    ])};
    const statement = new vdbe.VdbeStatement(program, () => {}, () => () => {}, () => {});
    assert.equal(statement.parameterCount, 1);
    statement.bind(1, valid);
    assert.equal(await statement.step(), 'done');
    statement.reset();
    statement.bind(1, invalid);
    let firstError;
    try { await statement.step(); } catch (error) { firstError = error; }
    assert.equal(firstError?.kind, 'sqlite');
    assert.equal(firstError?.message, message);
    assert.throws(() => statement.reset(), (error) => error === firstError,
      'reset reports the first execution error while returning the statement to prepared state');
    statement.bind(1, valid);
    assert.equal(await statement.step(), 'done');
    statement.finalize();
  }
});


test('window offset diagnostics use SQLite boundary-specific messages', async () => {
  for (const [sql, message] of [
    ['SELECT sum(a) OVER (ORDER BY a ROWS -1 PRECEDING) FROM t1',
      'frame starting offset must be a non-negative integer'],
    ["SELECT sum(a) OVER (ORDER BY a RANGE 'x' PRECEDING) FROM t1",
      'frame starting offset must be a non-negative number'],
  ]) {
    const program = vdbe.compileWindowSelectLowering(resolve(sql), 'utf-8').program;
    const statement = new vdbe.VdbeStatement(program, () => {}, () => () => {}, () => {});
    let caught;
    try {
      await statement.step();
    } catch (error) {
      caught = error;
    }
    assert.equal(caught?.kind, 'sqlite');
    assert.equal(caught?.message, message);
    assert.throws(() => statement.finalize(), (error) => error === caught);
  }
});


test('window producer materializes direct partition and order keys before sorter insert', () => {
  const compilation = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) OVER (PARTITION BY b ORDER BY a) FROM t1'), 'utf-8');
  const insertAt = compilation.program.ops.findIndex(op => op.code === 'SorterInsert');
  const insert = compilation.program.ops[insertAt];
  const keyOps = compilation.program.ops.slice(0, insertAt).filter(op =>
    (op.code === 'Column' || op.code === 'Rowid' || op.code === 'Null') && op.p2 >= insert.keyStart && op.p2 < insert.keyStart + insert.keyCount);
  assert.deepEqual(keyOps.map(op => op.code), ['Column', 'Column']);
  assert.deepEqual(keyOps.map(op => op.p1), [1, 0],
    'PARTITION b and ORDER a use their resolved source column indexes');
  assert.deepEqual(keyOps.map(op => op.p3), [0, 0]);
  assert.equal(keyOps.some(op => op.code === 'Null'), false,
    'represented direct keys must not collapse every row into one peer group');
  assert.equal(insert.payloadCount, compilation.rewrite.layers[0].bufferExpressions.length);
  const payloadOps = compilation.program.ops.slice(0, insertAt).filter(op =>
    (op.code === 'Column' || op.code === 'Rowid' || op.code === 'Null') && op.p2 >= insert.payload && op.p2 < insert.payload + insert.payloadCount);
  assert.deepEqual(payloadOps.map(op => op.code), ['Column', 'Column', 'Column'],
    'rewritten buffer expressions are materialized as the sorter payload');
  const data = compilation.program.ops.find(op => op.code === 'SorterData');
  assert.equal(data.p2, insert.payload);
  assert.equal(data.count, insert.payloadCount, 'producer handoff restores the complete rewritten row');
  const binding = compilation.loopBindings[0];
  const setup = compilation.setup[0];
  const applicationStart = compilation.program.ops[binding.gosub].p2;
  const application = compilation.program.ops.slice(applicationStart, binding.returnAddress + 1);
  assert.deepEqual(application.slice(-4).map(op => op.code), ['MakeRecord', 'NewRowid', 'Insert', 'Return']);
  assert.equal(application[0].code, 'Copy');
  assert.equal(application.filter(op => op.code === 'Copy').length, setup.inputRegisters.length);
  assert.deepEqual(application.at(-4), {code: 'MakeRecord', p1: setup.regNew,
    p2: setup.inputRegisters.length, p3: setup.regRecord});
  assert.deepEqual(application.at(-3), {code: 'NewRowid', p1: compilation.rewrite.layers[0].iEphCsr,
    p2: setup.regRowid});
  assert.deepEqual(application.at(-2), {code: 'Insert', p1: compilation.rewrite.layers[0].iEphCsr,
    p2: setup.regRecord, p3: setup.regRowid});
});


test('AggInverse schedules the registered sliding callback without destroying context', async () => {
  const program = {ops: [
    {code: 'Integer', p1: 4n, p2: 1},
    {code: 'AggStep', name: 'sum', args: [1], p2: 2, collation: 'binary'},
    {code: 'Integer', p1: 9n, p2: 1},
    {code: 'AggStep', name: 'sum', args: [1], p2: 2, collation: 'binary'},
    {code: 'Integer', p1: 4n, p2: 1},
    {code: 'AggInverse', name: 'sum', args: [1], p2: 2, collation: 'binary'},
    {code: 'AggValue', name: 'sum', p1: 2, p2: 3},
    {code: 'ResultRow', p1: 3, p2: 1}, {code: 'Halt'},
  ], registers: 3, encoding: 'utf-8', columns: [{name: 'sum', declaredType: null, database: null, table: null, origin: null}], parameters: [], maxRows: 1, maxWorkUnits: 100, maxResultBytes: 1000, privateStateLimits: vdbe.DEFAULT_PRIVATE_STATE_LIMITS};
  const statement = new vdbe.VdbeStatement(program, () => {}, () => () => {}, () => {});
  try {
    assert.equal(await statement.step(), 'row');
    assert.equal(statement.column(0), 9n);
    assert.equal(await statement.step(), 'done');
  } finally { statement.finalize(); }
});


test('window cache MakeRecord/NewRowid/Insert execute through budgeted ephemeral ownership', async () => {
  const limits = {...vdbe.DEFAULT_PRIVATE_STATE_LIMITS, maxEntries: 1, maxKeyBytes: 32, maxBytes: 32};
  const program = {ops: [
    {code: 'OpenEphemeral', p1: 1, keyInfo: new (await import('../../src/internal/comparison.ts')).KeyInfo({encoding: 'utf-8', totalFieldCount: 2, keyFieldCount: 0, terms: []})},
    {code: 'Integer', p1: 7n, p2: 1}, {code: 'String', p1: 'abc', p2: 2},
    {code: 'MakeRecord', p1: 1, p2: 2, p3: 3}, {code: 'NewRowid', p1: 1, p2: 4},
    {code: 'Insert', p1: 1, p2: 3, p3: 4},
    {code: 'EphemeralRewind', p1: 1, p2: 10}, {code: 'EphemeralData', p1: 1, p2: 5, count: 2},
    {code: 'ResultRow', p1: 4, p2: 3}, {code: 'Halt'},
  ], registers: 7, encoding: 'utf-8', columns: ['rowid', 'a', 'b'].map(name => ({name, declaredType: null, database: null, table: null, origin: null})), parameters: [], maxRows: 1, maxWorkUnits: 100, maxResultBytes: 1000, privateStateLimits: limits};
  const statement = new vdbe.VdbeStatement(program, () => {}, () => () => {}, () => {});
  try {
    assert.equal(await statement.step(), 'row');
    assert.deepEqual([statement.column(0), statement.column(1), statement.column(2)], [1n, 7n, 'abc']);
    assert.equal(await statement.step(), 'done');
  } finally { statement.finalize(); }
});


test('bounded streaming ROWS unbounded-current schedules compatible aggregates after cache insertion', () => {
  const compilation = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) FILTER (WHERE b) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), ' +
    'count(a) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t1',
  ), 'utf-8');
  const layer = compilation.rewrite.layers[0];
  const binding = compilation.loopBindings[0];
  const ops = compilation.program.ops.slice(binding.gosub === undefined ? 0 : compilation.program.ops[binding.gosub].p2, binding.returnAddress + 1);
  const insert = ops.findIndex(op => op.code === 'Insert');
  const steps = ops.map((op, index) => op.code === 'AggStep' ? {op, index} : null).filter(Boolean);
  assert.equal(steps.length, 2);
  assert.ok(steps.every(item => item.index > insert));
  assert.deepEqual(steps.map(item => item.op.p2), layer.windows.map(win => win.regAccum));
  assert.deepEqual(ops.filter(op => op.code === 'AggValue').map(op => op.p2), layer.windows.map(win => win.regResult));
  const filter = ops.find(op => op.code === 'IfNot');
  assert.equal(filter.p1, compilation.setup[0].regNew + layer.windows[0].filterColumn);
  assert.equal(compilation.program.ops[filter.p2]?.code, 'AggValue', 'filter skips the step but still snapshots current state');
});


test('window producer opens its sorter once before the child coroutine loop', () => {
  const compilation = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) OVER (ROWS UNBOUNDED PRECEDING) FROM t1'), 'utf-8');
  const binding = compilation.loopBindings[0], ops = compilation.program.ops;
  const open = ops.findIndex(op => op.code === 'SorterOpen' && op.p1 === binding.sorterCursor);
  assert.ok(open < binding.loopBody);
  const insert = ops.findIndex(op => op.code === 'SorterInsert' && op.p1 === binding.sorterCursor);
  const producerYield = ops.findIndex((op, index) => index > open && index < insert && op.code === 'Yield');
  assert.ok(producerYield > open);
  assert.equal(ops.findIndex((op, index) => index > producerYield && index < binding.gosub && op.code === 'SorterOpen' && op.p1 === binding.sorterCursor), -1);
  const backedge = ops.find(op => op.code === 'Goto' && op.p2 === producerYield);
  assert.ok(insert > producerYield && backedge, 'all producer rows accumulate before SorterSort');
});


test('internal streaming lowering executes aggregate result rows without replay', async () => {
  const compilation = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t1',
  ), 'utf-8');
  const program = compilation.program;
  assert.equal(program.columns.length, 1);
  assert.equal(program.ops.filter(op => op.code === 'ResultRow').length, 1);
  assert.ok(program.ops.findIndex(op => op.code === 'ResultRow') < program.ops.findIndex(op => op.code === 'Halt'));
});


test('streaming branch detects partition changes and resets shared accumulators once', () => {
  const compilation = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) OVER (PARTITION BY b ROWS UNBOUNDED PRECEDING), ' +
    'count(a) OVER (PARTITION BY b ROWS UNBOUNDED PRECEDING) FROM t1',
  ), 'utf-8');
  const layer = compilation.rewrite.layers[0], setup = compilation.setup[0];
  const start = compilation.program.ops[compilation.loopBindings[0].gosub].p2;
  const ops = compilation.program.ops.slice(start, compilation.loopBindings[0].returnAddress + 1);
  const compare = ops.find(op => op.code === 'CompareGroup');
  assert.equal(compare.left, setup.regNew + layer.windows[0].argumentColumn - 1);
  assert.equal(compare.right, setup.regPart);
  assert.equal(compare.keyInfo, setup.partitionKeyInfo);
  const reset = ops.find(op => op.code === 'AggReset');
  assert.deepEqual(reset.registers, layer.windows.map(win => win.regAccum));
  assert.ok(ops.some(op => op.code === 'Copy' && op.p1 === compare.left && op.p2 === setup.regPart));
  assert.ok(ops.some(op => op.code === 'IfNot' && op.p1 === setup.regPartInitialized));
});


test('window setup allocates source-shaped input/record/rowid and peer register topology', () => {
  const range = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) OVER (PARTITION BY b ORDER BY a, b RANGE CURRENT ROW) FROM t1'), 'utf-8').setup[0];
  assert.equal(range.inputRegisters[0], range.regNew);
  assert.ok(range.inputRegisters.length > 0);
  assert.equal(range.regRecord, range.inputRegisters.at(-1) + 1);
  assert.equal(range.regRowid, range.regRecord + 1);
  assert.equal(range.regPeer, range.regRowid + 1);
  assert.deepEqual(range.startPeerRegisters, [range.regPeer + 2, range.regPeer + 3]);
  assert.deepEqual(range.currentPeerRegisters, [range.regPeer + 4, range.regPeer + 5]);
  assert.deepEqual(range.endPeerRegisters, [range.regPeer + 6, range.regPeer + 7]);
  const all = [...range.inputRegisters, range.regRecord, range.regRowid, range.regPeer,
    ...range.startPeerRegisters, ...range.currentPeerRegisters, ...range.endPeerRegisters];
  assert.equal(new Set(all).size, all.length, 'window register owners must not alias');

  const rows = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) OVER (ORDER BY a ROWS CURRENT ROW) FROM t1'), 'utf-8').setup[0];
  assert.equal(rows.regPeer, null);
  assert.deepEqual(rows.startPeerRegisters, []);
  assert.deepEqual(rows.currentPeerRegisters, []);
  assert.deepEqual(rows.endPeerRegisters, []);
});


test('window setup builds SQLite KeyInfo for partition and peer comparisons', () => {
  const compilation = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) OVER (PARTITION BY b COLLATE nocase ORDER BY a COLLATE rtrim DESC NULLS FIRST RANGE CURRENT ROW) FROM t1'), 'utf-16be');
  const range = compilation.setup[0];
  assert.deepEqual(range.partitionKeyInfo.terms, [{collation: 'nocase'}],
    'partition OP_Compare KeyInfo does not inherit ORDER direction/null flags');
  assert.equal(range.partitionKeyInfo.encoding, 'utf-16be');
  assert.deepEqual(range.peerKeyInfo.terms, [{collation: 'rtrim', desc: true, nullsLarge: true}],
    'peer KeyInfo retains ORDER collation, DESC, and KEYINFO_ORDER_BIGNULL');
  const sorterOpen = compilation.program.ops.find(op => op.code === 'SorterOpen');
  assert.deepEqual(sorterOpen.keyInfo.terms, [
    {collation: 'nocase', desc: false, nullsLarge: false},
    {collation: 'rtrim', desc: true, nullsLarge: true},
  ], 'window producer sorter must preserve partition/order collations and ORDER flags');
  const rows = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) OVER (PARTITION BY b ORDER BY a ROWS CURRENT ROW) FROM t1'), 'utf-8').setup[0];
  assert.ok(rows.partitionKeyInfo);
  assert.equal(rows.peerKeyInfo, null, 'ROWS does not allocate peer comparison registers/KeyInfo');
  const noKeys = vdbe.compileWindowSelectLowering(resolve(
    'SELECT sum(a) OVER (ROWS CURRENT ROW) FROM t1'), 'utf-8').setup[0];
  assert.equal(noKeys.partitionKeyInfo, null);
  assert.equal(noKeys.peerKeyInfo, null);
});


test('window step selects SQLite source deletion modes conservatively', () => {
  const mode = (frame) => vdbe.compileWindowSelectLowering(
    resolve(`SELECT sum(a) OVER (ORDER BY a ${frame}) FROM t1`), 'utf-8').setup[0].deleteMode;
  assert.equal(mode('ROWS 2 FOLLOWING'), 'return-row');
  assert.equal(mode('ROWS ?1 FOLLOWING'), 'retain', 'unknown offsets cannot take windowExprGtZero early deletion');
  assert.equal(mode('RANGE 2 FOLLOWING'), 'retain');
  assert.equal(mode('ROWS BETWEEN UNBOUNDED PRECEDING AND 2 PRECEDING'), 'agg-step');
  assert.equal(mode('ROWS BETWEEN UNBOUNDED PRECEDING AND ?1 PRECEDING'), 'retain');
  assert.equal(mode('ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW'), 'return-row');
  assert.equal(mode('ROWS BETWEEN 2 PRECEDING AND CURRENT ROW'), 'agg-inverse');
  assert.equal(mode('ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE TIES'), 'retain',
    'EXCLUDE application state forces windowCacheFrame');
});


test('compiler emits EXCLUDE full-scan application state without cursor aliasing', () => {
  const resolved = resolve(
    'SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING EXCLUDE NO OTHERS) FROM t1',
  );
  const compilation = vdbe.compileWindowSelectLowering(resolved, 'utf-8');
  const layer = compilation.rewrite.layers[0];
  const setup = compilation.setup[0];
  const binding = compilation.loopBindings[0];
  assert.ok(layer && setup && binding);
  assert.notEqual(setup.regStartRowid, null);
  assert.notEqual(setup.regEndRowid, null);
  assert.notEqual(setup.applicationCursor, null);
  assert.ok(compilation.program.ops.some((op) =>
    op.code === 'OpenDup' && op.p1 === setup.applicationCursor && op.p2 === layer.iEphCsr));
  assert.notEqual(binding.sorterCursor, setup.applicationCursor,
    'the select-loop sorter must not alias sqlite3WindowCodeInit application state');
});

test('implicit/no-EXCLUDE windows do not allocate full-scan application state', () => {
  const compilation = vdbe.compileWindowSelectLowering(resolve('SELECT sum(a) OVER () FROM t1'), 'utf-8');
  assert.deepEqual(
    compilation.setup.map(({regStartRowid, regEndRowid, applicationCursor}) =>
      ({regStartRowid, regEndRowid, applicationCursor})),
    [{regStartRowid: null, regEndRowid: null, applicationCursor: null}],
  );
});


test('public prepare applies the window compiler gate to scalar SELECTs', async () => {
  const backend = await startFixtureServer(fixtures);
  let db;
  try {
    db = await openFixture(new Request(
      `http://127.0.0.1:${backend.port}/fixture/${backend.token}/empty`,
    ));
    const statement = db.prepare('SELECT row_number() OVER ()').statement;
    assert.equal(await statement.step(), 'row');
    assert.equal(statement.columnType(0), 'integer');
    assert.equal(statement.column(0), 1n);
    assert.equal(await statement.step(), 'done');
    statement.finalize();

    const rank = db.prepare('SELECT rank() OVER ()').statement;
    assert.equal(await rank.step(), 'row');
    assert.equal(rank.columnType(0), 'integer');
    assert.equal(rank.column(0), 1n);
    assert.equal(await rank.step(), 'done');
    rank.finalize();

    const denseRank = db.prepare('SELECT dense_rank() OVER ()').statement;
    assert.equal(await denseRank.step(), 'row');
    assert.equal(denseRank.columnType(0), 'integer');
    assert.equal(denseRank.column(0), 1n);
    assert.equal(await denseRank.step(), 'done');
    denseRank.finalize();
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
    typeof vdbe.compileWindowSelectLowering,
    'function',
    'the window rewrite still has metadata-only cursor/register/handoff records',
  );
  const resolved = resolve(
    'SELECT sum(a) OVER w, avg(a) OVER w, row_number() OVER (ORDER BY a) ' +
    'FROM t1 WINDOW w AS (PARTITION BY b ORDER BY a)',
  );
  const compilation = vdbe.compileWindowSelectLowering(resolved, 'utf-8');
  assert.equal(compilation.rewrite.layers.length, 2);
  const ops = compilation.program.ops;
  assert.equal(ops.filter((op) => op.code === 'OpenEphemeral').length, 2);
  assert.equal(ops.filter((op) => op.code === 'OpenDup').length, 6);
  assert.equal(ops.filter((op) => op.code === 'Gosub').length, 2);
  assert.equal(ops.filter((op) => op.code === 'Return').length, 2);
  assert.equal(ops.filter((op) => op.code === 'Halt').length, 1);
  assert.equal(ops.filter((op) => op.code === 'OpenRead').length, 1, 'the innermost generated producer owns FROM once');
  assert.deepEqual(compilation.loopBindings.map((binding) => binding.producerKind), ['original', 'rewritten-select']);
  assert.deepEqual(compilation.loopBindings.map((binding) => binding.ownedClauses), [
    ['from', 'where', 'groupBy', 'having'], [],
  ]);
  assert.equal(new Set(compilation.loopBindings.map((binding) => binding.loopBody)).size, 2);
  assert.equal(new Set(compilation.loopBindings.map((binding) => binding.producerCoroutine)).size, 2);
  assert.equal(compilation.loopBindings[1].childCoroutine, compilation.loopBindings[0].producerCoroutine);
  for (const binding of compilation.loopBindings) {
    assert.equal(ops[binding.loopBody].code, 'SorterData');
    assert.equal(ops[binding.gosub].code, 'Gosub');
    assert.ok(binding.gosub >= binding.loopBody, 'handoff belongs to this generated producer loop');
    assert.equal(ops[binding.returnAddress].code, 'Return');
    assert.equal(ops[binding.returnAddress].p1, ops[binding.gosub].p1);
    assert.ok(ops.some((op) => op.code === 'SorterOpen' && op.p1 === binding.sorterCursor));
    assert.deepEqual(binding.producerOrderBy, compilation.rewrite.layers.find((layer) => layer.compatibleGroup === binding.compatibleGroup).producerOrderBy);
  }
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
    assert.equal(ops[gosub.p2]?.code, 'Copy');
    const returnOp = ops.find((op, index) => index >= gosub.p2 && op.code === 'Return' && op.p1 === layer.regGosub);
    assert.ok(returnOp, 'the row-cache subroutine must return through its owning register');
  }
  assert.ok([...allocatedRegisters].every((register) => register <= compilation.program.registers));
  assert.equal(compilation.rewrite.layers[0].windows.length, 2);
  assert.notEqual(compilation.rewrite.layers[0].iEphCsr, compilation.rewrite.layers[1].iEphCsr);
});



test('window lowering uses nested SELECT loops for multiple original sources', () => {
  const resolved = resolve(
    'SELECT sum(left_t.a) OVER (PARTITION BY left_t.b), ' +
    'row_number() OVER (ORDER BY right_t.a) FROM t1 AS left_t, t1 AS right_t',
  );
  const compilation = vdbe.compileWindowSelectLowering(resolved, 'utf-8');
  const ops = compilation.program.ops;
  assert.equal(ops.filter((op) => op.code === 'OpenRead').length, 2);
  const rewinds = ops.map((op, index) => op.code === 'Rewind' ? index : -1).filter((index) => index >= 0);
  assert.equal(rewinds.length, 2);
  const outerBody = rewinds[0] + 1;
  assert.equal(ops[outerBody].code, 'Rewind', 'inner source is rewound for every outer row');
  const sourceNext = ops.map((op, index) => op.code === 'Next' ? {op, index} : null).filter(Boolean);
  assert.equal(sourceNext.length, 2);
  assert.equal(sourceNext[0].op.p2, rewinds[1] + 1);
  assert.equal(sourceNext[1].op.p2, outerBody);
  assert.equal(compilation.loopBindings.length, 2);
  assert.equal(new Set(compilation.loopBindings.map((binding) => binding.producerCoroutine)).size, 2);
  assert.equal(compilation.loopBindings[1].childCoroutine, compilation.loopBindings[0].producerCoroutine);
});

test('public streaming window preserves resolved binding through wrapped qualified arguments', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const prepared = db.prepare('SELECT sum((t1.a) COLLATE nocase) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t1');
      const values = [];
      while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
      assert.deepEqual(values, [1n, 4n, 9n, 16n]);
      prepared.statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});


test('public streaming ROWS aggregate publishes in all three database encodings', async () => {
  const names = ['subquery-utf8', 'subquery-utf16le', 'subquery-utf16be'];
  const backend = await startFixtureServer(fixtures);
  try {
    for (const name of names) {
      const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/${name}`));
      try {
        const prepared = db.prepare('SELECT sum(a) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t1');
        const values = [];
        while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
        assert.deepEqual(values, [1n, 4n, 9n, 16n], name);
        prepared.statement.finalize();
      } finally { try { db.closeDeferred(); } catch {} }
    }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});


test('public window lowering preserves pre-rewrite diagnostics and publishes completed shapes in all three database encodings', async () => {
  const names = ['encoding-utf8', 'encoding-utf16le', 'encoding-utf16be'];
  const backend = await startFixtureServer(fixtures);
  try {
    for (const name of names) {
      const db = await openFixture(new Request(
        `http://127.0.0.1:${backend.port}/fixture/${backend.token}/${name}`,
      ));
      try {
        assert.throws(
          () => db.prepare('SELECT row_number() OVER () FROM t1 ORDER BY sum(a)'),
          (error) => error?.kind === 'sqlite' &&
            error?.code === 1 &&
            error?.message === 'misuse of aggregate: sum()',
          `${name} must preserve the pre-rewrite SQLite diagnostic`,
        );
        const windowPrepared = db.prepare('SELECT row_number() OVER (ORDER BY a) FROM t1');
        const windowRows = [];
        while (await windowPrepared.statement.step() === 'row') windowRows.push(windowPrepared.statement.column(0));
        assert.deepEqual(windowRows, [1n], `${name} publishes the now-complete built-in window shape`);
        windowPrepared.statement.finalize();
        const prepared = db.prepare('SELECT 1');
        assert.ok(prepared.statement, `${name} connection remains reusable after atomic rejection`);
        prepared.statement.finalize();
      } finally { try { db.closeDeferred(); } catch {} }
    }
  } finally {
    await new Promise((resolve, reject) => backend.server.close((error) => error ? reject(error) : resolve()));
  }
});

test('ORDER-prefix elision uses structural expression and sort identity', () => {
  const wrapped = vdbe.sqlite3WindowRewrite(resolve(
    'SELECT sum(a) OVER (ORDER BY a COLLATE NoCase) FROM t1 ' +
    'ORDER BY a COLLATE nocase',
  ));
  assert.equal(wrapped.outer.orderPrefixElided, true,
    'copied wrapper trees and case-insensitive collation names are structurally identical');
  assert.deepEqual(wrapped.outer.orderBy, []);

  const direction = vdbe.sqlite3WindowRewrite(resolve(
    'SELECT sum(a) OVER (ORDER BY a DESC) FROM t1 ORDER BY a ASC',
  ));
  assert.equal(direction.outer.orderPrefixElided, false,
    'sqlite3ExprListCompare includes ExprList sort flags');
  assert.equal(direction.outer.orderBy.length, 1);

  const collation = vdbe.sqlite3WindowRewrite(resolve(
    'SELECT sum(a) OVER (ORDER BY a COLLATE nocase) FROM t1 ORDER BY a COLLATE rtrim',
  ));
  assert.equal(collation.outer.orderPrefixElided, false,
    'similar terminal structure with different COLLATE nodes must not compare equal');

  const integerCopy = vdbe.sqlite3WindowRewrite(resolve(
    'SELECT sum(a) OVER (ORDER BY 1) FROM t1 ORDER BY 1',
  ));
  assert.equal(integerCopy.outer.orderPrefixElided, false,
    'bIntToNull changes the generated expression tree before the structural prefix comparison');

  const independentTerms = vdbe.sqlite3WindowRewrite(resolve(
    'SELECT sum(a) OVER (ORDER BY a DESC NULLS LAST, b ASC NULLS FIRST) ' +
    'FROM t1 ORDER BY (a) DESC NULLS LAST, b ASC NULLS FIRST',
  ));
  assert.equal(independentTerms.outer.orderPrefixElided, true,
    'grouping wrappers compare structurally and recursive sortlist items retain only their own flags');
  assert.deepEqual(
    independentTerms.layers[0].producerOrderBy.map((term) => [term.descending, term.nulls]),
    [[true, 'last'], [false, 'first']],
  );

  const secondTermMismatch = vdbe.sqlite3WindowRewrite(resolve(
    'SELECT sum(a) OVER (ORDER BY a DESC NULLS LAST, b ASC NULLS FIRST) ' +
    'FROM t1 ORDER BY a DESC NULLS LAST, b DESC NULLS FIRST',
  ));
  assert.equal(secondTermMismatch.outer.orderPrefixElided, false,
    'flags from the first recursive sortlist item must not bleed into a token-similar second item');
});

test('public aggregate window executes bounded ROWS frame without broad recomputation', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const prepared = db.prepare('SELECT sum(t1.a) OVER (ORDER BY t1.a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1');
      const values = [];
      while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
      assert.deepEqual(values, [1n, 4n, 8n, 12n]);
      prepared.statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('public bounded ROWS flushes sliding state and cursor ownership at partition changes', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const sql = 'SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1';
      const prepared = db.prepare(sql);
      const values = [];
      while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
      assert.deepEqual(values, [5n, 1n, 4n, 7n]);
      prepared.statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('public bounded ROWS evaluates parameter offset at runtime before publication', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const prepared = db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN ?1 PRECEDING AND CURRENT ROW) FROM t1');
      prepared.statement.bind(1, 1n);
      const values = [];
      while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
      assert.deepEqual(values, [1n, 4n, 8n, 12n]);
      prepared.statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('public ROWS CURRENT through FOLLOWING owns lookahead and trailing flush', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const prepared = db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING) FROM t1');
      const values = [];
      while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
      assert.deepEqual(values, [4n, 8n, 12n, 7n]);
      prepared.statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('public ROWS reversed FOLLOWING bounds return one empty aggregate frame per input row', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const prepared = db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN 2 FOLLOWING AND 1 FOLLOWING) FROM t1');
      const values = [];
      while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
      assert.deepEqual(values, [null, null, null, null]);
      prepared.statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('public ROWS runtime FOLLOWING end owns arbitrary lookahead and trailing flush', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const prepared = db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN CURRENT ROW AND ?1 FOLLOWING) FROM t1');
      prepared.statement.bind(1, 2n);
      const values = [];
      while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
      assert.deepEqual(values, [9n, 15n, 12n, 7n]);
      prepared.statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('public partitioned ROWS FOLLOWING flushes each partition before transition', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const prepared = db.prepare('SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a ROWS BETWEEN CURRENT ROW AND ?1 FOLLOWING) FROM t1');
      prepared.statement.bind(1, 2n);
      const values = [];
      while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
      assert.deepEqual(values, [5n, 4n, 3n, 7n]);
      prepared.statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('public ROWS runtime FOLLOWING through FOLLOWING owns independent positions', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      for (const { bounds, expected } of [
        { bounds: [1n, 2n], expected: [8n, 12n, 7n, null] },
        { bounds: [2n, 1n], expected: [null, null, null, null] },
        { bounds: [2n, 10n], expected: [12n, 7n, null, null] },
      ]) {
        const prepared = db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN ?1 FOLLOWING AND ?2 FOLLOWING) FROM t1');
        prepared.statement.bind(1, bounds[0]);
        prepared.statement.bind(2, bounds[1]);
        const values = [];
        while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
        assert.deepEqual(values, expected);
        prepared.statement.finalize();
      }
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('public partitioned ROWS runtime FOLLOWING through FOLLOWING drains and rebinds', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const prepared = db.prepare('SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a ROWS BETWEEN ?1 FOLLOWING AND ?2 FOLLOWING) FROM t1');
      prepared.statement.bind(1, 1n); prepared.statement.bind(2, 2n);
      assert.equal(await prepared.statement.step(), 'row');
      assert.equal(prepared.statement.column(0), null);
      prepared.statement.reset();
      prepared.statement.clearBindings();
      prepared.statement.bind(1, 2n); prepared.statement.bind(2, 1n);
      const values = []; while (await prepared.statement.step() === 'row') values.push(prepared.statement.column(0));
      assert.deepEqual(values, [null, null, null, null]);
      prepared.statement.reset();
      prepared.statement.clearBindings();
      prepared.statement.bind(1, 1n); prepared.statement.bind(2, 10n);
      const rebound = []; while (await prepared.statement.step() === 'row') rebound.push(prepared.statement.column(0));
      assert.deepEqual(rebound, [null, 3n, null, null]);
      prepared.statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('compatible aggregate windows advance shared CURRENT FOLLOWING cursor once per row', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      for (const { sql, expected } of [
        {
          sql: 'SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING), count(a) OVER (ORDER BY a ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING) FROM t1',
          expected: [[4n,2n],[8n,2n],[12n,2n],[7n,1n]],
        },
        {
          sql: 'SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING), count(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING) FROM t1',
          expected: [[5n,1n],[4n,2n],[3n,1n],[7n,1n]],
        },
      ]) {
        const statement = db.prepare(sql).statement;
        const rows = [];
        while (await statement.step() === 'row') rows.push([statement.column(0), statement.column(1)]);
        assert.deepEqual(rows, expected);
        statement.finalize();
      }
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('compatible aggregate windows share FOLLOWING FOLLOWING positions across partitions and rebind', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const statement = db.prepare('SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a ROWS BETWEEN ?1 FOLLOWING AND ?2 FOLLOWING), count(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a ROWS BETWEEN ?1 FOLLOWING AND ?2 FOLLOWING) FROM t1').statement;
      statement.bind(1, 1n); statement.bind(2, 2n);
      const first=[]; while(await statement.step()==='row') first.push([statement.column(0),statement.column(1)]);
      assert.deepEqual(first, [[null,0n],[3n,1n],[null,0n],[null,0n]]);
      statement.reset(); statement.clearBindings(); statement.bind(1,2n); statement.bind(2,1n);
      const empty=[]; while(await statement.step()==='row') empty.push([statement.column(0),statement.column(1)]);
      assert.deepEqual(empty, [[null,0n],[null,0n],[null,0n],[null,0n]]);
      statement.reset(); statement.clearBindings(); statement.bind(1,1n); statement.bind(2,10n);
      assert.equal(await statement.step(),'row'); assert.deepEqual([statement.column(0),statement.column(1)],[null,0n]);
      statement.reset(); statement.clearBindings(); statement.bind(1,1n); statement.bind(2,2n);
      const rebound=[]; while(await statement.step()==='row') rebound.push([statement.column(0),statement.column(1)]);
      assert.deepEqual(rebound, [[null,0n],[3n,1n],[null,0n],[null,0n]]);
      statement.finalize();
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('public remaining ROWS schedule matrix prepares and matches pinned rows', async () => {
  const backend = await startFixtureServer(fixtures);
  try {
    const db = await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));
    try {
      const cases = [
        ['ROWS BETWEEN CURRENT ROW AND CURRENT ROW', [1n,3n,5n,7n]],
        ['ROWS BETWEEN 2 PRECEDING AND 1 PRECEDING', [null,1n,4n,8n]],
        ['ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING', [4n,9n,15n,12n]],
        ['ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING', [15n,12n,7n,null]],
        ['ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING', [16n,16n,16n,16n]],
      ];
      for (const [frame, expected] of cases) {
        const prepared = db.prepare(`SELECT sum(a) OVER (ORDER BY a ${frame}) FROM t1`);
        const rows=[]; while(await prepared.statement.step()==='row') rows.push(prepared.statement.column(0));
        assert.deepEqual(rows, expected, frame); prepared.statement.finalize();
      }
    } finally { try { db.closeDeferred(); } catch {} }
  } finally { await new Promise((resolve, reject) => backend.server.close(error => error ? reject(error) : resolve())); }
});

test('compatible aggregates share CURRENT CURRENT row', async () => {
  const backend=await startFixtureServer(fixtures); try { const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`)); try {
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN CURRENT ROW AND CURRENT ROW), count(a) OVER (ORDER BY a ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM t1').statement, rows=[];
    while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]); assert.deepEqual(rows,[[1n,1n],[3n,1n],[5n,1n],[7n,1n]]);statement.finalize();
  } finally { try { db.closeDeferred(); } catch {} } } finally { await new Promise((resolve,reject)=>backend.server.close(e=>e?reject(e):resolve())); }
});

test('compatible aggregates share PRECEDING PRECEDING positions and runtime empty frames', async () => {
  const backend=await startFixtureServer(fixtures); try { const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`)); try {
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN ?1 PRECEDING AND ?2 PRECEDING), count(a) OVER (ORDER BY a ROWS BETWEEN ?1 PRECEDING AND ?2 PRECEDING) FROM t1').statement;
    statement.bind(1,2n);statement.bind(2,1n);const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);assert.deepEqual(rows,[[null,0n],[1n,1n],[4n,2n],[8n,2n]]);
    statement.reset();statement.clearBindings();statement.bind(1,1n);statement.bind(2,2n);const empty=[];while(await statement.step()==='row')empty.push([statement.column(0),statement.column(1)]);assert.deepEqual(empty,[[null,0n],[null,0n],[null,0n],[null,0n]]);statement.finalize();
  } finally { try { db.closeDeferred(); } catch {} } } finally { await new Promise((resolve,reject)=>backend.server.close(e=>e?reject(e):resolve())); }
});

test('compatible aggregates share PRECEDING FOLLOWING positions and rebind', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN ?1 PRECEDING AND ?2 FOLLOWING), count(a) OVER (ORDER BY a ROWS BETWEEN ?1 PRECEDING AND ?2 FOLLOWING) FROM t1').statement;statement.bind(1,1n);statement.bind(2,1n);const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);assert.deepEqual(rows,[[4n,2n],[9n,3n],[15n,3n],[12n,2n]]);statement.reset();statement.clearBindings();statement.bind(1,0n);statement.bind(2,0n);const current=[];while(await statement.step()==='row')current.push([statement.column(0),statement.column(1)]);assert.deepEqual(current,[[1n,1n],[3n,1n],[5n,1n],[7n,1n]]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(e=>e?reject(e):resolve()))}
});

test('compatible aggregates share FOLLOWING UNBOUNDED positions and rebind', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN ?1 FOLLOWING AND UNBOUNDED FOLLOWING), count(a) OVER (ORDER BY a ROWS BETWEEN ?1 FOLLOWING AND UNBOUNDED FOLLOWING) FROM t1').statement;statement.bind(1,1n);const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);assert.deepEqual(rows,[[15n,3n],[12n,2n],[7n,1n],[null,0n]]);statement.reset();statement.clearBindings();statement.bind(1,10n);const empty=[];while(await statement.step()==='row')empty.push([statement.column(0),statement.column(1)]);assert.deepEqual(empty,[[null,0n],[null,0n],[null,0n],[null,0n]]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(e=>e?reject(e):resolve()))}
});

test('GROUPS no ORDER treats the partition as one peer group and shares callbacks', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (GROUPS BETWEEN CURRENT ROW AND CURRENT ROW), count(a) OVER (GROUPS BETWEEN CURRENT ROW AND CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);
    assert.deepEqual(rows,[[16n,4n],[16n,4n],[16n,4n],[16n,4n]]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered GROUPS CURRENT peer loop shares compatible callbacks', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN CURRENT ROW AND CURRENT ROW), count(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN CURRENT ROW AND CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);
    assert.deepEqual(rows,[[5n,1n],[4n,2n],[4n,2n],[7n,1n]]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered GROUPS offset frame advances by peer groups', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[9n,16n,16n,11n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('partitioned ordered GROUPS offset frame flushes before partition transition', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a GROUPS BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,4n,4n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered GROUPS runtime offsets advance complete peer groups', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN ?1 PRECEDING AND ?2 FOLLOWING) FROM t1').statement;
    statement.bind(1,2n); statement.bind(2,0n);
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,9n,9n,16n]);
    statement.reset(); statement.clearBindings(); statement.bind(1,0n); statement.bind(2,2n);
    const rebound=[];while(await statement.step()==='row')rebound.push(statement.column(0));
    assert.deepEqual(rebound,[16n,11n,11n,7n]); statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered GROUPS unbounded preceding through current accumulates complete peer groups', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,9n,9n,16n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('partitioned ordered GROUPS cumulative frame drains before transition', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a GROUPS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,1n,4n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered GROUPS current through unbounded following retires complete peers', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[16n,11n,11n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('partitioned ordered GROUPS suffix frame drains before transition', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a GROUPS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,4n,3n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered GROUPS preceding through current advances complete peers', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,9n,9n,11n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered RANGE numeric preceding through current uses order-key distance', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN 2 PRECEDING AND CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[1n,4n,8n,12n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered RANGE DESC reverses numeric preceding distance', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a DESC RANGE BETWEEN 2 PRECEDING AND CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[7n,12n,8n,4n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('partitioned ordered RANGE numeric frame drains before transition', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a RANGE BETWEEN 2 PRECEDING AND CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,1n,4n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered RANGE bounded preceding and following uses key distances', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN 2 PRECEDING AND 2 FOLLOWING) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[4n,9n,15n,12n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered RANGE current through following uses key distances', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN CURRENT ROW AND 2 FOLLOWING) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[4n,8n,12n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered RANGE following through unbounded uses key distances', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN 2 FOLLOWING AND UNBOUNDED FOLLOWING) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[15n,12n,7n,null]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('ordered RANGE unbounded through current includes complete peers', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,9n,9n,16n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window EXCLUDE CURRENT ROW removes only current row', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[null,1n,4n,9n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window EXCLUDE GROUP removes current peers from ROWS frame', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE GROUP) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[null,5n,5n,9n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window EXCLUDE TIES retains current and removes other peers', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE TIES) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,6n,8n,16n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window bounded ROWS EXCLUDE CURRENT ROW scans ordinary frame', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[null,1n,3n,5n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window bounded ROWS EXCLUDE GROUP scans peers inside ordinary frame', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE GROUP) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[null,5n,null,3n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window bounded ROWS EXCLUDE TIES keeps current peer identity', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE TIES) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,6n,3n,10n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window bounded ROWS EXCLUDE NO OTHERS uses application scan', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,6n,4n,10n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window RANGE CURRENT ROW exclusion scans peer endpoints', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase RANGE BETWEEN CURRENT ROW AND CURRENT ROW EXCLUDE TIES) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,1n,3n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window GROUPS CURRENT ROW exclusion scans peer endpoints', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN CURRENT ROW AND CURRENT ROW EXCLUDE TIES) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,1n,3n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window RANGE offset exclusion scans bounded endpoints', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN 2 PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[null,1n,3n,5n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window GROUPS offset EXCLUDE GROUP scans group endpoints', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE GROUP) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[null,5n,5n,4n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window GROUPS runtime multi-group EXCLUDE GROUP retains boundary queue', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase GROUPS BETWEEN ?1 PRECEDING AND CURRENT ROW EXCLUDE GROUP) FROM t1').statement;
    statement.bind(1,2n);const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[null,5n,5n,9n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window RANGE offset EXCLUDE TIES keeps current among peers', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase RANGE BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE TIES) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,1n,3n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window RANGE offset EXCLUDE GROUP removes current peer group', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY c COLLATE nocase RANGE BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE GROUP) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[null,null,null,null]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window RANGE offset EXCLUDE NO OTHERS retains complete frame', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN 2 PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[1n,4n,8n,12n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window partitioned RANGE offset exclusion resets typed application scan', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a RANGE BETWEEN 2 PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[5n,1n,4n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window RANGE following endpoint exclusion uses typed bounds', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN 2 PRECEDING AND 2 FOLLOWING EXCLUDE CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[3n,6n,10n,5n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window RANGE CURRENT to FOLLOWING exclusion uses typed start', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN CURRENT ROW AND 2 FOLLOWING EXCLUDE NO OTHERS) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[4n,8n,12n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window RANGE FOLLOWING start and end exclusion uses typed bounds', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN 2 FOLLOWING AND 4 FOLLOWING EXCLUDE NO OTHERS) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[8n,12n,7n,null]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window RANGE unbounded endpoints exclusion scans whole partition', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING EXCLUDE CURRENT ROW) FROM t1').statement;
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,[15n,13n,11n,9n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window cache enforces private entries and preserves first error through finalize', async () => {
  const backend=await startFixtureServer(fixtures);let db,statement;try{
    db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`),{limits:{maxRows:100,maxResultBytes:10000,maxPrivateEntries:0}});
    statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) FROM t1').statement;
    let first;try{await statement.step();}catch(error){first=error;}
    assert.equal(first?.kind,'limit');assert.match(first.message,/entry limit/);
    assert.throws(()=>statement.finalize(),error=>error===first);statement=undefined;
    const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');assert.equal(admitted.column(0),1n);admitted.finalize();
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window cache enforces private key and total byte limits and releases admission', async () => {
  const backend=await startFixtureServer(fixtures);try{
    for(const [limits,message] of [[{maxPrivateKeyBytes:0},/key exceeds byte limit/],[{maxPrivateBytes:0},/total byte limit/]]){
      let db,statement;try{
        db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`),{limits:{maxRows:100,maxResultBytes:10000,...limits}});
        statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) FROM t1').statement;
        let first;try{await statement.step();}catch(error){first=error;}
        assert.equal(first?.kind,'limit');assert.match(first.message,message);
        assert.throws(()=>statement.reset(),error=>error===first);
        const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();
        statement.finalize();statement=undefined;
      }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}}
    }
  }finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window whole-partition execution enforces row and work ceilings with first error', async () => {
  const backend=await startFixtureServer(fixtures);try{
    for(const [limits,options,match] of [[{maxRows:0},{},/maxRows/],[{maxRows:100},{maxWorkUnits:0},/maxWorkUnits/]]){
      let db,statement;try{db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`),{limits:{maxResultBytes:10000,...limits}});statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) FROM t1').statement;let first;try{await statement.step(options)}catch(error){first=error}assert.equal(first?.kind,'limit');assert.match(first.message,match);assert.throws(()=>statement.finalize(),error=>error===first);statement=undefined}finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}}
    }
  }finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate RANGE cache reset and rebind rebuilds partition state without replay', async () => {
  const backend=await startFixtureServer(fixtures);try{const db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));try{
    const statement=db.prepare('SELECT sum(a) OVER (PARTITION BY c COLLATE nocase ORDER BY a RANGE BETWEEN ?1 PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS) FROM t1').statement;
    statement.bind(1,2n);const first=[];while(await statement.step()==='row')first.push(statement.column(0));assert.deepEqual(first,[5n,1n,4n,7n]);
    statement.reset();statement.clearBindings();statement.bind(1,0n);const second=[];while(await statement.step()==='row')second.push(statement.column(0));assert.deepEqual(second,[5n,1n,3n,7n]);
    statement.reset();statement.clearBindings();statement.bind(1,2n);assert.equal(await statement.step(),'row');assert.equal(statement.column(0),5n);statement.reset();
    const replay=[];while(await statement.step()==='row')replay.push(statement.column(0));assert.deepEqual(replay,[5n,1n,4n,7n]);statement.finalize();
  }finally{try{db.closeDeferred()}catch{}}}finally{await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window cache suspension cancellation preserves PC and closes exactly once', async () => {
  const {EphemeralIndexCursor}=await import('../../src/internal/private-state.ts');const insert=EphemeralIndexCursor.prototype.insert,close=EphemeralIndexCursor.prototype.close,timer=globalThis.setTimeout;let release,reached,closes=0,inject=true;const suspended=new Promise(resolve=>reached=resolve);
  EphemeralIndexCursor.prototype.insert=async function(...args){if(inject)for(let i=0;i<300;i++)await args.at(-1).checkpoint(1);return insert.apply(this,args)};EphemeralIndexCursor.prototype.close=function(){closes++;return close.call(this)};globalThis.setTimeout=(callback,ms,...args)=>{if(ms===0&&!release){release=()=>timer(callback,0,...args);reached();return 0}return timer(callback,ms,...args)};
  const backend=await startFixtureServer(fixtures);let db,statement;try{db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) FROM t1').statement;const controller=new AbortController(),pending=statement.step({signal:controller.signal});await suspended;controller.abort('window-stop');release();let first;try{await pending}catch(error){first=error}assert.equal(first?.kind,'cancelled');assert.equal(first?.cause,'window-stop');assert.throws(()=>statement.reset(),error=>error===first);assert.equal(closes,4);inject=false;const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));assert.deepEqual(rows,[16n,16n,16n,16n]);statement.finalize();statement=undefined;assert.equal(closes,8);
  }finally{globalThis.setTimeout=timer;EphemeralIndexCursor.prototype.insert=insert;EphemeralIndexCursor.prototype.close=close;try{release?.()}catch{}try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('aggregate window suspended cache deadline preserves first error and restarts without replay', async () => {
  const {EphemeralIndexCursor}=await import('../../src/internal/private-state.ts');const insert=EphemeralIndexCursor.prototype.insert,now=Date.now;let active=false;
  EphemeralIndexCursor.prototype.insert=async function(...args){active=true;for(let i=0;i<300;i++)await args.at(-1).checkpoint(1);return insert.apply(this,args)};Date.now=()=>active?100:0;
  const backend=await startFixtureServer(fixtures);let db,statement;try{db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));statement=db.prepare('SELECT sum(a) OVER (ORDER BY a RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) FROM t1').statement;let first;try{await statement.step({timeoutMs:2})}catch(error){first=error}assert.equal(first?.kind,'timeout');assert.throws(()=>statement.reset(),error=>error===first);EphemeralIndexCursor.prototype.insert=insert;Date.now=now;active=false;const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));assert.deepEqual(rows,[16n,16n,16n,16n]);statement.finalize();statement=undefined;
  }finally{Date.now=now;EphemeralIndexCursor.prototype.insert=insert;try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});

test('window AggValue is non-destructive and reset/finalize tear aggregate contexts down exactly once', async () => {
  const {Mem}=await import('../../src/internal/mem.ts');const setNull=Mem.prototype.setNull;let aggregateReleases=0;Mem.prototype.setNull=function(...args){if(this.aggregateState())aggregateReleases++;return setNull.apply(this,args)};
  const backend=await startFixtureServer(fixtures);let db,statement;try{db=await openFixture(new Request(`http://127.0.0.1:${backend.port}/fixture/${backend.token}/subquery-utf8`));statement=db.prepare('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW), count(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1').statement;assert.equal(await statement.step(),'row');assert.deepEqual([statement.column(0),statement.column(1)],[1n,1n]);assert.equal(aggregateReleases,0,'AggValue must not destroy contexts at row yield');statement.reset();assert.equal(aggregateReleases,2);while(await statement.step()==='row'){}assert.equal(aggregateReleases,2,'partition output uses non-destructive AggValue');statement.finalize();statement=undefined;assert.equal(aggregateReleases,4,'finalize releases each rebuilt context once');
  }finally{Mem.prototype.setNull=setNull;try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>backend.server.close(error=>error?reject(error):resolve()))}
});
