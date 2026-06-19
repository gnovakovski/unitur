import { UrlMatcher, UrlSegment } from '@angular/router';
import { DEFAULT_HEADER_CONTENT, slugFromHeaderRoute } from '../models/site-content.model';
import { safeLocalStorageGet } from '../utils/browser';

const STORAGE_KEY = 'unitur_header_content';

/**
 * URL matcher para as listagens de viagens por menu, cujo slug é configurável
 * pelo admin em Conteúdo > Cabeçalho.
 *
 * Casa com `/viagens/<slug>` se `<slug>` pertencer a um menu cadastrado no
 * cabeçalho — assim renderiza a tela de listagem (ViagensComponent).
 *
 * Como TODO menu é forçado a ter rota `/viagens/<slug>` (ver
 * SiteContentService.ensureMenuRoute), qualquer menu existente sempre cai aqui
 * e nunca em "página não encontrada".
 *
 * Caso o slug não seja de um menu, o matcher não casa, deixando o roteador
 * seguir para `viagens/:slug` (detalhe do produto).
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

/**
 * Conjunto de slugs de menu conhecidos. Une os defaults (sempre disponíveis,
 * inclusive no SSR) com os menus salvos no localStorage — assim menus criados
 * ou renomeados pelo admin passam a casar mesmo sem rebuild.
 */
function readCategorySlugs(): Set<string> {
  const fromDefaults = DEFAULT_HEADER_CONTENT.links.map(link => slugFromHeaderRoute(link.route));
  try {
    // SSR-safe: no servidor devolve null e usamos apenas os defaults.
    const raw = safeLocalStorageGet(STORAGE_KEY);
    if (!raw) return new Set(fromDefaults.filter(Boolean));
    const parsed = JSON.parse(raw) as { links?: Array<{ route?: string }> };
    const fromStorage = (parsed.links || []).map(link => slugFromHeaderRoute(link?.route || ''));
    return new Set([...fromDefaults, ...fromStorage].filter(Boolean));
  } catch {
    return new Set(fromDefaults.filter(Boolean));
  }
}
