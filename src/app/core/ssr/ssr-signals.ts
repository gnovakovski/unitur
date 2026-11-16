/**
 * Sinais que o app (renderizando no servidor) manda para quem responde a
 * requisição (`src/server.ts`). Arquivo sem dependências, usado pelos dois lados.
 */

/**
 * Cabeçalho interno: a página foi montada sem algum dado do Firestore (erro ou
 * tempo esgotado). O servidor não deve entregar nem guardar em cache esse HTML
 * incompleto; em vez disso entrega a versão que carrega tudo no navegador.
 * Nunca chega ao visitante.
 */
export const DEGRADED_RENDER_HEADER = 'x-unitur-degraded';
