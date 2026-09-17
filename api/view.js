import { readMockup, storageReady } from '../lib/storage.mjs';
export const VIEW_CSP = "sandbox allow-scripts allow-modals allow-downloads; default-src https: http: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src https: http:; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export default async function handler(req, res) {
  res.setHeader('Content-Security-Policy', VIEW_CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.end('Method not allowed'); return; }
    if (!storageReady()) { res.statusCode = 503; res.end('Mockup storage is not connected.'); return; }
    const url = new URL(req.url, 'http://localhost');
    const slug = url.pathname.startsWith('/view/') ? decodeURIComponent(url.pathname.slice(6)) : url.searchParams.get('slug');
    const html = await readMockup(slug);
    if (html === null) { res.statusCode = 404; res.end('Mockup not found. Check the link and try again.'); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(req.method === 'HEAD' ? undefined : html);
  } catch (error) {
    res.statusCode = error.status || 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(error.status === 400 ? 'Invalid mockup link.' : 'This mockup is temporarily unavailable. Try again later.');
  }
}
