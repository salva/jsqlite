import assert from 'node:assert/strict';
import test from 'node:test';
import * as vdbe from '../../src/internal/vdbe.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';

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
  assert.equal(shared.producer.from, resolved.source.from);
  assert.equal(shared.producer.where, resolved.source.where);
  assert.equal(graph.outer.orderBy, resolved.source.orderBy);
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
