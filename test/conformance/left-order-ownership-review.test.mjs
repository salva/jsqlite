import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture, privateAccounting} from './public-api-adapter.mjs';

const capture = JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/review-left-order-native.json', import.meta.url)));
const decode = cell => cell.type === 'integer' ? BigInt(cell.value)
  : cell.type === 'null' ? null : Buffer.from(cell.utf8Hex, 'hex').toString('utf8');
// Original residual LEFT assertion, not a new whereI source case. where.c
// wherePathSatisfiesOrderBy matches the outer IPK/XN_ROWID term; select.c
// sqlite3WhereIsOrdered removes the sorter when every ORDER term is satisfied.
// Nullable ON failure must still produce the outer row without capturing it in
// a sorter. Independent read-only native rows/full EXPLAIN are committed above.
for (const variant of capture.variants) {
  test(`original LEFT order ownership survives rebind/reset: ${variant.id}`, async () => {
    const manifest = JSON.parse(fs.readFileSync('reference/sqlite/manifest.json'));
    assert.equal(capture.sourceId, manifest.sqliteSourceId);
    const bytes = fs.readFileSync(variant.fixture.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), variant.fixture.sha256);
    const server = http.createServer((_request, response) => response.end(bytes));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let db, statement;
    try {
      db = await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
      statement = db.prepare(variant.sql).statement;
      assert.equal(statement.columnCount, 2);
      for (const [i, run] of variant.runs.entries()) {
        if (i) statement.reset();
        statement.clearBindings();
        statement.bind(1, run.binding);
        assert.equal(run.sortOperations, 0);
        assert.ok(!run.opcodes.some(op => ['SorterOpen', 'SorterInsert', 'SorterSort', 'Sort'].includes(op)));
        assert.ok(run.opcodes.includes('NullRow'));
        const rows = [], types = [];
        while (await statement.step() === 'row') {
          rows.push([statement.column(0), statement.column(1)]);
          types.push([statement.columnType(0), statement.columnType(1)]);
        }
        assert.deepEqual(rows, run.rows.map(row => row.map(decode)), `binding ${run.binding}`);
        assert.deepEqual(types, run.rows.map(row => row.map(cell => cell.type)));
        assert.equal(privateAccounting(statement).sorterRows, 0, 'outer order is consumed, including null extension');
        assert.equal(await statement.step(), 'done');
      }
    } finally {
      statement?.finalize();
      db?.closeDeferred();
      await new Promise(resolve => server.close(resolve));
    }
  });
}
