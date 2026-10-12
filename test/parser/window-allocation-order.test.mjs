import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseSql, SqlParseError} from '../../src/internal/parse.ts';

// parse.y frame_opt -> sqlite3WindowAlloc validates boundary types before
// containing SELECT/DDL resolution. Zero offsets retain their original kinds.
// Pinned native receipt: docs/research/card-e-h-delivery/main/window-allocation-native.json.
test('inline and named Window allocation rejects invalid types before unresolved consumers', () => {
  for (const type of ['ROWS', 'RANGE', 'GROUPS']) {
    for (const bounds of ['CURRENT ROW AND 0 PRECEDING', '0 FOLLOWING AND CURRENT ROW']) {
      for (const window of [`(${type} BETWEEN ${bounds})`, 'w']) {
        const suffix = window === 'w' ? ` WINDOW w AS (${type} BETWEEN ${bounds})` : '';
        const sql = `SELECT missing_function(missing_column) OVER ${window} FROM missing_table${suffix}`;
        for (let repeat = 0; repeat < 2; repeat++) {
          assert.throws(() => parseSql(sql), error => error instanceof SqlParseError &&
            error.message === 'unsupported frame specification', sql);
          // Error must not poison a subsequent independent parser owner.
          assert.equal(parseSql('SELECT 7,(SELECT 8)').statement?.kind, 'select');
        }
      }
    }
    const statement = parseSql(`SELECT sum(x) OVER w FROM t WINDOW w AS (${type} BETWEEN 0 PRECEDING AND 0 FOLLOWING)`).statement;
    assert.equal(statement?.kind, 'select');
    const frame = statement.windowDefinitions[0].frame;
    assert.equal(frame.start.kind, 'preceding');
    assert.equal(frame.end.kind, 'following');
    assert.ok(frame.start.expr?.reduction);
    assert.ok(frame.end.expr?.reduction);
  }
});

test('retained pinned Window allocation receipt is exercised by the parser', () => {
  const receipt = JSON.parse(readFileSync(new URL('../../docs/research/card-e-h-delivery/main/window-allocation-native.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json', import.meta.url), 'utf8'));
  assert.equal(receipt.sourceId, manifest.sqliteSourceId);
  assert.equal(receipt.results.length, 12);
  assert.equal(new Set(receipt.results.map(result => result.sql)).size, 12);
  for (const result of receipt.results) {
    assert.equal(result.code, 1);
    assert.equal(result.message, 'unsupported frame specification');
    assert.throws(() => parseSql(result.sql), error => error instanceof SqlParseError &&
      error.message === result.message, result.sql);
  }
});
