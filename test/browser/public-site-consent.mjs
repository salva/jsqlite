import assert from 'node:assert/strict';

export async function testConsent(browser, base) {
  const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const page = await context.newPage();
  const googleRequests = [];
  await context.route(/https:\/\/[^/]*(google-analytics|googletagmanager|doubleclick)\.[^/]+\//, async route => {
    googleRequests.push(route.request().url());
    await route.fulfill({ contentType: 'application/javascript', body: '// Analytics stub: no real visitor data in tests.' });
  });
  const banner = page.locator('#analytics-consent');
  const open = () => page.locator('#analytics-settings').click();
  const reject = () => page.locator('#analytics-reject').click();
  const ready = () => page.waitForFunction(() => !document.getElementById('run').disabled);
  try {
    await page.goto(base + '?private=secret#private');
    await banner.waitFor({ state: 'visible' });
    await ready();
    assert.equal(googleRequests.length, 0, 'No Google requests before consent');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await reject();
    await page.reload();
    await ready();
    assert.equal(await banner.isVisible(), false, 'Rejection remembered');
    assert.equal(googleRequests.length, 0, 'No Google requests after rejection/reload');
    await open();
    await page.locator('#analytics-accept').click();
    await page.waitForFunction(() => document.querySelector('script[src*="googletagmanager"]'));
    await page.waitForLoadState('networkidle');
    assert.equal(googleRequests.length, 1);
    const config = await page.evaluate(() => Array.from(window.dataLayer.find(row => row[0] === 'config')));
    assert.equal(config[1], 'G-323PY8QEP1');
    assert.equal(config[2].page_location, new URL(base).origin + new URL(base).pathname);
    assert.equal(config[2].page_referrer, '');
    assert.equal(config[2].allow_google_signals, false);
    await page.locator('#sql').fill("SELECT 'private editor content'");
    assert.equal(await page.evaluate(() => JSON.stringify(window.dataLayer).includes('private editor content')), false);
    await open();
    await page.locator('#analytics-accept').click();
    assert.equal(googleRequests.length, 1, 'No duplicate tag on repeated acceptance');
    await page.reload();
    await ready();
    await page.waitForLoadState('networkidle');
    assert.equal(googleRequests.length, 2, 'Acceptance remembered');
    await context.addCookies([{ name: '_ga', value: 'test', url: new URL(base).origin + '/jsqlite/', secure: new URL(base).protocol === 'https:' }]);
    await open();
    await Promise.all([page.waitForEvent('load'), reject()]);
    await ready();
    assert.equal(googleRequests.length, 2, 'Withdrawal stops tag after reload');
    assert.equal((await context.cookies()).some(cookie => cookie.name === '_ga'), false);
    await page.evaluate(() => localStorage.setItem('jsqlite-analytics-consent-v1', JSON.stringify({ value: 'accepted', expires: 1 })));
    await page.reload();
    await banner.waitFor({ state: 'visible' });
    assert.equal(googleRequests.length, 2, 'Expired acceptance does not load tag');
    await page.goto(new URL('privacy.html', base).href);
    assert.equal(googleRequests.length, 2, 'Privacy page has no analytics');
    assert.match(await page.locator('h1').innerText(), /Privacy/);
    // Unavailable storage must not break the playground or imply consent.
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
      Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
    });
    await page.goto(base);
    await banner.waitFor({ state: 'visible' });
    await reject();
    await ready();
    assert.equal(googleRequests.length, 2);
    console.log('PASS: consent default/reject/accept/persistence/expiry/withdrawal, unavailable storage, private URL/editor exclusion and 320px layout');
  } finally { await context.close(); }
}
