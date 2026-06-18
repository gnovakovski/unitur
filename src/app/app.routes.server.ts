import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Estratégia de renderização por rota.
 *
 * - Páginas públicas → SSR on-demand (RenderMode.Server). O conteúdo vem do
 *   Firebase e muda quando o admin edita, então NÃO usamos prerender estático:
 *   o HTML é gerado a cada request, sempre com as meta tags/JSON-LD corretos
 *   para o crawler. Não há lista finita de slugs para prerenderar no build.
 * - Área administrativa (/admin, /administrador) → RenderMode.Client. São telas
 *   autenticadas, não indexáveis e dependentes de browser (localStorage/auth);
 *   não faz sentido renderizá-las no servidor.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: 'administrador',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
