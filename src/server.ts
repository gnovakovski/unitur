import { AngularAppEngine } from '@angular/ssr';
import { createNodeRequestHandler } from '@angular/ssr/node';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { environment } from './environments/environment';
import { installServerFetchCache, runWithFetchRecorder } from './app/core/ssr/fetch-cache.server';
import { DEGRADED_RENDER_HEADER } from './app/core/ssr/ssr-signals';

/**
 * Servidor de renderização (SSR) do site.
 *
 * Recebe o endereço pedido e devolve o HTML já pronto — título, descrição,
 * canonical e o texto da página — para o Google e para o visitante, sem
 * depender de JavaScript. É usado:
 *   - na Vercel, pela função `api/ssr.mjs`;
 *   - no `ng serve`, pelo `reqHandler` exportado no fim do arquivo;
 *   - no `npm run serve:ssr`, que simula a Vercel localmente.
 *
 * Quando a renderização não é possível (erro, Firestore fora do ar, tempo
 * esgotado), `renderPage` devolve `null` e quem chamou entrega o
 * `client-shell.html` — o site como SPA, que carrega tudo no navegador. O site
 * nunca sai do ar por causa do SSR.
 */

const SITE_ORIGIN = new URL(environment.siteUrl).origin;

/** Tempo máximo para montar uma página antes de cair para o SPA. */
const RENDER_TIMEOUT_MS = 20_000;

/**
 * Únicos parâmetros de URL que mudam o conteúdo da página (busca de viagens e
 * origem do "voltar" no blog). O resto (utm_*, gclid, fbclid...) é ignorado na
 * renderização: não muda o HTML.
 */
const APP_QUERY_PARAMS = ['destination', 'startDate', 'endDate', 'origin'];

/**
 * Caminhos que nunca são páginas do site: funções (/api/), pastas do WordPress
 * antigo — que robôs continuam sondando — e arquivos/pastas ocultos (/.env,
 * /.git/...).
 */
const NOT_A_PAGE = /^\/(?:api|wp-admin|wp-includes|wp-content|wp-json|cgi-bin|\.[^/]*)(?:\/|$)/i;

/**
 * Cache na CDN da Vercel (o navegador sempre revalida: `max-age=0`).
 * Uma alteração feita no painel aparece no site em até ~1 minuto; passado
 * esse tempo, a primeira visita ainda recebe a versão anterior na hora
 * enquanto a nova é gerada em segundo plano.
 */
const CACHE_PAGE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
const CACHE_NOT_FOUND = 'public, max-age=0, s-maxage=60';
const CACHE_REDIRECT = 'public, max-age=0, s-maxage=300';
const CACHE_MISSING_FILE = 'public, max-age=0, s-maxage=3600';
const CACHE_NONE = 'no-store';

const HTML = 'text/html; charset=utf-8';

export interface RenderedPage {
  status: number;
  headers: Record<string, string>;
  body: string;
}

// O Firebase lê o Firestore por `fetch`; esta versão guarda as respostas por
// alguns segundos e anota as usadas em cada página (ver fetch-cache.server.ts).
installServerFetchCache();

// O endereço entregue ao Angular é sempre montado aqui com o domínio oficial
// (nunca com cabeçalhos da requisição), então ele é o único host aceito.
const angularApp = new AngularAppEngine({
  allowedHosts: [new URL(SITE_ORIGIN).hostname]
});

/**
 * Renderiza a página de `rawUrl` (caminho + query, ex.: "/blog/post/?x=1").
 * Devolve `null` quando não foi possível renderizar no servidor.
 */
export async function renderPage(rawUrl: string): Promise<RenderedPage | null> {
  const target = parseTarget(rawUrl);
  if (!target) {
    return missingFile();
  }

  // Arquivo que não existe (imagem antiga, /wp-login.php), rota de API
  // inexistente ou sonda de robô (/wp-admin/, /.env): 404 direto, sem gastar
  // uma renderização.
  if (isFilePath(target.pathname) || NOT_A_PAGE.test(target.pathname)) {
    return missingFile();
  }

  const request = new Request(target, { method: 'GET', headers: { Accept: HTML } });
  const response = await withTimeout(
    runWithFetchRecorder(() => angularApp.handle(request)),
    'renderização'
  );

  // Sem resposta (rota desconhecida do Angular / erro de navegação) ou página
  // montada sem algum dado: quem chamou entrega o SPA.
  if (!response || response.headers.has(DEGRADED_RENDER_HEADER)) {
    return null;
  }

  const status = response.status;

  if (status >= 300 && status < 400) {
    return {
      status,
      headers: { 'Location': response.headers.get('Location') || '/', 'Cache-Control': CACHE_REDIRECT },
      body: ''
    };
  }

  // O Angular entrega o HTML por stream; lê tudo aqui para que um erro no meio
  // da serialização ainda possa cair para o SPA, em vez de mandar meia página.
  const body = await withTimeout(response.text(), 'serialização');

  if (isAdminPath(target.pathname)) {
    // Painel: é o SPA puro, sem cache e fora dos buscadores.
    return { status, headers: { 'Content-Type': HTML, 'Cache-Control': CACHE_NONE, 'X-Robots-Tag': 'noindex, nofollow' }, body };
  }

  return {
    status,
    headers: { 'Content-Type': HTML, 'Cache-Control': status === 200 ? CACHE_PAGE : CACHE_NOT_FOUND },
    body
  };
}

/**
 * Atende uma requisição Node (função da Vercel, `ng serve`, servidor local).
 * Devolve `false` se não respondeu — aí quem chamou entrega o `client-shell.html`.
 */
export async function handleNodeRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end();
    return true;
  }

  let page: RenderedPage | null = null;
  try {
    page = await renderPage(req.url || '/');
  } catch (error) {
    console.error(`[ssr] falha ao renderizar ${req.url}:`, error);
  }

  if (!page) return false;

  res.statusCode = page.status;
  for (const [name, value] of Object.entries(page.headers)) {
    res.setHeader(name, value);
  }
  res.end(method === 'HEAD' ? undefined : page.body);
  return true;
}

/** Endereço que o Angular vai renderizar: domínio oficial + caminho + parâmetros úteis. */
function parseTarget(rawUrl: string): URL | null {
  let parsed: URL;
  try {
    // Barras repetidas no início ("//site.com/x") seriam lidas como outro domínio.
    parsed = new URL(String(rawUrl || '/').replace(/^[/\\]+/, '/'), SITE_ORIGIN);
  } catch {
    return null;
  }

  const target = new URL(parsed.pathname, SITE_ORIGIN);
  for (const name of APP_QUERY_PARAMS) {
    const value = parsed.searchParams.get(name);
    if (value) target.searchParams.set(name, value);
  }
  return target;
}

/** Último trecho com extensão ("/x/foto.png", "/wp-login.php"): arquivo, não página. */
function isFilePath(pathname: string): boolean {
  return /\.[a-z0-9]{1,10}$/i.test(pathname.slice(pathname.lastIndexOf('/') + 1));
}

function isAdminPath(pathname: string): boolean {
  return /^\/(?:admin|administrador)(?:\/|$)/.test(pathname);
}

function missingFile(): RenderedPage {
  return {
    status: 404,
    headers: { 'Content-Type': HTML, 'Cache-Control': CACHE_MISSING_FILE, 'X-Robots-Tag': 'noindex' },
    body: '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>404 - Não encontrado</title></head>' +
      '<body><h1>404</h1><p>Arquivo não encontrado.</p><p><a href="/">Ir para a página inicial</a></p></body></html>'
  };
}

function withTimeout<T>(promise: Promise<T>, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Tempo esgotado na ${stage} (${RENDER_TIMEOUT_MS} ms).`)), RENDER_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Usado pelo Angular CLI (`ng serve`). Sem resposta do SSR, o CLI serve o SPA. */
export const reqHandler = createNodeRequestHandler(async (req, res, next) => {
  if (!(await handleNodeRequest(req, res))) {
    next();
  }
});
