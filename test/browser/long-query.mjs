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
const root = resolve('_site');
const fixture = await readFile(resolve(root, 'assets/chinook.sqlite'));
const metadata = { sql, timeoutMs, startedAt: new Date().toISOString(), alphaCommit: '1984a9a4581746f5fb12e66ae03fad3451bf45bc', fixtureSHA256: createHash('sha256').update(fixture).digest('hex'), timings: {}, outcome: 'running' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><title>JSQLite long query benchmark</title>'); return; }
    const file = pathname === '/benchmark-worker.mjs' ? resolve('test/browser/long-query-worker.mjs') : resolve(root, pathname.slice(1));
    if (pathname !== '/benchmark-worker.mjs' && !file.startsWith(root + '/')) { response.writeHead(404).end(); return; }
    const bytes = await readFile(file);
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
    console.log(JSON.stringify(event.stage === 'finished' ? { ...event, rows: `${event.rows.length} rows (full values saved in report)` } : event));
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
