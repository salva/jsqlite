import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture} from '../../../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../../../test/conformance/close-test-server.mjs';
const root = new URL('../', import.meta.url);
const evidence = JSON.parse(fs.readFileSync(new URL('caller-native.json', root)));
async function rows(st) {
  const result = [];
  while (await st.step() === 'row') result.push(Array.from({length: st.columnCount}, (_, i) => {
    const type = st.columnType(i), value = st.column(i);
    if (type === 'integer') return {type, value: String(value)};
    if (type === 'real') { const b = Buffer.alloc(8); b.writeDoubleBE(value); return {type, ieee754be: b.toString('hex')}; }
    throw new Error(`unexpected result type ${type}`);
  }));
  return result;
}
// Literal oracle rows validate binding execution only. SQLite may reprepare a
// parameter-sensitive plan; this translation's initial unknown-value fallback
// makes no reprepare/plan parity claim (vdbemem.c sqlite3Stat4ValueFromExpr).
for (const v of evidence.variants) test(`${v.encoding}: STAT4 parameter reset/rebind keeps typed rows and metadata`, async () => {
  const bytes = fs.readFileSync(new URL(v.fixture, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), v.sha256);
  const server = http.createServer((_q, r) => { r.writeHead(200, {'Content-Length': bytes.length}); r.end(bytes); });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  let db, st;
  try {
    db = await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
    st = db.prepare('SELECT id,r,b FROM t WHERE a=?1 AND r=7.0 ORDER BY id').statement;
    const hot = v.cases.find(c => c.id === 'competing-hot'), cold = v.cases.find(c => c.id === 'competing-cold');
    hot.metadata.forEach((m, i) => assert.deepEqual(st.columnMetadata(i), {name:m.name, declaredType:m.declaredType, database:m.databaseName, table:m.tableName, origin:m.originName}));
    st.bind(1, 0n);
    assert.deepEqual(await rows(st), hot.rows);
    st.reset();
    assert.deepEqual(await rows(st), hot.rows, 'reset retains bound hot value');
    st.reset(); st.bind(1, 99n);
    assert.deepEqual(await rows(st), cold.rows);
    st.reset(); st.clearBindings();
    assert.deepEqual(await rows(st), [], 'NULL binding cannot match equality');
    st.reset(); st.bind(1, 0n);
    assert.deepEqual(await rows(st), hot.rows, 'same statement resumes hot rows after empty executions');
    assert.equal(st.columnCount, hot.metadata.length);
  } finally {
    try { st?.finalize(); } finally { try { db?.closeDeferred(); } finally { await closeTestServer(server); } }
  }
});
