/**
 * Sitemap dinâmico (Vercel Function) — servido em /sitemap.xml via rewrite no
 * vercel.json.
 *
 * O site é um SPA: posts e viagens existem só no Firestore, então um
 * sitemap.xml estático ficava com 5 URLs e o Google não recebia a lista dos
 * ~360 posts nem das viagens (o WordPress antigo publicava tudo via Yoast).
 *
 * Lê pela API REST pública do Firestore — a mesma leitura anônima que o site
 * faz no navegador — e fica em cache na CDN por 1 hora, então post ou viagem
 * nova entra no sitemap sem precisar de deploy.
 *
 * As regras de URL espelham o front: `/blog/<slug>/` e
 * `tripCanonicalPath()` de src/app/core/utils/trip-scope.ts. Se mudarem lá,
 * mudar aqui também.
 */

const PROJECT_ID = 'unitur-e7882';
const SITE_URL = 'https://www.unitur.com.br';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/viagens/', priority: '0.9', changefreq: 'daily' },
  { path: '/blog/', priority: '0.8', changefreq: 'daily' },
  { path: '/sobre/sobre-a-unitur/', priority: '0.5', changefreq: 'monthly' },
  { path: '/contato/', priority: '0.5', changefreq: 'monthly' },
];

/** Igual a BRAZIL_HINTS em src/app/core/utils/trip-scope.ts. */
const BRAZIL_HINTS = [
  'brasil', 'brazil',
  'acre', 'alagoas', 'amapa', 'amazonas', 'bahia', 'ceara', 'distrito federal',
  'espirito santo', 'goias', 'maranhao', 'mato grosso', 'minas gerais', 'para',
  'paraiba', 'parana', 'pernambuco', 'piaui', 'rio de janeiro', 'rio grande',
  'rondonia', 'roraima', 'santa catarina', 'sao paulo', 'sergipe', 'tocantins',
  'aparecida', 'caraca', 'canela', 'gramado',
];

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function tripScope(trip) {
  if (trip.scope === 'nacional' || trip.scope === 'internacional') return trip.scope;
  const haystack = `${normalize(trip.country)} ${normalize(trip.destination)}`;
  return BRAZIL_HINTS.some(hint => haystack.includes(hint)) ? 'nacional' : 'internacional';
}

function tripPath(trip) {
  const base = tripScope(trip) === 'nacional' ? 'roteiros-nacionais' : 'roteiros-internacionais';
  return `/${base}/${trip.slug}/`;
}

/** Converte um Value do Firestore REST em valor JS. */
function decode(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFields(fields) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) result[key] = decode(value);
  return result;
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Firestore HTTP ${response.status} em ${url}`);
  return response.json();
}

/** Lista a coleção inteira (só os campos pedidos), seguindo a paginação. */
async function listCollection(collection, fields) {
  const docs = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ pageSize: '300' });
    for (const field of fields) params.append('mask.fieldPaths', field);
    if (pageToken) params.set('pageToken', pageToken);
    const body = await fetchJson(`${FIRESTORE}/${collection}?${params}`);
    for (const doc of body.documents || []) docs.push(decodeFields(doc.fields || {}));
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return docs;
}

/** Rotas de listagem dos menus do cabeçalho (sempre /viagens/<slug>/ no site). */
async function menuPaths() {
  const body = await fetchJson(`${FIRESTORE}/siteContent/header`);
  const links = decodeFields(body.fields || {}).links || [];
  return links
    .filter(link => link && link.visible !== false && link.route)
    .map(link => String(link.route).replace(/^\/+|\/+$/g, '').split('/').pop())
    .filter(Boolean)
    .map(slug => `/viagens/${slug}/`);
}

function isoDate(...values) {
  const times = values.map(value => Date.parse(value)).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString().slice(0, 10) : undefined;
}

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function renderXml(entries) {
  const seen = new Set();
  const rows = [];
  for (const entry of entries) {
    const loc = SITE_URL + encodeURI(entry.path);
    if (seen.has(loc)) continue;
    seen.add(loc);
    rows.push(
      '  <url>\n' +
      `    <loc>${escapeXml(loc)}</loc>\n` +
      (entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>\n` : '') +
      (entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>\n` : '') +
      (entry.priority ? `    <priority>${entry.priority}</priority>\n` : '') +
      '  </url>'
    );
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rows.join('\n') + '\n</urlset>\n';
}

async function buildEntries() {
  const [posts, trips, menus] = await Promise.all([
    listCollection('posts', ['slug', 'status', 'publishedAt', 'updatedAt']),
    listCollection('trips', ['slug', 'status', 'scope', 'country', 'destination', 'updatedAt']),
    menuPaths().catch(() => []),
  ]);

  const tripEntries = trips
    .filter(trip => trip.slug && trip.status === 'active')
    .map(trip => ({ path: tripPath(trip), lastmod: isoDate(trip.updatedAt), changefreq: 'weekly', priority: '0.8' }));

  const postEntries = posts
    .filter(post => post.slug && (post.status || 'published') === 'published')
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .map(post => ({ path: `/blog/${post.slug}/`, lastmod: isoDate(post.publishedAt, post.updatedAt), changefreq: 'monthly', priority: '0.6' }));

  const menuEntries = menus.map(path => ({ path, changefreq: 'daily', priority: '0.9' }));

  return [...STATIC_PAGES, ...menuEntries, ...tripEntries, ...postEntries];
}

module.exports = async function handler(req, res) {
  let entries = STATIC_PAGES;
  let cache = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
  try {
    entries = await buildEntries();
  } catch (error) {
    // Sem Firestore, ainda devolve as páginas fixas — e com cache curto, para a
    // próxima leitura tentar de novo.
    console.error('[sitemap]', error);
    cache = 'public, max-age=0, s-maxage=60';
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(renderXml(entries));
};

module.exports.buildEntries = buildEntries;
module.exports.renderXml = renderXml;
