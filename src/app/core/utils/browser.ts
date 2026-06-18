/**
 * Helpers SSR-safe para contextos SEM injeção de dependência
 * (URL matchers, interceptors funcionais, funções puras).
 *
 * Em serviços/componentes prefira `BrowserStorageService` + `isPlatformBrowser`.
 */

/** `true` apenas quando rodando no browser (há `window`/`localStorage`). */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/** Lê uma chave do localStorage de forma segura no SSR (devolve `null` no server). */
export function safeLocalStorageGet(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** `window.scrollTo` SSR-safe (no-op no servidor). */
export function safeScrollToTop(behavior: ScrollBehavior = 'auto'): void {
  if (!isBrowser()) return;
  window.scrollTo({ top: 0, behavior });
}
