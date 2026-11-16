import { makeStateKey } from '@angular/core';

/**
 * Peças comuns ao servidor e ao navegador do "cache de transferência" das
 * leituras do Firestore.
 *
 * O site lê o Firestore por HTTP (`fetch`): o SDK Firestore Lite e o
 * `runSelectQuery`. No servidor (SSR) essas respostas são guardadas e viajam
 * dentro do HTML; no navegador, a 1ª leitura de cada uma é respondida na hora
 * com o que veio do servidor. Assim a página não pisca nem refaz as consultas
 * ao "acordar" (hidratação) — é o mesmo que o `HttpClient` do Angular já faz
 * sozinho, só que para o `fetch` do Firebase.
 */

/** Respostas capturadas no servidor: chave da requisição → corpo JSON. */
export type FetchCacheEntries = Record<string, unknown>;

export const FETCH_CACHE_STATE = makeStateKey<FetchCacheEntries>('unitur-fetch-cache');

/**
 * Só leituras do Firestore: consultas (`runQuery`) e leitura de documentos
 * (`batchGet`). Gravações (`commit`) nunca entram. O SDK acrescenta `?key=...`
 * (a chave pública do projeto) ao endereço; o `runSelectQuery`, não.
 */
const FIRESTORE_READ_URL =
  /^https:\/\/firestore\.googleapis\.com\/v1\/projects\/[^/?#]+\/databases\/[^/?#]+\/documents(?:\/[^?#]*)?:(?:runQuery|batchGet)(?:\?[^#]*)?$/;

/**
 * Chave de uma leitura do Firestore (endereço + corpo da consulta), ou `null`
 * se a requisição não é uma leitura que possa ser reaproveitada.
 */
export function fetchCacheKey(input: unknown, init?: { method?: string; body?: unknown } | null): string | null {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : null;
  if (!url || !FIRESTORE_READ_URL.test(url)) return null;
  if (String(init?.method || 'GET').toUpperCase() !== 'POST') return null;
  if (typeof init?.body !== 'string') return null;
  return `${url}\n${init.body}`;
}
