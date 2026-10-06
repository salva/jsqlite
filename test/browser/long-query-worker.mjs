import { open } from './assets/engine/index.js';

self.onmessage = async ({ data: { sql, timeoutMs } }) => {
  const start = performance.now();
  const timings = {};
  const rows = [];
  let db, statement, url, error, secondary = [];
  const remaining = () => Math.max(1, timeoutMs - (performance.now() - start));
  const progress = stage => self.postMessage({ stage, elapsedMs: performance.now() - start, timings, rowCount: rows.length });
  try {
    let t = performance.now();
    const response = await fetch('./assets/chinook.sqlite', { credentials: 'omit' });
    if (!response.ok) throw new Error(`Database HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    timings.downloadMs = performance.now() - t;
    progress('downloaded');
    url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.sqlite3' }));
    t = performance.now();
    db = await open(url, { timeoutMs: remaining(), limits: { maxFileBytes: 2 * 1024 * 1024, maxRows: 1000 } });
    timings.openMs = performance.now() - t;
    progress('opened');
    t = performance.now();
    const prepared = db.prepare(sql);
    statement = prepared.statement;
    if (!statement || prepared.tail.trim()) throw new Error('Expected exactly one statement');
    timings.prepareMs = performance.now() - t;
    progress('prepared');
    t = performance.now();
    while (await statement.step({ timeoutMs: remaining() }) === 'row') {
      if (!rows.length) timings.firstRowMs = performance.now() - t;
      rows.push(Array.from({ length: statement.columnCount }, (_, i) => {
        const value = statement.column(i);
        return { type: statement.columnType(i), value: typeof value === 'bigint' ? value.toString() : value instanceof Uint8Array ? [...value] : value };
      }));
      progress('row');
    }
    timings.executeMs = performance.now() - t;
    progress('executed');
  } catch (e) { error = { message: String(e), kind: e.kind, code: e.code }; }
  finally {
    try { statement?.finalize(); } catch (e) { secondary.push({ stage: 'finalize', message: String(e) }); }
    try { db?.close(); } catch (e) { secondary.push({ stage: 'close', message: String(e) }); }
    if (url) URL.revokeObjectURL(url);
  }
  self.postMessage({ stage: 'finished', outcome: error || secondary.length ? 'error' : 'completed', timings, elapsedMs: performance.now() - start, rows, error, secondary });
};
