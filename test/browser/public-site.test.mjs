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
  const base = process.env.JSQLITE_SITE_URL || `http://127.0.0.1:${server.address().port}/jsqlite/`;
  await page.goto(base);
  assert.match(await page.locator('.attribution').innerText(), /v0\.0\.0-alpha\.5/);
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
  await page.locator('#sql').fill('SELECT a.Title AS album,COUNT(*) AS tracks,ROUND(SUM(t.Milliseconds)/60000.0,1) AS total_minutes,ROUND(AVG(t.UnitPrice),2) AS average_price,SUM(CASE WHEN t.Milliseconds>300000 THEN 1 ELSE 0 END) AS tracks_over_5_minutes FROM Album a JOIN Track t ON t.AlbumId=a.AlbumId WHERE a.AlbumId BETWEEN 1 AND 20 GROUP BY a.AlbumId,a.Title HAVING COUNT(*)>=5 ORDER BY total_minutes DESC,album LIMIT 10;');
  const started = Date.now();
  assert.match(await run(), /^10 rows returned/);
  const expected = [
    ['Big Ones', '15', '73.5', '0.99', '8'],
    ['Alcohol Fueled Brewtality Live! [Disc 1]', '13', '67.7', '0.99', '6'],
    ['Audioslave', '14', '65.5', '0.99', '5'],
    ['Chemical Wedding', '11', '61.6', '0.99', '5'],
    ['Jagged Little Pill', '13', '57.5', '0.99', '2'],
    ['Facelift', '12', '54.2', '0.99', '3'],
    ['Out Of Exile', '12', '53.7', '0.99', '1'],
    ['Body Count', '17', '53.2', '0.99', '5'],
    ['Warner 25 Anos', '14', '48.4', '0.99', '1'],
    ['The Best Of Billy Cobham', '8', '44.7', '0.99', '3'],
  ];
  assert.deepEqual(await page.locator('tbody td').allTextContents(), expected.flat());
  console.log(`Original Chinook query: ${Date.now() - started} ms including worker/open/prepare/render; ten native-matching rows`);
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
    assert.equal((await page.request.get(new URL(name, base).href)).status(), 200);
  }
  console.log('PASS: public site queries, gzip fixture, /jsqlite/ path, types, errors, cancellation/reuse, mobile layout and GPL/source links');
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
