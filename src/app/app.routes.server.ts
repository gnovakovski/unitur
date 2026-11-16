import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Como cada rota é entregue pelo servidor.
 *
 * - Páginas públicas: renderizadas no servidor a cada requisição
 *   (`RenderMode.Server`). O conteúdo vem do Firestore e muda quando o admin
 *   edita, então não há HTML fixo gerado no build; quem evita renderizar a
 *   mesma página toda hora é o cache da CDN (ver `src/server.ts`).
 * - Painel (/admin, /administrador): só no navegador (`RenderMode.Client`). São
 *   telas com login, que não devem ser indexadas. Na Vercel essas rotas nem
 *   chegam ao servidor: o `vercel.json` entrega o `client-shell.html` direto.
 *
 * O status 404 de endereços inexistentes é definido por quem descobre que a
 * página não existe (`NotFoundComponent`, viagem ou post não encontrados),
 * porque boa parte das rotas depende de consultar o Firestore.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'administrador', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server }
];
