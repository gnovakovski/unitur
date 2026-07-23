#!/usr/bin/env node

/**
 * Migra exclusivamente os posts públicos do blog WordPress para o Firestore.
 *
 * Dry-run (padrão):
 *   npm run import:wordpress-blog
 *
 * Gravação (requer um access token OAuth com acesso ao projeto):
 *   FIREBASE_ACCESS_TOKEN="..." npm run import:wordpress-blog -- --write
 *   FIREBASE_ACCESS_TOKEN_FILE="/caminho/token" npm run import:wordpress-blog -- --write
 *
 * Para validar usando respostas já baixadas:
 *   npm run import:wordpress-blog -- --input-dir /tmp
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SOURCE = 'https://www.unitur.com.br';
const DEFAULT_PROJECT = 'unitur-e7882';
const DATABASE = '(default)';
const PAGE_SIZE = 100;
const WRITE_BATCH_SIZE = 20;

const args = parseArgs(process.argv.slice(2));
const source = String(args.source || DEFAULT_SOURCE).replace(/\/$/, '');
const project = String(args.project || DEFAULT_PROJECT);
const write = Boolean(args.write);
const overwrite = Boolean(args.overwrite);
const limit = args.limit ? positiveInteger(args.limit, '--limit') : undefined;
const inputDir = args['input-dir'] ? path.resolve(String(args['input-dir'])) : undefined;

main().catch(error => {
  console.error(`\nFalha na migração: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  console.log(`Origem: ${source}/wp-json/wp/v2/posts`);
  console.log(`Destino: Firestore ${project}/posts`);
  console.log(`Modo: ${write ? 'GRAVAÇÃO' : 'SIMULAÇÃO (nenhuma escrita)'}`);

  const [wordpressPosts, wordpressCategories, existingPosts, existingCategories] = await Promise.all([
    loadWordpressPosts(),
    loadWordpressCategories(),
    listFirestoreDocuments('posts'),
    listFirestoreDocuments('categories')
  ]);

  const publishedPosts = wordpressPosts.filter(post => post?.type === 'post' && post?.status === 'publish');
  const selectedPosts = limit ? publishedPosts.slice(0, limit) : publishedPosts;
  const categoryById = new Map(wordpressCategories.map(category => [Number(category.id), category]));
  const mappedPosts = selectedPosts.map(post => mapPost(post, categoryById));
  const categoriesToMap = uniqueBy(
    mappedPosts.map(post => post.category).filter(Boolean),
    category => Number(category.id)
  );

  assertMigration(mappedPosts);

  const existingPostIds = new Set(existingPosts.map(document => document.id));
  const existingCategoryIds = new Set(existingCategories.map(document => document.id));
  const pendingPosts = overwrite ? mappedPosts : mappedPosts.filter(post => !existingPostIds.has(String(post.id)));
  const pendingCategories = overwrite
    ? categoriesToMap
    : categoriesToMap.filter(category => !existingCategoryIds.has(String(category.id)));

  const summary = {
    wordpressPublishedPosts: publishedPosts.length,
    selectedPosts: mappedPosts.length,
    existingFirestorePosts: existingPosts.length,
    postsToCreate: pendingPosts.length,
    postsSkippedAsExisting: mappedPosts.length - pendingPosts.length,
    supportingBlogCategoriesToCreate: pendingCategories.length,
    postsWithoutOriginalFeaturedImage: selectedPosts.filter(post => !post.featured_media).length,
    postsUsingFirstContentImageAsFallback: mappedPosts.filter(post => post.imageSource === 'content').length
  };

  console.log('\nResumo:');
  console.table(summary);
  printSamples(mappedPosts);

  if (!write) {
    console.log('\nDry-run concluído. Use --write somente após conferir este resumo.');
    return;
  }

  const accessToken = await readAccessToken();
  if (!accessToken) {
    throw new Error('FIREBASE_ACCESS_TOKEN não definido. Nenhum documento foi gravado.');
  }

  console.log('\nGravando categorias de suporte do blog...');
  await writeDocuments('categories', pendingCategories.map(cleanCategory), accessToken, overwrite);

  console.log('Gravando posts do blog...');
  await writeDocuments('posts', pendingPosts.map(cleanPost), accessToken, overwrite);

  const [verifiedPosts, verifiedCategories] = await Promise.all([
    listFirestoreDocuments('posts', accessToken),
    listFirestoreDocuments('categories', accessToken)
  ]);
  const verifiedPostIds = new Set(verifiedPosts.map(document => document.id));
  const missing = mappedPosts.filter(post => !verifiedPostIds.has(String(post.id)));

  if (missing.length) {
    throw new Error(`${missing.length} posts não foram encontrados na verificação final.`);
  }

  console.log('\nMigração concluída e verificada.');
  console.table({
    firestorePostsAfterImport: verifiedPosts.length,
    firestoreCategoriesAfterImport: verifiedCategories.length,
    migratedPostsVerified: mappedPosts.length,
    missingPosts: missing.length
  });
}

async function readAccessToken() {
  const directToken = process.env.FIREBASE_ACCESS_TOKEN?.trim();
  if (directToken) return directToken;

  const tokenFile = process.env.FIREBASE_ACCESS_TOKEN_FILE?.trim();
  if (!tokenFile) return '';
  return (await fs.readFile(path.resolve(tokenFile), 'utf8')).trim();
}

async function loadWordpressPosts() {
  if (inputDir) {
    const pages = [];
    for (let page = 1; ; page += 1) {
      const file = path.join(inputDir, `unitur-wp-posts-${page}.json`);
      try {
        const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!Array.isArray(parsed)) throw new Error(`${file} não contém uma lista.`);
        pages.push(...parsed);
        if (parsed.length < PAGE_SIZE) break;
      } catch (error) {
        if (error.code === 'ENOENT' && page > 1) break;
        throw error;
      }
    }
    return pages;
  }

  const first = await fetchJsonWithHeaders(
    `${source}/wp-json/wp/v2/posts?per_page=${PAGE_SIZE}&page=1&_embed=1`
  );
  const totalPages = Number(first.headers.get('x-wp-totalpages') || 1);
  const posts = [...first.data];

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetchJsonWithHeaders(
      `${source}/wp-json/wp/v2/posts?per_page=${PAGE_SIZE}&page=${page}&_embed=1`
    );
    posts.push(...response.data);
    console.log(`WordPress: página ${page}/${totalPages} lida.`);
  }
  return posts;
}

async function loadWordpressCategories() {
  if (inputDir) {
    const file = path.join(inputDir, 'unitur-wp-categories.json');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  }

  return fetchJson(
    `${source}/wp-json/wp/v2/categories?per_page=100&_fields=id,name,slug,parent,count,description`
  );
}

function mapPost(post, categoryById) {
  const embeddedTerms = (post._embedded?.['wp:term'] || []).flat();
  const categories = embeddedTerms
    .filter(term => term.taxonomy === 'category')
    .map(term => categoryById.get(Number(term.id)) || term);
  const tags = embeddedTerms
    .filter(term => term.taxonomy === 'post_tag')
    .map(term => decodeHtml(term.name))
    .filter(Boolean);
  const category = selectPrimaryCategory(categories, categoryById);
  const content = String(post.content?.rendered || '').trim();
  const originalFeaturedImage = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
  const firstContentImage = extractImageUrls(content)[0] || '';
  const featuredImage = originalFeaturedImage || firstContentImage || '';
  const excerpt = truncate(
    decodeHtml(stripHtml(String(post.excerpt?.rendered || '')))
      .replace(/\[\s*…\s*\]|\[\s*\.\.\.\s*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
    200
  );
  const title = decodeHtml(stripHtml(String(post.title?.rendered || ''))).trim();
  const authorName = decodeHtml(post._embedded?.author?.[0]?.name || 'Unitur');

  return {
    id: Number(post.id),
    title,
    slug: String(post.slug || slugify(title)),
    content,
    excerpt,
    featuredImage,
    contentImages: [],
    categoryId: Number(category.id),
    category: cleanCategory(category),
    tags: [...new Set(tags)],
    relatedTrips: [],
    status: 'published',
    metaTitle: truncate(title, 70),
    metaDescription: truncate(excerpt, 160),
    ogImage: featuredImage,
    sourceId: Number(post.id),
    sourceUrl: String(post.link || ''),
    sourceCategoryIds: categories.map(item => Number(item.id)),
    sourceCategories: categories.map(item => decodeHtml(item.name)),
    publishedAt: new Date(`${post.date_gmt || post.date}Z`),
    createdAt: new Date(`${post.date_gmt || post.date}Z`),
    updatedAt: new Date(`${post.modified_gmt || post.modified || post.date_gmt || post.date}Z`),
    author: { id: Number(post.author || 1), name: authorName || 'Unitur' },
    imageSource: originalFeaturedImage ? 'featured' : firstContentImage ? 'content' : 'none'
  };
}

function selectPrimaryCategory(categories, categoryById) {
  if (!categories.length) {
    return { id: 1, name: 'Sem categoria', slug: 'sem-categoria', parent: 0 };
  }

  const generic = new Set(['blog', 'geral', 'roteiros-internacionais', 'roteiros-nacionais']);
  return [...categories].sort((a, b) => {
    const aGeneric = generic.has(a.slug) ? 1 : 0;
    const bGeneric = generic.has(b.slug) ? 1 : 0;
    if (aGeneric !== bGeneric) return aGeneric - bGeneric;

    const depthDiff = categoryDepth(b, categoryById) - categoryDepth(a, categoryById);
    if (depthDiff) return depthDiff;

    const countDiff = Number(a.count ?? Number.MAX_SAFE_INTEGER) - Number(b.count ?? Number.MAX_SAFE_INTEGER);
    if (countDiff) return countDiff;
    return Number(a.id) - Number(b.id);
  })[0];
}

function categoryDepth(category, categoryById) {
  let depth = 0;
  let parent = Number(category.parent || 0);
  const seen = new Set();
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    depth += 1;
    parent = Number(categoryById.get(parent)?.parent || 0);
  }
  return depth;
}

function cleanCategory(category) {
  const now = new Date();
  return {
    id: Number(category.id),
    name: decodeHtml(category.name || 'Sem categoria'),
    slug: String(category.slug || slugify(category.name || 'Sem categoria')),
    description: decodeHtml(stripHtml(category.description || '')),
    type: 'blog',
    createdAt: category.createdAt || now,
    updatedAt: category.updatedAt || now
  };
}

function cleanPost(post) {
  const { imageSource, ...document } = post;
  return document;
}

function assertMigration(posts) {
  if (!posts.length) throw new Error('Nenhum post publicado foi encontrado.');
  const ids = new Set();
  const slugs = new Set();

  for (const post of posts) {
    if (!Number.isInteger(post.id) || post.id <= 0) throw new Error(`ID inválido: ${post.id}`);
    if (!post.title || !post.slug || !post.content) throw new Error(`Post ${post.id} possui campos obrigatórios vazios.`);
    if (!Number.isInteger(post.categoryId)) throw new Error(`Post ${post.id} sem categoria válida.`);
    if (ids.has(post.id)) throw new Error(`ID duplicado: ${post.id}`);
    if (slugs.has(post.slug)) throw new Error(`Slug duplicado: ${post.slug}`);
    if (Buffer.byteLength(JSON.stringify(post)) >= 900_000) {
      throw new Error(`Post ${post.id} está próximo do limite de 1 MiB do Firestore.`);
    }
    ids.add(post.id);
    slugs.add(post.slug);
  }
}

async function listFirestoreDocuments(collection, accessToken) {
  const documents = [];
  let pageToken = '';
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/${encodeURIComponent(DATABASE)}/documents/${collection}`
    );
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const payload = await fetchJson(url, accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined);
    for (const document of payload.documents || []) {
      documents.push({ id: document.name.split('/').pop(), raw: document });
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return documents;
}

async function writeDocuments(collection, documents, accessToken, allowOverwrite) {
  if (!documents.length) {
    console.log(`  ${collection}: nada novo para gravar.`);
    return;
  }

  const batches = chunk(documents, WRITE_BATCH_SIZE);
  let written = 0;
  for (const batch of batches) {
    const writes = batch.map(document => ({
      update: {
        name: `projects/${project}/databases/${DATABASE}/documents/${collection}/${document.id}`,
        fields: encodeMap(document)
      },
      ...(allowOverwrite ? {} : { currentDocument: { exists: false } })
    }));

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/${encodeURIComponent(DATABASE)}/documents:batchWrite`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
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
    console.log(`  ${collection}: ${written}/${documents.length}`);
  }
}

function encodeMap(object) {
  return Object.fromEntries(
    Object.entries(object)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)])
  );
}

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'object') return { mapValue: { fields: encodeMap(value) } };
  throw new Error(`Tipo não suportado pelo Firestore: ${typeof value}`);
}

async function fetchJsonWithHeaders(url) {
  const response = await fetchWithRetry(url);
  return { data: await response.json(), headers: response.headers };
}

async function fetchJson(url, headers) {
  const response = await fetchWithRetry(url, { headers });
  return response.json();
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`HTTP ${response.status} em ${url}: ${detail.slice(0, 300)}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

function extractImageUrls(html) {
  const urls = [];
  const regex = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html))) urls.push(decodeHtml(match[1]));
  return [...new Set(urls)];
}

function stripHtml(value) {
  return String(value).replace(/<[^>]*>/g, ' ');
}

function decodeHtml(value) {
  const entities = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
    ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”'
  };
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const hexadecimal = code[1]?.toLowerCase() === 'x';
      const number = Number.parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }
    return entities[code.toLowerCase()] ?? entity;
  });
}

function truncate(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function slugify(value) {
  return decodeHtml(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function uniqueBy(values, selector) {
  const seen = new Set();
  return values.filter(value => {
    const key = selector(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function positiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${flag} deve ser um inteiro positivo.`);
  return number;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) throw new Error(`Argumento desconhecido: ${item}`);
    const key = item.slice(2);
    if (['write', 'overwrite'].includes(key)) {
      parsed[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Valor ausente para --${key}.`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function printSamples(posts) {
  console.log('\nAmostra dos posts mapeados:');
  console.table(posts.slice(0, 5).map(post => ({
    id: post.id,
    slug: post.slug,
    categoria: post.category?.name,
    imagem: post.imageSource,
    publicadoEm: post.publishedAt.toISOString().slice(0, 10)
  })));
}
