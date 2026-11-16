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
 * O que entra:
 *   - páginas fixas (home, /viagens/, /blog/, sobre, contato);
 *   - listagens dos menus do cabeçalho (/viagens/<slug>/);
 *   - cada viagem publicada, no endereço canônico (/roteiros-.../<slug>/);
 *   - cada categoria do blog que tem post publicado (/blog/categoria/<slug>/);
 *   - cada post publicado (/blog/<slug>/).
 * Cada página leva as suas imagens (capa, galeria, hotéis, fotos do post) e os
 * vídeos do YouTube/Vimeo incorporados nos posts, para o Google Imagens e Vídeos.
 *
 * Só entram endereços que respondem 200 e são o canonical da própria página.
 * As regras de URL espelham o front: `/blog/<slug>/`, `/blog/categoria/<slug>/`
 * e `tripCanonicalPath()` de src/app/core/utils/trip-scope.ts. Se mudarem lá,
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

async function fetchJson(url, timeoutMs = 10000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
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
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function decodeHtml(value) {
  return String(value || '').replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Math.min(Number(code), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Math.min(parseInt(code, 16), 0x10ffff)))
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function absoluteMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(decodeHtml(value).trim(), SITE_URL);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function imageUrls(values) {
  return [...new Set(values.flat().map(absoluteMediaUrl).filter(Boolean))].slice(0, 1000);
}

function contentImages(html) {
  return Array.from(String(html || '').matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi), match => match[1]);
}

/** Mesmo conjunto de players aceito em post-content.ts; nenhum URL arbitrário
 * do HTML é usado para requisições no servidor. */
function embeddedPlayers(html) {
  const players = [];
  for (const match of String(html || '').matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const src = absoluteMediaUrl(match[1]);
    if (!src) continue;
    const url = new URL(src);
    const host = url.hostname.replace(/^www\./, '');
    const youtubeId = /^\/embed\/([\w-]{6,20})\/?$/.exec(url.pathname)?.[1];
    const vimeoId = /^\/video\/(\d{4,12})\/?$/.exec(url.pathname)?.[1];
    if (['youtube.com', 'youtube-nocookie.com'].includes(host) && youtubeId) {
      players.push({ player: `https://www.youtube.com/embed/${youtubeId}`, oembed: `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}&format=json` });
    } else if (host === 'player.vimeo.com' && vimeoId) {
      players.push({ player: `https://player.vimeo.com/video/${vimeoId}`, oembed: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${vimeoId}`)}` });
    }
  }
  return [...new Map(players.map(player => [player.player, player])).values()];
}

/** Metadados reais do provedor; falhas de vídeo não impedem o sitemap de páginas.
 * Quatro workers limitam as consultas; orçamento total de 4s por geração. */
async function attachVideos(posts, entries) {
  const jobs = posts.flatMap((post, index) => embeddedPlayers(post.content).map(player => ({ player, index, excerpt: post.excerpt })));
  const deadline = Date.now() + 4000;
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length && Date.now() < deadline) {
      const job = jobs[cursor++];
      try {
        const meta = await fetchJson(job.player.oembed, Math.max(1, Math.min(2000, deadline - Date.now())));
        const thumbnail = absoluteMediaUrl(meta.thumbnail_url);
        const title = String(meta.title || '').trim();
        if (!thumbnail || !title) continue;
        const description = decodeHtml(String(job.excerpt || '').replace(/<[^>]*>/g, '')).trim() || title;
        (entries[job.index].videos ||= []).push({ thumbnail, title: title.slice(0, 100), description: description.slice(0, 2048), player: job.player.player });
      } catch { /* Player privado/removido ou provedor indisponível: omite o vídeo. */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, () => worker()));
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
      imageUrls(entry.images || []).map(url => `    <image:image><image:loc>${escapeXml(url)}</image:loc></image:image>\n`).join('') +
      (entry.videos || []).map(video =>
        '    <video:video>\n' +
        `      <video:thumbnail_loc>${escapeXml(video.thumbnail)}</video:thumbnail_loc>\n` +
        `      <video:title>${escapeXml(video.title)}</video:title>\n` +
        `      <video:description>${escapeXml(video.description)}</video:description>\n` +
        `      <video:player_loc>${escapeXml(video.player)}</video:player_loc>\n` +
        '    </video:video>\n'
      ).join('') +
      '  </url>'
    );
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n' +
    rows.join('\n') + '\n</urlset>\n';
}

async function buildEntries() {
  const [posts, trips, menus, banners, about, categories] = await Promise.all([
    listCollection('posts', ['slug', 'status', 'categoryId', 'publishedAt', 'updatedAt', 'featuredImage', 'contentImages', 'content', 'excerpt']),
    listCollection('trips', ['slug', 'status', 'scope', 'country', 'destination', 'updatedAt', 'mainImage', 'experienceImages', 'gallery', 'hotels']),
    menuPaths().catch(() => []),
    listCollection('banners', ['status', 'imageUrl', 'imageUrlMobile']).catch(() => []),
    fetchJson(`${FIRESTORE}/siteContent/about`).then(doc => decodeFields(doc.fields || {})).catch(() => ({})),
    // Sem as categorias o sitemap ainda sai completo no resto.
    listCollection('categories', ['id', 'slug', 'type']).catch(() => []),
  ]);

  // Igual ao site: viagem sem status é tratada como ativa (TripService.applyClientFilters).
  const tripEntries = trips
    .filter(trip => trip.slug && (trip.status || 'active') === 'active')
    .map(trip => ({ path: tripPath(trip), lastmod: isoDate(trip.updatedAt), changefreq: 'weekly', priority: '0.8',
      images: imageUrls([trip.mainImage, ...(trip.experienceImages || trip.gallery || []), ...(trip.hotels || []).map(hotel => hotel.image)]) }));

  const publishedPosts = posts
    .filter(post => post.slug && (post.status || 'published') === 'published')
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
  const postEntries = publishedPosts.map(post => ({ path: `/blog/${post.slug}/`, lastmod: isoDate(post.publishedAt, post.updatedAt), changefreq: 'monthly', priority: '0.6',
    images: imageUrls([post.featuredImage, ...(post.contentImages || []), ...contentImages(post.content)]) }));
  await attachVideos(publishedPosts, postEntries);

  // Categorias do blog com ao menos um post publicado (as vazias mostram uma
  // listagem sem conteúdo). `lastmod` = post mais recente da categoria.
  const latestByCategory = new Map();
  for (const post of publishedPosts) {
    const id = Number(post.categoryId);
    if (!id) continue;
    const when = isoDate(post.publishedAt, post.updatedAt);
    if (!latestByCategory.has(id) || (when && when > (latestByCategory.get(id) || ''))) {
      latestByCategory.set(id, when);
    }
  }
  const categoryEntries = categories
    .filter(category => category.slug && (category.type === 'blog' || category.type === 'both'))
    .filter(category => latestByCategory.has(Number(category.id)))
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)))
    .map(category => ({
      path: `/blog/categoria/${category.slug}/`,
      lastmod: latestByCategory.get(Number(category.id)),
      changefreq: 'weekly',
      priority: '0.5',
    }));

  const menuEntries = menus.map(path => ({ path, changefreq: 'daily', priority: '0.9' }));

  const staticEntries = STATIC_PAGES.map(entry => ({ ...entry }));
  staticEntries[0].images = imageUrls([
    ...banners.filter(banner => banner.status === 'active').flatMap(banner => [banner.imageUrl, banner.imageUrlMobile]),
    about.home?.imageUrl
  ]);
  staticEntries.find(entry => entry.path === '/sobre/sobre-a-unitur/').images = imageUrls([about.about?.storyImageUrl]);
  return [...staticEntries, ...menuEntries, ...tripEntries, ...categoryEntries, ...postEntries];
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
