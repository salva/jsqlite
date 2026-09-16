import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startFixtureServer } from './fixture-server.mjs';
import { openFixture } from './public-api-adapter.mjs';

async function allRows(statement) {
  const rows = [];
  while (await statement.step() === 'row') {
    rows.push(Array.from({ length: statement.columnCount }, (_, index) => statement.column(index)));
  }
  return rows;
}

// Pinned SQLite 3.53.4 (source ID in reference/sqlite/manifest.json) returns these
// first-seen DISTINCT expression records for fixture t2. This is the smallest
// public check for the currently missing direct-expression lowering boundary.
test('SELECT DISTINCT admits typed direct expressions', async () => {
  const bridge = await startFixtureServer(path.resolve('test/fixtures'));
  let db;
  let statement;
  try {
    db = await openFixture(new Request(
      `http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`,
    ));
    statement = db.prepare(
      'SELECT DISTINCT a+0 AS k, typeof(a+0) AS ty FROM t2',
    ).statement;
    assert.deepEqual(await allRows(statement), [
      [1n, 'integer'],
      [null, 'null'],
      [345n, 'integer'],
      [67890n, 'integer'],
    ]);
  } finally {
    try { statement?.finalize(); } catch {}
    try { db?.closeDeferred(); } catch {}
    await new Promise((resolve, reject) => bridge.server.close(
      error => error ? reject(error) : resolve(),
    ));
  }
});

// Native 3.53.4 returns four records for both statements below (including one
// NULL record). This protects selectInnerLoop's DISTINCT-before-sort branch:
// sorting must not accidentally retain the second NULL input row.
test('SELECT DISTINCT removes duplicate complete records before ORDER BY', async () => {
  const bridge = await startFixtureServer(path.resolve('test/fixtures'));
  let db;
  let statement;
  try {
    db = await openFixture(new Request(
      `http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`,
    ));
    for (const sql of [
      'SELECT DISTINCT a,a FROM t2 ORDER BY a,a',
      'SELECT DISTINCT a+0,a+0 FROM t2 ORDER BY 1,2',
    ]) {
      statement = db.prepare(sql).statement;
      assert.deepEqual(await allRows(statement), [
        [null, null],
        [1n, 1n],
        [345n, 345n],
        [67890n, 67890n],
      ], sql);
      statement.finalize();
      statement = undefined;
    }
  } finally {
    try { statement?.finalize(); } catch {}
    try { db?.closeDeferred(); } catch {}
    await new Promise((resolve, reject) => bridge.server.close(
      error => error ? reject(error) : resolve(),
    ));
  }
});

// Captured independently with pinned SQLite 3.53.4 after generating this
// immutable fixture with the pinned sqlite3.c (see reference/sqlite/manifest.json).
test('SELECT DISTINCT preserves typed equality, collations, metadata, WHERE, and LIMIT', async () => {
  const bridge = await startFixtureServer(path.resolve('test/fixtures'));
  let db;
  let statement;
  const run = async (sql) => {
    statement = db.prepare(sql).statement;
    const metadata = Array.from({ length: statement.columnCount }, (_, i) => statement.columnMetadata(i));
    const rows = await allRows(statement);
    statement.finalize();
    statement = undefined;
    return { metadata, rows };
  };
  try {
    db = await openFixture(new Request(
      `http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`,
    ));
    assert.deepEqual((await run('SELECT DISTINCT v FROM distinct_edge')).rows, [
      [null], [1n], ['1'], [new Uint8Array([0x31])],
    ], 'NULLs compare equal, INTEGER equals REAL, and TEXT differs from BLOB');
    assert.deepEqual((await run('SELECT DISTINCT v, typeof(v) FROM distinct_edge')).rows, [
      [null, 'null'], [1n, 'integer'], [1, 'real'], ['1', 'text'],
      [new Uint8Array([0x31]), 'blob'],
    ], 'the complete DISTINCT record controls numeric equality');
    assert.deepEqual((await run('SELECT DISTINCT bin FROM distinct_edge')).rows,
      [['a'], ['A'], ['a '], ['a\0x'], ['a\0y'], ['z']]);
    assert.deepEqual((await run('SELECT DISTINCT nc FROM distinct_edge')).rows,
      [['a'], ['a '], ['a\0x'], ['z']]);
    assert.deepEqual((await run('SELECT DISTINCT rt FROM distinct_edge')).rows,
      [['a'], ['b'], ['c']]);
    assert.deepEqual((await run('SELECT DISTINCT nc COLLATE BINARY FROM distinct_edge')).rows,
      [['a'], ['A'], ['a '], ['a\0x'], ['a\0y'], ['z']]);
    const duplicate = await run('SELECT DISTINCT v, v FROM distinct_edge WHERE v IS NOT NULL LIMIT 3');
    assert.deepEqual(duplicate.metadata.map(column => column.name), ['v', 'v']);
    assert.deepEqual(duplicate.rows, [
      [1n, 1n], ['1', '1'], [new Uint8Array([0x31]), new Uint8Array([0x31])],
    ]);
  } finally {
    try { statement?.finalize(); } catch {}
    try { db?.closeDeferred(); } catch {}
    await new Promise((resolve, reject) => bridge.server.close(
      error => error ? reject(error) : resolve(),
    ));
  }
});

test('SELECT DISTINCT preserves prepare errors and statement ownership', async () => {
  const bridge = await startFixtureServer(path.resolve('test/fixtures'));
  let db;
  try {
    db = await openFixture(new Request(
      `http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`,
    ));
    assert.throws(
      () => db.prepare('SELECT DISTINCT missing FROM distinct_edge'),
      error => error?.kind === 'sqlite' && error.code === 1
        && error.message === 'no such column: missing',
    );
    assert.throws(
      () => db.prepare('SELECT DISTINCT bin COLLATE unknown FROM distinct_edge'),
      error => error?.kind === 'sqlite' && error.code === 1
        && error.message === 'no such collation sequence: unknown',
    );
    const statement = db.prepare('SELECT DISTINCT bin FROM distinct_edge LIMIT 1').statement;
    assert.equal(await statement.step(), 'row', 'prepare failures do not poison later admission');
    statement.finalize();
  } finally {
    try { db?.closeDeferred(); } catch {}
    await new Promise((resolve, reject) => bridge.server.close(
      error => error ? reject(error) : resolve(),
    ));
  }
});

test('bounded DISTINCT compounds are admitted while subqueries stay structurally unsupported', async () => {
  const bridge = await startFixtureServer(path.resolve('test/fixtures'));
  let db;
  try {
    db = await openFixture(new Request(
      `http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`,
    ));
    const compound = db.prepare('SELECT DISTINCT a FROM t2 UNION SELECT a FROM t2').statement;
    while (await compound.step() === 'row') {}
    compound.finalize();
    for (const sql of [
      'SELECT DISTINCT a FROM (SELECT a FROM t2)',
    ]) {
      assert.throws(
        () => db.prepare(sql),
        error => error?.kind === 'unsupported'
          && error.unsupportedClassification === 'temporary'
          && error.message === 'compound SELECTs, VALUES, and subqueries are not implemented',
        sql,
      );
    }

    const statement = db.prepare('SELECT DISTINCT a FROM t2 LIMIT 1').statement;
    assert.equal(await statement.step(), 'row', 'structural rejections do not poison later admission');
    statement.finalize();
  } finally {
    try { db?.closeDeferred(); } catch {}
    await new Promise((resolve, reject) => bridge.server.close(
      error => error ? reject(error) : resolve(),
    ));
  }
});

test('DISTINCT duplicate jump skips a non-result multi-term ORDER key and SorterInsert', async () => {
  const bridge = await startFixtureServer(path.resolve('test/fixtures'));
  let db;
  let statement;
  try {
    db = await openFixture(new Request(
      `http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`,
    ));
    statement = db.prepare(
      'SELECT DISTINCT a FROM t2 ORDER BY a+0 DESC, typeof(a)',
    ).statement;
    assert.deepEqual(await allRows(statement), [[67890n], [345n], [1n], [null]]);
  } finally {
    try { statement?.finalize(); } catch {}
    try { db?.closeDeferred(); } catch {}
    await new Promise((resolve, reject) => bridge.server.close(
      error => error ? reject(error) : resolve(),
    ));
  }
});
