import { AsyncLocalStorage } from 'node:async_hooks';
import { FetchCacheEntries, fetchCacheKey } from './fetch-cache.shared';

/**
 * Lado SERVIDOR do cache de leituras do Firestore (ver fetch-cache.shared.ts).
 * Este arquivo só entra no bundle do servidor (usa `node:async_hooks`).
 *
 * Faz duas coisas:
 *
 * 1. Memória curta entre requisições. Cada página renderizada lê dezenas de
 *    documentos (viagens, tags, menus, índice do blog...). Sem isto, um robô
 *    rastreando o site inteiro repetiria as mesmas leituras a cada página. As
 *    respostas ficam {@link MEMORY_TTL_MS} na memória da função.
 *
 * 2. Registro por requisição. As respostas usadas para montar UMA página são
 *    anotadas no "gravador" daquela requisição e vão dentro do HTML, para o
 *    navegador não precisar refazê-las. O gravador é localizado por
 *    `AsyncLocalStorage`, porque várias páginas podem estar sendo renderizadas
 *    ao mesmo tempo no mesmo processo.
 *
 * Só são dados públicos (as mesmas leituras anônimas que o navegador faz).
 */

/** Por quanto tempo uma leitura fica na memória do servidor. */
const MEMORY_TTL_MS = 60_000;
/** Respostas maiores que isto não ficam na memória (ex.: coleção inteira de posts). */
const MEMORY_MAX_ENTRY_BYTES = 2_000_000;
const MEMORY_MAX_ENTRIES = 300;
/** Limites do que viaja dentro do HTML de uma página. */
const TRANSFER_MAX_ENTRY_BYTES = 450_000;
const TRANSFER_MAX_TOTAL_BYTES = 1_200_000;

interface MemoryEntry {
  text: string;
  expires: number;
}

/** Respostas usadas na renderização de uma página. */
export class FetchRecorder {
  private readonly texts = new Map<string, string>();
  private bytes = 0;

  record(key: string, text: string): void {
    if (this.texts.has(key)) return;
    if (text.length > TRANSFER_MAX_ENTRY_BYTES) return;
    if (this.bytes + text.length > TRANSFER_MAX_TOTAL_BYTES) return;
    this.texts.set(key, text);
    this.bytes += text.length;
  }

  /** Formato gravado no HTML (TransferState). */
  toEntries(): FetchCacheEntries {
    const entries: FetchCacheEntries = {};
    for (const [key, text] of this.texts) {
      entries[key] = JSON.parse(text);
    }
    return entries;
  }
}

interface SharedState {
  context: AsyncLocalStorage<FetchRecorder>;
  memory: Map<string, MemoryEntry>;
  installed: boolean;
}

// Em `globalThis` para existir uma instância só, mesmo que o bundler coloque
// este módulo em mais de um arquivo (server.mjs e main.server.mjs).
const SHARED_KEY = Symbol.for('unitur.ssr.fetch-cache');
const globalRef = globalThis as unknown as Record<symbol, SharedState | undefined>;
const shared: SharedState = (globalRef[SHARED_KEY] ??= {
  context: new AsyncLocalStorage<FetchRecorder>(),
  memory: new Map<string, MemoryEntry>(),
  installed: false
});

/** Executa `callback` com um gravador próprio (uma requisição = um gravador). */
export function runWithFetchRecorder<T>(callback: () => T): T {
  return shared.context.run(new FetchRecorder(), callback);
}

/** Gravador da requisição em andamento, se houver. */
export function currentFetchRecorder(): FetchRecorder | undefined {
  return shared.context.getStore();
}

/** Substitui o `fetch` global do processo pela versão com cache. Idempotente. */
export function installServerFetchCache(): void {
  if (shared.installed || typeof globalThis.fetch !== 'function') return;
  shared.installed = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = fetchCacheKey(input, init);
    if (key === null) return originalFetch(input, init);

    const now = Date.now();
    const hit = shared.memory.get(key);
    if (hit && hit.expires > now) {
      currentFetchRecorder()?.record(key, hit.text);
      return jsonResponse(hit.text);
    }

    const response = await originalFetch(input, init);
    if (!response.ok) return response;

    let text: string;
    try {
      // Sem espaços/quebras de linha: a API devolve o JSON "bonito", ~30% maior.
      text = JSON.stringify(JSON.parse(await response.clone().text()));
    } catch {
      return response;
    }

    if (text.length <= MEMORY_MAX_ENTRY_BYTES) {
      remember(key, text, now);
    }
    currentFetchRecorder()?.record(key, text);
    return response;
  }) as typeof fetch;
}

function remember(key: string, text: string, now: number): void {
  // Reinsere no fim: o Map mantém a ordem de inserção, então o primeiro é o mais antigo.
  shared.memory.delete(key);
  shared.memory.set(key, { text, expires: now + MEMORY_TTL_MS });

  for (const oldest of shared.memory.keys()) {
    if (shared.memory.size <= MEMORY_MAX_ENTRIES) break;
    shared.memory.delete(oldest);
  }
}

function jsonResponse(text: string): Response {
  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' }
  });
}
