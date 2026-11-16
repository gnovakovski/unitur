/**
 * Função da Vercel que entrega as páginas públicas já renderizadas (SSR).
 *
 * O `vercel.json` manda para cá todo endereço que não é arquivo estático, nem
 * painel (/admin, /administrador), nem /sitemap.xml. A renderização em si está
 * em `src/server.ts`, compilado pelo `ng build` para
 * `dist/angular-app/server/server.mjs`; este arquivo só o carrega e cuida do
 * plano B.
 *
 * Plano B: se o servidor não conseguir montar a página (erro no build do SSR,
 * Firestore fora do ar, tempo esgotado), entrega o `client-shell.html` — o site
 * como SPA, que carrega tudo no navegador, exatamente como funcionava antes do
 * SSR. O visitante nunca vê uma página de erro por causa da renderização.
 *
 * `client-shell.html` é o `index.csr.html` do Angular renomeado no pós-build
 * (scripts/rename-client-shell.mjs): com o nome original, a Vercel o entregava
 * em "/" como arquivo estático e a home não passava por aqui.
 */
import { readFile } from 'node:fs/promises';

const CLIENT_SHELL = new URL('../dist/angular-app/browser/client-shell.html', import.meta.url);

/** Módulo do servidor, carregado uma vez por instância da função. */
let serverModule;
/** HTML do SPA, lido do disco uma vez por instância. */
let clientShell;

function loadServer() {
  // Caminho literal: é assim que a Vercel descobre que este arquivo (e o que ele
  // importa) precisa ir junto com a função. Ver também `functions` no vercel.json.
  serverModule ??= import('../dist/angular-app/server/server.mjs').catch(error => {
    serverModule = undefined; // tenta de novo na próxima requisição
    throw error;
  });
  return serverModule;
}

async function sendClientShell(res, method) {
  clientShell ??= readFile(CLIENT_SHELL, 'utf8').catch(error => {
    clientShell = undefined;
    throw error;
  });
  const html = await clientShell;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Sem cache: é uma resposta de contingência, a próxima visita tenta o SSR de novo.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Unitur-Render', 'client');
  res.end(method === 'HEAD' ? undefined : html);
}

export default async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase();

  try {
    const { handleNodeRequest } = await loadServer();
    if (await handleNodeRequest(req, res)) return;
  } catch (error) {
    console.error(`[ssr] falha ao renderizar ${req.url}:`, error);
  }

  // O servidor pode ter falhado depois de começar a responder; aí não há o que trocar.
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }

  try {
    await sendClientShell(res, method);
  } catch (error) {
    console.error('[ssr] falha ao ler o client-shell.html:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end('Erro interno. Tente novamente em instantes.');
  }
}
