// Real-browser regression for the actual static app; development-only tooling.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.JSQLITE_PLAYWRIGHT ?? '/opt/saivage-jsqlite2/node_modules/playwright/index.mjs').href);
const root = process.cwd();
const expected = JSON.parse(fs.readFileSync('examples/browser/expected.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('examples/browser/chinook.sqlite')).digest('hex'), expected.fixture.sha256);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname);
  if (!file.startsWith(root + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
  res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.JSQLITE_CHROMIUM });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  await page.goto(origin + '/examples/browser/index.html');
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Ready'));
  for (const c of expected.cases) {
    await page.selectOption('#example', c.id);
    await page.click('#run');
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.match(await page.textContent('#status'), /^PASS:/);
    const actual = JSON.parse(await page.textContent('#actual'));
    assert.deepEqual(actual.rows, c.rows);
    assert.deepEqual(actual.columns.map(c => c.index), c.columns.map((_, i) => i));
    assert.deepEqual(actual.events, ['opened', 'prepared', 'done', 'finalized', 'closed']);
    console.log('PASS', c.id, 'rows, storage classes, metadata positions, cleanup');
  }
  await page.click('#bad-open'); await page.waitForFunction(() => !document.querySelector('#run').disabled);
  let actual = JSON.parse(await page.textContent('#actual'));
  assert.equal(actual.error.stage, 'operation'); assert.match(actual.error.message, /transport/);
  assert.deepEqual(actual.events, ['no connection published; nothing to close']);
  console.log('PASS failed-open display/no handle');
  await page.fill('#sql', 'SELECT missing_column FROM Album'); await page.click('#run');
  await page.waitForFunction(() => !document.querySelector('#run').disabled);
  actual = JSON.parse(await page.textContent('#actual'));
  assert.equal(actual.error.stage, 'operation'); assert.deepEqual(actual.events, ['opened', 'closed']);
  console.log('PASS prepare failure/close');
  await page.fill('#sql', "SELECT abs(-9223372036854775808)"); await page.click('#run');
  await page.waitForFunction(() => !document.querySelector('#run').disabled);
  actual = JSON.parse(await page.textContent('#actual'));
  assert.equal(actual.error.stage, 'operation'); assert.match(actual.error.message, /overflow/);
  assert.equal(actual.events.at(-1), 'closed'); assert.match(actual.events.at(-2), /finalize/);
  console.log('PASS step error stays primary/finalize destroys/close');
  const precedence = await page.evaluate(async () => {
    const { execute } = await import('./query.js');
    const calls=[];
    const result=await execute('unused','unused',{},async()=>({prepare(){return {tail:'',statement:{columnCount:0,async step(){throw Error('operation')},finalize(){calls.push('finalize');throw Error('finalize')}}}},close(){calls.push('close');throw Error('close')}}));
    return {result,calls};
  });
  assert.equal(precedence.result.error.message, 'Error: operation');
  assert.deepEqual(precedence.result.secondary.map(e=>e.stage), ['finalize','close']);
  assert.deepEqual(precedence.calls, ['finalize','close']);
  assert.deepEqual(errors, []);
  console.log('PASS injected independent cleanup errors: operation > finalize > close');
  console.log('Chromium', browser.version());
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
