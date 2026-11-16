#!/usr/bin/env node

/**
 * Sobe localmente o site já compilado, do jeito que a Vercel o entrega:
 *
 *   npm run build
 *   npm run serve:ssr            (http://localhost:4000)
 *   PORT=5000 npm run serve:ssr
 *
 * Reproduz as regras do vercel.json que importam para conferir a renderização
 * no servidor (SSR):
 *   1. arquivo estático de dist/angular-app/browser, se existir — inclusive um
 *      `index*.html` em "/", que a Vercel entrega como página inicial antes do
 *      SSR (por isso o pós-build renomeia o index.csr.html);
 *   2. /sitemap.xml            -> api/sitemap.js;
 *   3. /admin, /administrador  -> client-shell.html (painel, só no navegador);
 *   4. todo o resto            -> api/ssr.mjs (a mesma função usada na Vercel).
 *
 * Também força a barra final (trailingSlash: true). Os redirects 301 do
 * vercel.json NÃO são reproduzidos aqui: quem os aplica é a CDN da Vercel.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BROWSER_DIR = join(ROOT, 'dist', 'angular-app', 'browser');
const PORT = Number(process.env.PORT) || 4000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const { default: ssrHandler } = await import('../api/ssr.mjs');
const sitemapHandler = createRequire(import.meta.url)('../api/sitemap.js');

/** Caminho do arquivo estático correspondente, ou null se não existir. */
async function findStaticFile(pathname) {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '');
  const file = join(BROWSER_DIR, relative);
  if (!file.startsWith(BROWSER_DIR + sep)) return null; // fora da pasta pública
  try {
    return (await stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}

function sendFile(res, file, headers = {}) {
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  res.on('finish', () => {
    const render = res.getHeader('X-Unitur-Render') === 'client' ? ' (SPA: SSR indisponível)' : '';
    console.log(`${res.statusCode} ${req.method} ${req.url} ${Date.now() - started} ms${render}`);
  });

  try {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const { pathname, search } = url;

    // Igual à Vercel: um index*.html na raiz da pasta pública vira a home estática.
    const file = pathname === '/'
      ? (await findStaticFile('/index.html')) || (await findStaticFile('/index.csr.html'))
      : await findStaticFile(pathname);
    if (file && pathname === '/') {
      console.warn('Atenção: "/" saiu como arquivo estático, sem SSR. Rode `npm run build` (o pós-build renomeia o index.csr.html).');
    }
    if (file) return sendFile(res, file);

    // trailingSlash: true — páginas sempre com a barra final.
    if (!pathname.endsWith('/') && !extname(pathname)) {
      res.statusCode = 308;
      res.setHeader('Location', `${pathname}/${search}`);
      return res.end();
    }

    if (pathname === '/sitemap.xml') return sitemapHandler(req, res);

    if (/^\/(?:admin|administrador)(?:\/|$)/.test(pathname)) {
      return sendFile(res, join(BROWSER_DIR, 'client-shell.html'), { 'X-Robots-Tag': 'noindex, nofollow' });
    }

    return await ssrHandler(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.statusCode = 500;
    res.end('Erro no servidor local.');
  }
});

server.listen(PORT, () => {
  console.log(`Site (build de produção, com SSR) em http://localhost:${PORT}`);
});
