// Development-only regression: Pages base path, compressed SQLite transfer,
// worker execution, exact rendering, cancellation and recovery.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.JSQLITE_PLAYWRIGHT
  ? pathToFileURL(process.env.JSQLITE_PLAYWRIGHT).href : 'playwright');
const root = resolve('_site');
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/jsqlite/')) { response.writeHead(404).end(); return; }
    const file = resolve(root, pathname.slice('/jsqlite/'.length) || 'index.html');
    if (!file.startsWith(root + '/')) { response.writeHead(404).end(); return; }
    const content = await readFile(file);
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.sqlite': 'application/vnd.sqlite3' }[extname(file)] || 'application/octet-stream';
    if (file.endsWith('.sqlite')) {
      const compressed = gzipSync(content);
      response.writeHead(200, { 'Content-Type': mime, 'Content-Encoding': 'gzip', 'Content-Length': compressed.length });
      response.end(compressed);
    } else {
      response.writeHead(200, { 'Content-Type': mime, 'Content-Length': content.length }); response.end(content);
    }
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.JSQLITE_SITE_CHROMIUM });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/jsqlite/`);
  assert.match(await page.locator('#demo-note').innerText(), /60 seconds per run/);
  async function run() {
    await page.locator('#run').click();
    await page.waitForFunction(() => !document.getElementById('run').disabled);
    return page.locator('#status').innerText();
  }
  assert.match(await run(), /^3 rows returned/);
  assert.equal(await page.locator('tbody tr').count(), 3);
  assert.equal(await page.locator('tbody tr').first().locator('td').nth(1).innerText(), 'For Those About To Rock We Salute You');
  await page.locator('#example').selectOption('artists');
  assert.match(await run(), /^20 rows returned/);
  await page.locator('#example').selectOption('types');
  assert.match(await run(), /^1 row returned/);
  assert.deepEqual(await page.locator('tbody td').allTextContents(), ['42', '3.5', 'NULL', "X'cafe'"]);
  await page.locator('#sql').fill('SELECT nope FROM missing_table');
  assert.match(await run(), /no such table/);
  await page.locator('#example').selectOption('albums');
  await page.locator('#run').click();
  await page.locator('#cancel').click();
  assert.match(await page.locator('#status').innerText(), /^Cancelled:/);
  assert.match(await run(), /^3 rows returned/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  for (const name of ['LICENSE', 'NOTICE.md', 'source.tar.gz']) {
    assert.equal((await page.request.get(`http://127.0.0.1:${server.address().port}/jsqlite/${name}`)).status(), 200);
  }
  console.log('PASS: public site queries, gzip fixture, /jsqlite/ path, types, errors, cancellation/reuse, mobile layout and GPL/source links');
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
