import { AppError, equal, signSession, validSession } from '../lib/core.mjs';
import { listMockups, saveMockup, storageReady } from '../lib/storage.mjs';

async function bodyOf(req) {
  if (req.body !== undefined) {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'Invalid request.');
    if (Buffer.byteLength(JSON.stringify(body)) > 3 * 1024 * 1024) throw new AppError(413, 'Upload is too large.');
    return body;
  }
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 3 * 1024 * 1024) throw new AppError(413, 'Upload is too large.');
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'Invalid request.');
  return body;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  try {
    const env = process.env;
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16 || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
      throw new AppError(503, 'Setup required: configure ADMIN_PASSWORD (16+ characters) and SESSION_SECRET (32+ characters) in your project environment settings.');
    }
    const host = req.headers.host;
    const url = new URL(req.url, `http://${host}`);
    const action = url.searchParams.get('action');
    if (!['GET', 'POST'].includes(req.method)) throw new AppError(405, 'Method not allowed.');
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      let parsedOrigin;
      try { parsedOrigin = new URL(origin); } catch { throw new AppError(403, 'Request origin was rejected.'); }
      if (!origin || parsedOrigin.host !== host || !['http:', 'https:'].includes(parsedOrigin.protocol) || (env.VERCEL && parsedOrigin.protocol !== 'https:')) throw new AppError(403, 'Request origin was rejected.');
      if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError(415, 'Send JSON requests.');
    }
    const cookie = String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('mp_session='))?.slice(11);
    const authed = validSession(cookie, env.SESSION_SECRET, env.ADMIN_PASSWORD);
    const cookieFlags = `Path=/; HttpOnly; SameSite=Strict${env.VERCEL ? '; Secure' : ''}`;
    if (action === 'session' && req.method === 'GET') return send(200, { authenticated: authed });
    if (action === 'login' && req.method === 'POST') {
      const body = await bodyOf(req);
      if (typeof body.password !== 'string' || !equal(body.password, env.ADMIN_PASSWORD)) {
        await new Promise(resolve => setTimeout(resolve, 800));
        throw new AppError(401, 'Incorrect password.');
      }
      res.setHeader('Set-Cookie', `mp_session=${signSession(env.SESSION_SECRET, env.ADMIN_PASSWORD)}; ${cookieFlags}; Max-Age=28800`);
      return send(200, { authenticated: true });
    }
    if (!authed) throw new AppError(401, 'Please sign in.');
    if (action === 'logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', `mp_session=; ${cookieFlags}; Max-Age=0`);
      return send(200, { ok: true });
    }
    if (!storageReady()) throw new AppError(503, 'Connect a private Vercel Blob store to this project, then redeploy. No Vercel deployment API token is needed.');
    if (action === 'publish' && req.method === 'POST') {
      const body = await bodyOf(req);
      return send(201, await saveMockup(body));
    }
    if (action === 'list' && req.method === 'GET') {
      const cursor = url.searchParams.get('cursor');
      if (cursor && cursor.length > 2048) throw new AppError(400, 'Invalid page.');
      return send(200, await listMockups(cursor));
    }
    throw new AppError(404, 'Unknown action.');
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error.status || 500;
    if (status === 500) console.error('Mockup storage operation failed:', error.name);
    send(status, { error: status === 500 ? 'Storage could not complete the request. Check the Blob connection and free usage limits, then try again.' : error instanceof SyntaxError ? 'Invalid JSON request.' : error.message });
  }
}
