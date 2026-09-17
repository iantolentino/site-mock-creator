import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export const MAX_HTML = 2 * 1024 * 1024;
export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function equal(a, b) {
  return timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());
}
export function mockupName(input) {
  if (typeof input !== 'string') throw new AppError(400, 'Enter a mockup name.');
  const name = input.trim().toLowerCase().replace(/(?:-test-mockup|-mockup|-test)+$/, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 80) {
    throw new AppError(400, 'Use 1–80 letters, numbers or single hyphens. Start and end with a letter or number.');
  }
  return `${name}-test-mockup`;
}
export function validSlug(slug) {
  return typeof slug === 'string' && slug.length <= 92 && /^[a-z0-9]+(?:-[a-z0-9]+)*-test-mockup$/.test(slug);
}
export function validateUpload(body) {
  const name = mockupName(body.name);
  if (typeof body.filename !== 'string' || !/\.html?$/i.test(body.filename)) throw new AppError(400, 'Choose an .html or .htm file.');
  if (typeof body.html !== 'string' || !body.html.trim()) throw new AppError(400, 'The HTML file is empty.');
  if (Buffer.byteLength(body.html, 'utf8') > MAX_HTML) throw new AppError(413, 'The HTML file must be 2 MB or smaller.');
  if (body.html.includes('\0')) throw new AppError(400, 'Use a UTF-8 HTML file, not a binary or UTF-16 file.');
  if (!/<(?:!doctype\s+html|html|head|body|div|main|section|h[1-6]|p|script|style)(?:\s|>)/i.test(body.html)) throw new AppError(400, 'The file does not appear to contain HTML.');
  return name;
}
export function signSession(secret, password, now = Date.now()) {
  const expires = String(now + 8 * 60 * 60 * 1000);
  return `${expires}.${createHmac('sha256', secret).update(`${expires}:${password}`).digest('hex')}`;
}
export function validSession(token, secret, password, now = Date.now()) {
  const [expires, signature] = String(token || '').split('.');
  if (!/^\d{13}$/.test(expires || '') || Number(expires) <= now || Number(expires) > now + 8 * 60 * 60 * 1000) return false;
  return equal(signature || '', createHmac('sha256', secret).update(`${expires}:${password}`).digest('hex'));
}
