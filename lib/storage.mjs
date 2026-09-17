import { get, list, put, BlobNotFoundError } from '@vercel/blob';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { AppError, validSlug, validateUpload } from './core.mjs';

const PREFIX = 'mockup-studio/';
function localRoot() { return !process.env.VERCEL && process.env.LOCAL_STORAGE_DIR ? resolve(process.env.LOCAL_STORAGE_DIR) : null; }
function blobOptions() { return process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}; }
export function storageReady() { return !!(localRoot() || process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)); }
function pathFor(slug) {
  if (!validSlug(slug)) throw new AppError(400, 'Invalid mockup name.');
  return `${PREFIX}${slug}.html`;
}
export async function saveMockup(body) {
  const name = validateUpload(body);
  const pathname = pathFor(name);
  const root = localRoot();
  try {
    if (root) {
      await mkdir(root, { recursive: true });
      const target = join(root, `${name}.html`);
      if (body.replace !== true) await writeFile(target, body.html, { flag: 'wx', encoding: 'utf8' });
      else {
        const temp = join(root, `${randomUUID()}.tmp`);
        await writeFile(temp, body.html, 'utf8');
        await rename(temp, target);
      }
    } else {
      await put(pathname, body.html, {
        ...blobOptions(), access: 'private', addRandomSuffix: false, allowOverwrite: body.replace === true,
        contentType: 'text/html; charset=utf-8', cacheControlMaxAge: 60
      });
    }
  } catch (error) {
    if (error.code === 'EEXIST' || /already exists|allowOverwrite/i.test(error.message)) throw new AppError(409, 'That name is already used. Select “Update existing mockup” to replace its HTML, or choose another name.');
    throw error;
  }
  return { name, path: `/view/${name}`, size: Buffer.byteLength(body.html), updated: new Date().toISOString() };
}
export async function readMockup(slug) {
  const pathname = pathFor(slug);
  const root = localRoot();
  if (root) {
    try { return await readFile(join(root, `${slug}.html`), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  try {
    const result = await get(pathname, { ...blobOptions(), access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return await new Response(result.stream).text();
  } catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
}
export async function listMockups(cursor) {
  const root = localRoot();
  if (root) {
    await mkdir(root, { recursive: true });
    const filenames = (await readdir(root)).filter(file => file.endsWith('.html') && validSlug(file.slice(0, -5)));
    const items = await Promise.all(filenames.map(async file => {
      const details = await stat(join(root, file)), name = file.slice(0, -5);
      return { name, path: `/view/${name}`, size: details.size, updated: details.mtime.toISOString() };
    }));
    return { items: items.sort((a, b) => b.updated.localeCompare(a.updated)), next: null };
  }
  const result = await list({ ...blobOptions(), prefix: PREFIX, limit: 100, ...(cursor ? { cursor } : {}) });
  return {
    items: result.blobs.filter(blob => validSlug(blob.pathname.slice(PREFIX.length, -5)) && blob.pathname.endsWith('.html')).map(blob => {
      const name = blob.pathname.slice(PREFIX.length, -5);
      return { name, path: `/view/${name}`, size: blob.size, updated: blob.uploadedAt.toISOString() };
    }).sort((a, b) => b.updated.localeCompare(a.updated)), next: result.hasMore ? result.cursor : null
  };
}
