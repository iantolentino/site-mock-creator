import { database, databaseUrl } from './database.mjs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { AppError, validSlug, validateUpload } from './core.mjs';

function localRoot() { return !process.env.VERCEL && process.env.LOCAL_STORAGE_DIR ? resolve(process.env.LOCAL_STORAGE_DIR) : null; }
export function storageReady() { return !!(localRoot() || databaseUrl()); }
export async function saveMockup(body) {
  const name = validateUpload(body);
  const root = localRoot();
  if (!root) return database().save(body);
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
    }
  } catch (error) {
    if (error.code === 'EEXIST') throw new AppError(409, 'That name is already used. Select “Update existing mockup” to replace its HTML, or choose another name.');
    throw error;
  }
  return { name, path: `/view/${name}`, size: Buffer.byteLength(body.html), updated: new Date().toISOString() };
}
export async function readMockup(slug) {
  if (!validSlug(slug)) throw new AppError(400, 'Invalid mockup name.');
  const root = localRoot();
  if (root) {
    try { return await readFile(join(root, `${slug}.html`), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  return database().read(slug);
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
    return { items: items.sort((a, b) => a.name.localeCompare(b.name)), next: null };
  }
  return database().list(cursor);
}
