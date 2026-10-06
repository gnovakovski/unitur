#!/usr/bin/env node

/**
 * Padroniza a assinatura (campo `author`) dos posts do blog no Firestore.
 *
 * Simulação (padrão, nada é gravado):
 *   npm run blog:standardize-authors -- --author "Equipe Unitur"
 *
 * Mantendo algumas assinaturas individuais:
 *   npm run blog:standardize-authors -- --author "Equipe Unitur" --keep "Teresa Breda,Cibele Lana"
 *
 * Gravação (requer um access token OAuth com acesso ao projeto, como no import do WordPress):
 *   FIREBASE_ACCESS_TOKEN="..." npm run blog:standardize-authors -- --author "Equipe Unitur" --write
 *   FIREBASE_ACCESS_TOKEN_FILE="/caminho/token" npm run blog:standardize-authors -- --author "Equipe Unitur" --write
 *
 * O autor anterior fica salvo em `originalAuthor` (só na primeira padronização), o
 * que permite desfazer. Nenhum outro campo é alterado — nem `updatedAt`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_PROJECT = 'unitur-e7882';
const DATABASE = '(default)';
const WRITE_BATCH_SIZE = 20;

const args = parseArgs(process.argv.slice(2));
const project = String(args.project || DEFAULT_PROJECT);
const author = String(args.author || '').trim();
const keep = new Set(String(args.keep || '').split(',').map(name => name.trim().toLowerCase()).filter(Boolean));
const write = Boolean(args.write);

main().catch(error => {
  console.error(`\nFalha na padronização: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  if (!author) {
    throw new Error('Informe a assinatura padrão com --author "Equipe Unitur".');
  }

  console.log(`Projeto: ${project}`);
  console.log(`Assinatura padrão: ${author}`);
  if (keep.size) console.log(`Mantidas como estão: ${[...keep].join(', ')}`);
  console.log(`Modo: ${write ? 'GRAVAÇÃO' : 'SIMULAÇÃO (nenhuma escrita)'}\n`);

  const accessToken = await readAccessToken();
  const posts = await listPosts(accessToken || undefined);

  const changes = posts.filter(post => {
    const name = post.author?.name?.trim() || '';
    return name !== author && !keep.has(name.toLowerCase());
  });

  const summary = new Map();
  for (const post of changes) {
    const from = post.author?.name || '(sem autor)';
    summary.set(from, (summary.get(from) || 0) + 1);
  }

  console.log(`Posts lidos: ${posts.length}`);
  console.log(`Já com a assinatura correta ou mantidos: ${posts.length - changes.length}`);
  console.log(`A alterar: ${changes.length}`);
  for (const [from, count] of [...summary].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${from} → ${author}: ${count}`);
  }

  if (!write || !changes.length) {
    if (!write && changes.length) console.log('\nSimulação concluída. Rode novamente com --write para gravar.');
    return;
  }
  if (!accessToken) {
    throw new Error('FIREBASE_ACCESS_TOKEN não definido. Nenhum documento foi gravado.');
  }

  let written = 0;
  for (const batch of chunk(changes, WRITE_BATCH_SIZE)) {
    const writes = batch.map(post => {
      const fields = { author: encodeAuthor({ id: 1, name: author }) };
      const fieldPaths = ['author'];
      if (!post.originalAuthor && post.author) {
        fields.originalAuthor = encodeAuthor(post.author);
        fieldPaths.push('originalAuthor');
      }
      return {
        update: { name: post.documentName, fields },
        updateMask: { fieldPaths },
        currentDocument: { exists: true }
      };
    });

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/${encodeURIComponent(DATABASE)}/documents:batchWrite`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes })
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Firestore ${response.status}: ${payload.error?.message || response.statusText}`);
    }
    const failure = (payload.status || []).find(status => status.code && status.code !== 0);
    if (failure) throw new Error(`Firestore batchWrite: ${failure.message || `código ${failure.code}`}`);
    written += batch.length;
    console.log(`  gravados ${written}/${changes.length}`);
  }

  console.log('\nPadronização concluída.');
}

async function listPosts(accessToken) {
  const posts = [];
  let pageToken = '';
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/${encodeURIComponent(DATABASE)}/documents/posts`
    );
    url.searchParams.set('pageSize', '300');
    url.searchParams.append('mask.fieldPaths', 'author');
    url.searchParams.append('mask.fieldPaths', 'originalAuthor');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url, accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Firestore ${response.status}: ${payload.error?.message || response.statusText}`);
    }
    for (const document of payload.documents || []) {
      posts.push({
        documentName: document.name,
        author: decodeAuthor(document.fields?.author),
        originalAuthor: decodeAuthor(document.fields?.originalAuthor)
      });
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return posts;
}

function decodeAuthor(value) {
  const fields = value?.mapValue?.fields;
  if (!fields) return undefined;
  return {
    id: Number(fields.id?.integerValue ?? fields.id?.doubleValue ?? 1),
    name: String(fields.name?.stringValue || '')
  };
}

function encodeAuthor({ id, name }) {
  return {
    mapValue: {
      fields: {
        id: { integerValue: String(Math.trunc(Number(id) || 1)) },
        name: { stringValue: name }
      }
    }
  };
}

async function readAccessToken() {
  const directToken = process.env.FIREBASE_ACCESS_TOKEN?.trim();
  if (directToken) return directToken;

  const tokenFile = process.env.FIREBASE_ACCESS_TOKEN_FILE?.trim();
  if (!tokenFile) return '';
  return (await fs.readFile(path.resolve(tokenFile), 'utf8')).trim();
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) throw new Error(`Argumento desconhecido: ${item}`);
    const key = item.slice(2);
    if (key === 'write') {
      parsed[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Valor ausente para --${key}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}
