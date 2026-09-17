import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createDatabaseStorage, databaseUrl } from '../lib/database.mjs';

test('recognizes automatic Vercel/Neon connection variables', () => {
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING']) assert.equal(databaseUrl({ [key]: 'postgresql://example' }), 'postgresql://example');
  assert.equal(databaseUrl({ DATABASE_URL: 'preferred', POSTGRES_URL: 'fallback' }), 'preferred');
  assert.equal(databaseUrl({}), '');
});

test('PostgreSQL schema initializes itself and supports protected uploads, updates and paging', async () => {
  const pg = new PGlite();
  let initialized = 0;
  const sql = {
    query: async (text, values) => (await pg.query(text, values)).rows,
    transaction: callback => {
      initialized++;
      const commands = callback({ query: (text, values) => ({ text, values }) });
      return pg.transaction(async tx => {
        const results = [];
        for (const command of commands) results.push((await tx.query(command.text, command.values)).rows);
        return results;
      });
    }
  };
  const store = createDatabaseStorage(sql);
  const upload = { name: 'inventory', filename: 'index.html', html: '<h1>Inventory — 日本語</h1>' };
  try {
    // Cold first requests share one automatic initialization.
    const empty = await Promise.all([store.list(), store.read('missing-test-mockup')]);
    assert.deepEqual(empty, [{ items: [], next: null }, null]);
    assert.equal(initialized, 1);
    const saved = await store.save(upload);
    assert.equal(saved.path, '/view/inventory-test-mockup');
    assert.equal(saved.size, Buffer.byteLength(upload.html));
    assert.equal(await store.read(saved.name), upload.html);
    await assert.rejects(store.save(upload), error => error.status === 409);
    assert.equal(await store.read(saved.name), upload.html, 'duplicate insert preserves the old HTML');
    const trickyHtml = `<h1>It's literal SQL text</h1><!-- '); DROP TABLE public.mockup_studio_pages; --><script>const a = "quotes";</script>`;
    const updated = await store.save({ ...upload, html: trickyHtml, replace: true });
    assert.equal(updated.path, saved.path);
    assert.equal(await store.read(saved.name), trickyHtml);
    await assert.rejects(store.read("x' OR 1=1 --"), error => error.status === 400);
    await assert.rejects(store.list("x' OR 1=1 --"), error => error.status === 400);
    await pg.query(`INSERT INTO public.mockup_studio_pages (slug, html)
      SELECT 'sample-' || lpad(n::text, 3, '0') || '-test-mockup', '<h1>Sample</h1>' FROM generate_series(1, 102) AS n`);
    const first = await store.list();
    assert.equal(first.items.length, 100);
    assert.equal(first.next, first.items.at(-1).name);
    assert.equal(first.items.some(item => 'html' in item), false);
    const last = await store.list(first.next);
    assert.equal(last.items.length, 3); assert.equal(last.next, null);
    assert.equal(new Set([...first.items, ...last.items].map(item => item.name)).size, 103);
    // A fresh server instance finds the same table/data without resetting it.
    const another = createDatabaseStorage(sql);
    assert.equal(await another.read(saved.name), trickyHtml);
    assert.equal((await another.list()).items.length, 100);
    await assert.rejects(pg.query('INSERT INTO public.mockup_studio_pages (slug,html) VALUES ($1,$2)', ['oversized-test-mockup', 'x'.repeat(2097153)]), error => error.code === '23514');
  } finally { await pg.close(); }
});

test('failed automatic setup can be retried on the next request', async () => {
  let attempts = 0;
  const store = createDatabaseStorage({
    transaction: async () => { if (++attempts === 1) throw new Error('temporary connection failure'); },
    query: async () => []
  });
  await assert.rejects(store.list(), /temporary connection failure/);
  assert.deepEqual(await store.list(), { items: [], next: null });
  assert.equal(attempts, 2);
});
