import { describe, expect, it } from 'vitest';
import { fetchCacheKey } from './fetch-cache.shared';

const BASE = 'https://firestore.googleapis.com/v1/projects/unitur-e7882/databases/(default)/documents';
const body = JSON.stringify({ structuredQuery: { from: [{ collectionId: 'trips' }] } });
const post = { method: 'POST', body };

describe('fetchCacheKey', () => {
  it('aceita consultas e leituras de documentos do Firestore', () => {
    expect(fetchCacheKey(`${BASE}:runQuery`, post)).toBe(`${BASE}:runQuery\n${body}`);
    expect(fetchCacheKey(`${BASE}:batchGet`, post)).not.toBeNull();
    // Consulta dentro de um documento (subcoleção).
    expect(fetchCacheKey(`${BASE}/posts/1:runQuery`, post)).not.toBeNull();
  });

  it('aceita o endereço com a chave do projeto, como o SDK envia', () => {
    const url = `${BASE}:runQuery?key=abc123`;
    expect(fetchCacheKey(url, post)).toBe(`${url}\n${body}`);
    expect(fetchCacheKey(new URL(url), post)).toBe(`${url}\n${body}`);
  });

  it('diferencia consultas pelo corpo', () => {
    const other = { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'posts' }] } }) };
    expect(fetchCacheKey(`${BASE}:runQuery`, post)).not.toBe(fetchCacheKey(`${BASE}:runQuery`, other));
  });

  it('nunca reaproveita gravações', () => {
    expect(fetchCacheKey(`${BASE}:commit`, post)).toBeNull();
    expect(fetchCacheKey(`${BASE}:batchWrite`, post)).toBeNull();
  });

  it('ignora o que não é leitura do Firestore', () => {
    expect(fetchCacheKey('https://www.unitur.com.br/api/sitemap', post)).toBeNull();
    expect(fetchCacheKey(`https://evil.example/v1/projects/x/databases/y/documents:runQuery`, post)).toBeNull();
    expect(fetchCacheKey(`${BASE}:runQuery`, { method: 'GET' })).toBeNull();
    expect(fetchCacheKey(`${BASE}:runQuery`, { method: 'POST', body: new Uint8Array(2) })).toBeNull();
    expect(fetchCacheKey(`${BASE}:runQuery`)).toBeNull();
    expect(fetchCacheKey({ url: `${BASE}:runQuery` }, post)).toBeNull();
  });
});
