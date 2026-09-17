import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import handler from '../api/publisher.js';
import viewer from '../api/view.js';
const publicRoot = new URL('../public/', import.meta.url);
const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']], ['/icon.svg', ['icon.svg', 'image/svg+xml']]]);
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/publisher') return handler(req, res);
  if (path.startsWith('/view/') || path === '/api/view') return viewer(req, res);
  const entry = files.get(path);
  if (!entry) { res.writeHead(404); res.end('Not found'); return; }
  try { res.setHeader('Content-Type', `${entry[1]}; charset=utf-8`); res.end(await readFile(fileURLToPath(new URL(entry[0], publicRoot)))); }
  catch { res.writeHead(500); res.end('Unable to read page'); }
}).listen(Number(process.env.PORT) || 3040, '127.0.0.1', () => console.log('Mockup Studio: http://127.0.0.1:3040'));
