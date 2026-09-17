const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('.local/qa', { recursive: true });
  const server = spawn(process.execPath, ['tools/dev.mjs'], { windowsHide: true, env: { ...process.env, PORT: '3041', ADMIN_PASSWORD: 'browser-test-only-password', SESSION_SECRET: 'browser-test-only-secret-at-least-32-chars', LOCAL_STORAGE_DIR: `.local/tests/${randomUUID()}` }, stdio: 'pipe' });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(new Error('Test server exited: ' + code))); });
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3041');
    await page.locator('#password').fill('browser-test-only-password');
    await page.getByRole('button', { name: 'Open workspace' }).click();
    await page.locator('#publisher-panel').waitFor({ state: 'visible' });
    await page.locator('#name').fill('asset-inventory-test-mockup');
    assert.equal(await page.locator('#url-preview').textContent(), '127.0.0.1:3041/view/asset-inventory-test-mockup');
    const html = `<!doctype html><title>Test mockup</title><h1>Asset inventory</h1><button id="demo">Try interaction</button><p id="result"></p><script>
      document.getElementById('demo').onclick=()=>document.getElementById('result').textContent='It works';
      try {document.cookie;document.body.dataset.cookies='readable'} catch {document.body.dataset.cookies='blocked'}
      try {localStorage.getItem('x');document.body.dataset.storage='readable'} catch {document.body.dataset.storage='blocked'}
    </script>`;
    await page.locator('#file').setInputFiles({ name: 'mockup.html', mimeType: 'text/html', buffer: Buffer.from(html) });
    await page.screenshot({ path: '.local/qa/desktop.png', fullPage: true });
    await page.locator('#publish-button').click();
    await page.locator('#result-link').waitFor({ state: 'visible' });
    const link = await page.locator('#result-link').getAttribute('href');
    assert.equal(link, 'http://127.0.0.1:3041/view/asset-inventory-test-mockup');
    const mockup = await context.newPage(); await mockup.goto(link);
    await mockup.locator('#demo').click();
    assert.equal(await mockup.locator('#result').textContent(), 'It works');
    assert.equal(await mockup.locator('body').getAttribute('data-cookies'), 'blocked');
    assert.equal(await mockup.locator('body').getAttribute('data-storage'), 'blocked');
    const mutation = await mockup.evaluate(async () => {
      try { return (await fetch('/api/publisher?action=publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status; } catch { return 'blocked'; }
    });
    assert.equal(mutation, 'blocked');
    await page.waitForFunction(() => !document.getElementById('publish-button').disabled);
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    assert.equal(await page.locator('#replace').isChecked(), true);
    await page.locator('#file').setInputFiles({ name: 'updated.html', mimeType: 'text/html', buffer: Buffer.from('<h1>Updated mockup</h1>') });
    await page.locator('#publish-button').click();
    await page.waitForFunction(() => !document.getElementById('publish-button').disabled);
    await mockup.reload(); assert.equal(await mockup.locator('h1').textContent(), 'Updated mockup');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.local/qa/mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#logout').click(); await page.locator('#login-panel').waitFor({ state: 'visible' });
    const anonymous = await browser.newContext(); const visitor = await anonymous.newPage();
    await visitor.goto(link); assert.equal(await visitor.locator('h1').textContent(), 'Updated mockup');
    assert.deepEqual(errors, []);
    console.log('Browser checks passed with real local storage: login, upload, named link, public HTML, JavaScript interaction, sandbox isolation, same-link update, mobile layout, logout and anonymous viewing.');
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
