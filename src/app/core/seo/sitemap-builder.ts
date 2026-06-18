/**
 * Construtor puro do sitemap.xml. Recebe posts e trips (já lidos do Firebase)
 * e devolve o XML. Sem dependência de browser/Node — testável isoladamente.
 */

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: number;
}

export interface SitemapTrip {
  slug: string;
  scope?: 'nacional' | 'internacional';
  country?: string;
  destination?: string;
  status?: string;
  updatedAt?: string | Date;
}

export interface SitemapPost {
  slug: string;
  status?: string;
  updatedAt?: string | Date;
  publishedAt?: string | Date;
}

const BRAZIL_HINTS = ['brasil', 'brazil', 'aparecida', 'caraca', 'minas', 'sao paulo', 'rio '];

function isNacional(trip: SitemapTrip): boolean {
  if (trip.scope === 'nacional') return true;
  if (trip.scope === 'internacional') return false;
  const hay = `${trip.country || ''} ${trip.destination || ''}`.toLowerCase();
  return BRAZIL_HINTS.some(h => hay.includes(h));
}

function toIso(value?: string | Date): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Páginas estáticas indexáveis (paths com barra final, igual ao WordPress). */
export function staticEntries(): SitemapEntry[] {
  return [
    { loc: '/', changefreq: 'daily', priority: 1.0 },
    { loc: '/viagens/', changefreq: 'daily', priority: 0.9 },
    { loc: '/blog/', changefreq: 'daily', priority: 0.8 },
    { loc: '/sobre/sobre-a-unitur/', changefreq: 'monthly', priority: 0.5 },
    { loc: '/contato/', changefreq: 'monthly', priority: 0.5 }
  ];
}

export function buildSitemapXml(baseUrl: string, posts: SitemapPost[], trips: SitemapTrip[]): string {
  const base = baseUrl.replace(/\/$/, '');
  const entries: SitemapEntry[] = [...staticEntries()];

  for (const trip of trips) {
    if (!trip.slug || (trip.status && trip.status !== 'active')) continue;
    const dir = isNacional(trip) ? 'roteiros-nacionais' : 'roteiros-internacionais';
    entries.push({
      loc: `/${dir}/${trip.slug}/`,
      lastmod: toIso(trip.updatedAt),
      changefreq: 'weekly',
      priority: 0.8
    });
  }

  for (const post of posts) {
    if (!post.slug || (post.status && post.status !== 'published')) continue;
    entries.push({
      loc: `/blog/${post.slug}/`,
      lastmod: toIso(post.updatedAt || post.publishedAt),
      changefreq: 'monthly',
      priority: 0.7
    });
  }

  const urls = entries.map(e => {
    const parts = [`    <loc>${escapeXml(base + e.loc)}</loc>`];
    if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
    if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
    if (e.priority != null) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
    return `  <url>\n${parts.join('\n')}\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
