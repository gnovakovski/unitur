import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Wrapper SSR-safe para o localStorage.
 *
 * No servidor (SSR/Vercel) `localStorage` não existe; aqui todos os métodos
 * viram no-op e a leitura devolve `null`, deixando os serviços caírem nos
 * defaults/cache vazio sem lançar `localStorage is not defined`.
 *
 * Para contextos sem injeção de dependência (interceptors funcionais, URL
 * matchers) use a função utilitária `isBrowser()` exportada abaixo.
 */
@Injectable({
  providedIn: 'root'
})
export class BrowserStorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  getItem(key: string): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Falha silenciosa (quota cheia, modo privado, etc.)
    }
  }

  removeItem(key: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Falha silenciosa
    }
  }
}
