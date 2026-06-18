import { UrlMatcher, UrlSegment } from '@angular/router';
import { DEFAULT_HEADER_CONTENT } from '../models/site-content.model';
import { safeLocalStorageGet } from '../utils/browser';

const STORAGE_KEY = 'unitur_header_content';

/**
 * URL matcher para categorias de viagens cujo slug é configurável pelo admin.
 *
 * Casa com `/viagens/<slug>` se `<slug>` pertencer a um link cadastrado no
 * cabeçalho (header) — assim renderiza a tela de listagem (ViagensComponent).
 *
 * Caso contrário não casa, permitindo que o roteador siga para `viagens/:slug`
 * (rota de detalhe do produto).
 */
export const viagensCategoryMatcher: UrlMatcher = (segments: UrlSegment[]) => {
  if (segments.length !== 2) return null;
  if (segments[0].path !== 'viagens') return null;

  const slug = segments[1].path;
  const categorySlugs = readCategorySlugs();

  if (!categorySlugs.has(slug)) return null;

  return {
    consumed: segments,
    posParams: {
      slug: new UrlSegment(slug, {})
    }
  };
};

function readCategorySlugs(): Set<string> {
  const fromDefaults = DEFAULT_HEADER_CONTENT.links.map(link => slugFromRoute(link.route));
  try {
    // SSR-safe: no servidor devolve null e usamos apenas os defaults.
    const raw = safeLocalStorageGet(STORAGE_KEY);
    if (!raw) return new Set(fromDefaults);
    const parsed = JSON.parse(raw) as { links?: Array<{ route?: string }> };
    const fromStorage = (parsed.links || []).map(link => slugFromRoute(link?.route || ''));
    return new Set([...fromDefaults, ...fromStorage].filter(Boolean));
  } catch {
    return new Set(fromDefaults);
  }
}

function slugFromRoute(route: string): string {
  const trimmed = (route || '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmed) return '';
  const parts = trimmed.split('/');
  // Espera o formato "viagens/<slug>"; aceita também slug puro como fallback
  return parts.length >= 2 && parts[0] === 'viagens' ? parts[1] : parts[parts.length - 1];
}
