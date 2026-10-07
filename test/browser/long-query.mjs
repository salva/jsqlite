// Opt-in measurement, not a CI gate or a change to the public demo timeout.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const timeoutMs = Number(process.env.JSQLITE_BENCH_TIMEOUT_MS || 30 * 60 * 1000);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid benchmark timeout');
const reportPath = process.env.JSQLITE_BENCH_REPORT;
if (!reportPath) throw new Error('Set JSQLITE_BENCH_REPORT to an external evidence path');
// Diagnostic-only instrumentation of served bytes. Never changes built assets.
const profileScheduler = process.env.JSQLITE_BENCH_PROFILE;
if (profileScheduler && !['original', 'message-channel', 'microtask'].includes(profileScheduler)) throw new Error('Invalid profile scheduler');
const sql = process.env.JSQLITE_BENCH_SQL || `SELECT
    a.Title AS album,
    COUNT(*) AS tracks,
    ROUND(SUM(t.Milliseconds) / 60000.0, 1) AS total_minutes,
    ROUND(AVG(t.UnitPrice), 2) AS average_price,
    SUM(CASE WHEN t.Milliseconds > 300000 THEN 1 ELSE 0 END) AS tracks_over_5_minutes
FROM Album AS a
JOIN Track AS t ON t.AlbumId = a.AlbumId
WHERE a.AlbumId BETWEEN 1 AND 20
GROUP BY a.AlbumId, a.Title
HAVING COUNT(*) >= 5
ORDER BY total_minutes DESC, album
LIMIT 10;`;
const { chromium } = await import(process.env.JSQLITE_PLAYWRIGHT
  ? pathToFileURL(process.env.JSQLITE_PLAYWRIGHT).href : 'playwright');
const root = resolve(process.env.JSQLITE_BENCH_SITE_ROOT || '_site');
const engineCommit = process.env.JSQLITE_BENCH_ENGINE_COMMIT || '1984a9a4581746f5fb12e66ae03fad3451bf45bc';
if (process.env.JSQLITE_BENCH_SITE_ROOT && !process.env.JSQLITE_BENCH_ENGINE_COMMIT) throw new Error('Custom engine root requires an explicit commit');
const fixture = await readFile(resolve(root, 'assets/chinook.sqlite'));
const metadata = { sql, timeoutMs, profileScheduler, startedAt: new Date().toISOString(), engineCommit, alphaCommit: engineCommit === '1984a9a4581746f5fb12e66ae03fad3451bf45bc' ? engineCommit : undefined, fixtureSHA256: createHash('sha256').update(fixture).digest('hex'), timings: {}, outcome: 'running' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><title>JSQLite long query benchmark</title>'); return; }
    const file = pathname === '/benchmark-worker.mjs' ? resolve('test/browser/long-query-worker.mjs') : resolve(root, pathname.slice(1));
    if (pathname !== '/benchmark-worker.mjs' && !file.startsWith(root + '/')) { response.writeHead(404).end(); return; }
    let bytes = await readFile(file);
    if (profileScheduler && pathname === '/benchmark-worker.mjs') {
      const setup = `
const profile = globalThis.__benchProfile = { scheduler: ${JSON.stringify(profileScheduler)}, dispatches: 0, pcCounts: [], yields: {}, loads: 0, chunks: 0 };
const channel = new MessageChannel();
let resume;
channel.port1.onmessage = () => { const done = resume; resume = undefined; done(); };
globalThis.__profileYield = async site => {
  const stat = profile.yields[site] ??= { count: 0, elapsedMs: 0, maxMs: 0 };
  const start = performance.now();
  if (profile.scheduler === 'original') await new Promise(done => setTimeout(done, 0));
  else if (profile.scheduler === 'message-channel') await new Promise(done => { resume = done; channel.port2.postMessage(null); });
  else await Promise.resolve();
  const elapsed = performance.now() - start;
  stat.count++; stat.elapsedMs += elapsed; stat.maxMs = Math.max(stat.maxMs, elapsed);
};
`;
      let text = setup + bytes.toString();
      text = text.replace("stage: 'finished', outcome:", "stage: 'finished', profile, outcome:");
      bytes = Buffer.from(text);
    }
    if (profileScheduler && pathname === '/assets/engine/internal/vdbe.js') {
      let text = bytes.toString();
      const replaceOnce = (before, after) => {
        if (text.split(before).length !== 2) throw new Error('Profile anchor missing or ambiguous');
        text = text.replace(before, after);
      };
      replaceOnce('this.#program = program;', `this.#program = program;
        globalThis.__benchProfile.program = JSON.parse(JSON.stringify({ ops: program.ops, whereAccounting: program.whereAccounting }, (_, value) => typeof value === 'bigint' ? value.toString() : value instanceof Map ? [...value] : value instanceof Set ? [...value] : value));`);
      replaceOnce('const op = this.#program.ops[this.#pc++];', `const profile = globalThis.__benchProfile;
                    profile.dispatches++;
                    profile.pcCounts[this.#pc] = (profile.pcCounts[this.#pc] ?? 0) + 1;
                    profile.work = this.#work;
                    const op = this.#program.ops[this.#pc++];`);
      replaceOnce('async #loadRecord(cursorId, options, limit, started) {', 'async #loadRecord(cursorId, options, limit, started) { globalThis.__benchProfile.loads++;');
      replaceOnce('chunks.push(chunk);', 'globalThis.__benchProfile.chunks++; chunks.push(chunk);');
      const yieldAnchor = 'await new Promise(resolve => setTimeout(resolve, 0));';
      if (text.split(yieldAnchor).length !== 5) throw new Error('Unexpected yield sites');
      for (const site of ['dispatch', 'overflow', 'scalar', 'private']) text = text.replace(yieldAnchor, `await globalThis.__profileYield('${site}');`);
      bytes = Buffer.from(text);
    }
    if (file.endsWith('.sqlite')) {
      const gzip = gzipSync(bytes);
      response.writeHead(200, { 'Content-Type': 'application/vnd.sqlite3', 'Content-Encoding': 'gzip', 'Content-Length': gzip.length }); response.end(gzip);
    } else {
      response.writeHead(200, { 'Content-Type': ['.js', '.mjs'].includes(extname(file)) ? 'application/javascript' : 'application/octet-stream' }); response.end(bytes);
    }
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser, timer, settle;
let latest = {};
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.JSQLITE_SITE_CHROMIUM });
  metadata.browser = browser.version();
  await writeFile(reportPath, JSON.stringify(metadata, null, 2));
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const terminal = new Promise(done => { settle = done; });
  await page.exposeFunction('benchProgress', event => {
    latest = event;
    console.log(JSON.stringify(event.stage === 'finished' ? { ...event, profile: event.profile ? 'Instrumentation saved in report' : undefined, rows: `${event.rows.length} rows (full values saved in report)` } : event));
    if (event.stage === 'finished') settle(event);
  });
  // Node's watchdog remains effective even if synchronous browser work cannot
  // service a page timer. Browser termination stops the disposable worker.
  const wallStart = performance.now();
  timer = setTimeout(() => settle({ ...latest, outcome: 'timed_out', elapsedMs: performance.now() - wallStart, interruptedStage: latest.stage, stage: 'watchdog' }), timeoutMs);
  await page.evaluate(({ sql, timeoutMs }) => {
    const worker = new Worker('/benchmark-worker.mjs', { type: 'module' });
    worker.onmessage = ({ data }) => window.benchProgress(data);
    worker.onerror = event => window.benchProgress({ stage: 'finished', outcome: 'error', rows: [], error: { message: event.message } });
    worker.postMessage({ sql, timeoutMs });
  }, { sql, timeoutMs });
  const result = await terminal;
  clearTimeout(timer);
  await writeFile(reportPath, JSON.stringify({ ...metadata, ...result, finishedAt: new Date().toISOString(), correctness: 'Timing test only; returned rows need independent comparison.' }, null, 2));
  console.log(`Report: ${reportPath}; outcome: ${result.outcome}`);
  if (result.outcome !== 'completed') process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await browser?.close();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
