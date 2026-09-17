import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, MAX_HTML, mockupName, validSlug, signSession, validSession, validateUpload } from '../lib/core.mjs';
const upload = { name: 'asset-inventory', filename: 'demo.html', html: '<!doctype html><h1>Hello</h1>' };
test('names always end with test-mockup without duplicating suffixes', () => {
  for (const input of ['asset-inventory', 'Asset-Inventory-Test', 'asset-inventory-mockup', 'asset-inventory-test-mockup']) assert.equal(mockupName(input), 'asset-inventory-test-mockup');
  assert.equal(mockupName('asset-inventory-v2-mobile'), 'asset-inventory-v2-mobile-test-mockup');
  for (const name of ['', '-name', 'name-', 'a--b', '../other', 'https://x', '<script>', 'x'.repeat(81)]) assert.throws(() => mockupName(name), AppError);
  assert.equal(validSlug(mockupName('a'.repeat(80))), true);
  for (const slug of ['../secret', 'mockup-studio/secret', 'asset-inventory', '<script>-test-mockup']) assert.equal(validSlug(slug), false);
});
test('uploads reject invalid files, empty text, invalid encoding and excess bytes', () => {
  assert.equal(validateUpload(upload), 'asset-inventory-test-mockup');
  for (const fields of [{ filename: 'a.js' }, { html: '' }, { html: 'not html' }, { html: '<html>\0' }, { html: '<html>' + 'x'.repeat(MAX_HTML) }]) assert.throws(() => validateUpload({ ...upload, ...fields }), AppError);
});
test('sessions reject tampering, expiry and password rotation', () => {
  const now = 1800000000000, secret = 's'.repeat(32), password = 'p'.repeat(20);
  const token = signSession(secret, password, now);
  assert.equal(validSession(token, secret, password, now + 1), true);
  for (const bad of [token + 'x', 'bad', token.replace(/^./, '9')]) assert.equal(validSession(bad, secret, password, now), false);
  assert.equal(validSession(token, secret, password, now + 8 * 3600000), false);
  assert.equal(validSession(token, secret, 'changed', now), false);
});
