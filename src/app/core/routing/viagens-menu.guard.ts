import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { catchError, map, of, timeout } from 'rxjs';
import { HeaderLink, slugFromHeaderRoute } from '../models/site-content.model';
import { SiteContentService } from '../services/site-content.service';

/** Espera máxima pelos menus do Firestore antes de decidir com o que há em cache. */
const HEADER_TIMEOUT_MS = 6000;

/**
 * Decide se `/viagens/<slug>` é a listagem de um menu do cabeçalho (cujo slug o
 * admin define em Conteúdo > Cabeçalho) ou o detalhe de uma viagem.
 *
 * Casa só quando `<slug>` é de um menu cadastrado; senão o roteador segue para
 * a rota seguinte, `viagens/:slug` (detalhe da viagem).
 *
 * Consulta os menus reais antes de decidir. Antes isto era um `UrlMatcher`
 * síncrono, que só conhecia os menus padrão e os salvos no localStorage: no
 * servidor (sem localStorage) e na 1ª visita de alguém, um menu criado pelo
 * admin caía como "viagem não encontrada". A leitura é uma só por sessão
 * (`loadHeader()` é memoizado), então as navegações seguintes resolvem na hora.
 */
export const viagensMenuGuard: CanMatchFn = (_route, segments) => {
  const slug = segments[segments.length - 1]?.path || '';
  if (!slug) return false;

  const siteContent = inject(SiteContentService);

  return siteContent.loadHeader().pipe(
    timeout({ first: HEADER_TIMEOUT_MS }),
    map(header => hasMenuSlug(header.links, slug)),
    // Firestore lento ou fora do ar: decide com os menus em cache/padrão.
    catchError(() => of(hasMenuSlug(siteContent.getCurrentHeaderLinks(), slug)))
  );
};

function hasMenuSlug(links: HeaderLink[], slug: string): boolean {
  return (links || []).some(link => slugFromHeaderRoute(link.route) === slug);
}
