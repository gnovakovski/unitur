import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { environment } from './environments/environment';
import { buildSitemapXml, SitemapPost, SitemapTrip } from './app/core/seo/sitemap-builder';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const SITE_URL = environment.siteUrl || 'https://www.unitur.com.br';

/** Lê uma coleção do Firestore no servidor (reaproveita o app Firebase já criado). */
async function fetchCollection(name: string): Promise<Record<string, unknown>[]> {
  const fbApp = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
  const db = getFirestore(fbApp);
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => d.data() as Record<string, unknown>);
}

/**
 * Sitemap dinâmico: gerado a cada request lendo posts e trips do Firebase, com
 * os caminhos canônicos do WordPress antigo. Se o Firestore falhar, devolve ao
 * menos as páginas estáticas (nunca quebra o crawler).
 */
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const [trips, posts] = await Promise.all([
      fetchCollection('trips').catch(() => []),
      fetchCollection('posts').catch(() => []),
    ]);
    const xml = buildSitemapXml(SITE_URL, posts as unknown as SitemapPost[], trips as unknown as SitemapTrip[]);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(buildSitemapXml(SITE_URL, [], []));
  }
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
