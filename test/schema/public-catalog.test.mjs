import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { open } from '../../src/index.ts';
const root = new URL('../../', import.meta.url);
const evidence = JSON.parse(await readFile(new URL('public-catalog-native.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('reference/sqlite/manifest.json', root), 'utf8'));
assert.equal(evidence.sourceId, manifest.sqliteSourceId);
for (const fixture of evidence.files) {
  const bytes = await readFile(new URL(fixture.path, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.sha256);
  for (const expected of fixture.cases) test(`${fixture.path.split('/').at(-1)}: ${expected.sql}`, async () => {
    const fetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(bytes);
    let db, statement;
    try {
      db = await open('https://catalog.test/immutable.db');
      if (expected.error) {
        assert.throws(() => db.prepare(expected.sql), error => {
          assert.equal(error.kind, 'sqlite');
          assert.equal(error.code, expected.error.code);
          assert.equal(error.message, expected.error.message);
          return true;
        });
        return;
      }
      // Existing flattened-source outer ORDER boundary is independent of
      // catalog storage; keep this neighbor truthful rather than broadening it.
      if (expected.sql === 'SELECT name FROM (SELECT name FROM sqlite_schema) ORDER BY name LIMIT 2') {
        assert.throws(() => db.prepare(expected.sql), error => error.kind === 'unsupported'
          && error.unsupportedClassification === 'temporary'
          && error.message === 'this derived table scan shape is not implemented');
        return;
      }
      statement = db.prepare(expected.sql).statement;
      assert.ok(statement);
      assert.equal(statement.columnCount, expected.columns.length);
      assert.deepEqual(expected.columns.map((_, i) => statement.columnMetadata(i)), expected.columns);
      const rows = [];
      while (await statement.step() === 'row') rows.push(expected.columns.map((_, i) => {
        const type = statement.columnType(i), value = statement.column(i);
        return { type, value: type === 'integer' ? String(value) : value };
      }));
      assert.deepEqual(rows, expected.rows);
    } finally {
      statement?.finalize(); db?.close(); globalThis.fetch = fetch;
    }
  });
}
