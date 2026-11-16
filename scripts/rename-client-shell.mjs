#!/usr/bin/env node

/**
 * Pós-build (roda no `npm run build`, inclusive na Vercel via vercel.json).
 *
 * Renomeia dist/angular-app/browser/index.csr.html para client-shell.html.
 *
 * Por quê: a Vercel trata qualquer `index*.html` na raiz da pasta pública como a
 * página inicial estática e o entrega em "/" ANTES das regras de reescrita do
 * vercel.json. Com o nome padrão do Angular, a home saía como o SPA vazio (sem
 * título, descrição, canonical nem texto) em vez de passar pelo SSR em
 * api/ssr.mjs — só a home; as outras páginas não eram afetadas.
 *
 * O servidor do Angular não usa este arquivo: ele carrega a própria cópia,
 * embutida no build do servidor (dist/angular-app/server/assets-chunks). Quem
 * usa o client-shell.html é o painel (/admin, via vercel.json) e o plano B do
 * api/ssr.mjs.
 */

import { rename, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BROWSER_DIR = new URL('../dist/angular-app/browser/', import.meta.url);
const from = new URL('index.csr.html', BROWSER_DIR);
const to = new URL('client-shell.html', BROWSER_DIR);

async function exists(url) {
  try {
    return (await stat(url)).isFile();
  } catch {
    return false;
  }
}

if (await exists(from)) {
  await rename(from, to);
  console.log(`client shell: ${fileURLToPath(from)} -> client-shell.html`);
} else if (await exists(to)) {
  console.log('client shell: client-shell.html já existe (build anterior).');
} else {
  console.error('client shell: index.csr.html não encontrado. O `ng build` terminou?');
  process.exit(1);
}
