import { neon } from '@neondatabase/serverless';
import { AppError, validSlug, validateUpload } from './core.mjs';

export function databaseUrl(env = process.env) {
  return env.DATABASE_URL || env.POSTGRES_URL || env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || '';
}
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS public.mockup_studio_pages (
  slug TEXT PRIMARY KEY,
  html TEXT NOT NULL CHECK (octet_length(html) <= 2097152),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
function summary(row) {
  return { name: row.slug, path: `/view/${row.slug}`, size: Number(row.size), updated: new Date(row.updated_at).toISOString() };
}
export function createDatabaseStorage(sql) {
  let initialization;
  async function ready() {
    // One initialization per warm instance; the transaction lock coordinates cold instances.
    initialization ??= sql.transaction(tx => [
      tx.query('SELECT pg_advisory_xact_lock(1836274910)'),
      tx.query(CREATE_TABLE)
    ]).catch(error => { initialization = undefined; throw error; });
    await initialization;
  }
  return {
    async save(body) {
      const slug = validateUpload(body);
      await ready();
      try {
        const rows = body.replace === true
          ? await sql.query(`INSERT INTO public.mockup_studio_pages (slug, html) VALUES ($1, $2)
              ON CONFLICT (slug) DO UPDATE SET html = EXCLUDED.html, updated_at = now()
              RETURNING slug, octet_length(html) AS size, updated_at`, [slug, body.html])
          : await sql.query(`INSERT INTO public.mockup_studio_pages (slug, html) VALUES ($1, $2)
              RETURNING slug, octet_length(html) AS size, updated_at`, [slug, body.html]);
        return summary(rows[0]);
      } catch (error) {
        if (error.code === '23505') throw new AppError(409, 'That name is already used. Select “Update existing mockup” to replace its HTML, or choose another name.');
        throw error;
      }
    },
    async read(slug) {
      if (!validSlug(slug)) throw new AppError(400, 'Invalid mockup name.');
      await ready();
      const rows = await sql.query('SELECT html FROM public.mockup_studio_pages WHERE slug = $1', [slug]);
      return rows[0]?.html ?? null;
    },
    async list(cursor) {
      if (cursor && !validSlug(cursor)) throw new AppError(400, 'Invalid page.');
      await ready();
      const rows = await sql.query(`SELECT slug, octet_length(html) AS size, updated_at
        FROM public.mockup_studio_pages WHERE slug > $1 ORDER BY slug ASC LIMIT 101`, [cursor || '']);
      const items = rows.slice(0, 100).map(summary);
      return { items, next: rows.length > 100 ? items.at(-1).name : null };
    }
  };
}
let activeUrl, activeStorage;
export function database() {
  const url = databaseUrl();
  if (!url) throw new AppError(503, 'Connect Neon to this Vercel project with the default DATABASE_URL variable, then redeploy.');
  if (url !== activeUrl) {
    activeStorage = createDatabaseStorage(neon(url));
    activeUrl = url;
  }
  return activeStorage;
}
