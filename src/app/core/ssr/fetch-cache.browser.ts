import {
  APP_BOOTSTRAP_LISTENER,
  ApplicationRef,
  EnvironmentProviders,
  Injectable,
  Injector,
  PLATFORM_ID,
  TransferState,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { FETCH_CACHE_STATE, FetchCacheEntries, fetchCacheKey } from './fetch-cache.shared';
import { safeLocalStorageGet } from '../utils/browser';

/** Tempo máximo que as respostas do servidor ficam valendo no navegador. */
const MAX_REPLAY_MS = 10_000;

/**
 * Lado NAVEGADOR do cache de leituras do Firestore (ver fetch-cache.shared.ts).
 *
 * Quando a página veio pronta do servidor, as leituras que o servidor fez estão
 * dentro do HTML. Enquanto o app "acorda" (hidratação), este serviço responde
 * essas mesmas leituras na hora, sem rede. Assim a tela que o servidor montou
 * continua igual — sem voltar para o estado de "carregando" — e o visitante não
 * refaz as consultas ao Firestore.
 *
 * Vale só para o carregamento inicial: assim que o app estabiliza, o `fetch`
 * original é restaurado e as navegações seguintes leem o Firestore normalmente.
 */
@Injectable({ providedIn: 'root' })
export class SsrFetchCache {
  // O ApplicationRef é buscado só na hora do uso: este serviço é criado na
  // inicialização do injetor, antes de o app existir.
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly transferState = inject(TransferState);

  private entries: FetchCacheEntries | null = null;
  private restoreFetch: (() => void) | null = null;

  /**
   * `true` enquanto as respostas do servidor estão valendo, isto é: a página
   * veio renderizada do servidor e o app ainda está assumindo a tela. As
   * leituras feitas agora resolvem na hora, sem rede.
   */
  get active(): boolean {
    return this.entries !== null;
  }

  /** Chamado na criação do app, antes de qualquer leitura. */
  install(): void {
    if (!this.isBrowser || this.entries) return;

    const entries = this.transferState.get(FETCH_CACHE_STATE, null);
    if (!entries || Object.keys(entries).length === 0) return;

    // Quem está logado no painel precisa ver o que acabou de salvar: lê direto
    // do Firestore em vez de reaproveitar a página que o servidor montou (que
    // pode ter até alguns minutos).
    if (safeLocalStorageGet('auth_user')) return;

    const view = this.document.defaultView;
    if (!view || typeof view.fetch !== 'function') return;

    this.entries = entries;
    const originalFetch = view.fetch;
    const replayFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const cached = this.entries;
      const key = cached ? fetchCacheKey(input, init) : null;
      if (cached && key !== null && Object.prototype.hasOwnProperty.call(cached, key)) {
        return Promise.resolve(replayResponse(cached[key]));
      }
      return originalFetch.call(view, input, init);
    }) as typeof fetch;

    view.fetch = replayFetch;
    this.restoreFetch = () => {
      // Só desfaz se ninguém trocou o fetch depois (ex.: script de terceiros).
      if (view.fetch === replayFetch) view.fetch = originalFetch;
    };
  }

  /**
   * Encerra o reaproveitamento quando o app estabiliza (a navegação inicial e
   * as leituras dela terminaram). Chamado logo após o bootstrap.
   */
  releaseWhenStable(): void {
    if (!this.entries) return;

    // Um macrotask depois do bootstrap a navegação inicial já começou e segura
    // a estabilidade até a página terminar de carregar.
    setTimeout(() => {
      this.injector.get(ApplicationRef).whenStable().then(() => this.release());
    });
    setTimeout(() => this.release(), MAX_REPLAY_MS);
  }

  private release(): void {
    if (!this.entries) return;
    this.entries = null;
    this.restoreFetch?.();
    this.restoreFetch = null;
    this.transferState.remove(FETCH_CACHE_STATE);
  }
}

/**
 * Resposta pronta para uma leitura já feita no servidor.
 *
 * `json()` resolve com o valor já decodificado, em microtask. Um `Response` de
 * verdade leria o corpo por stream, o que só termina num próximo ciclo do
 * navegador — tempo suficiente para a tela pintar um quadro de "carregando".
 */
function replayResponse(value: unknown): Response {
  const response = new Response(null, {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' }
  });
  Object.defineProperties(response, {
    json: { value: () => Promise.resolve(cloneJson(value)) },
    text: { value: () => Promise.resolve(JSON.stringify(value)) },
    clone: { value: () => replayResponse(value) }
  });
  return response;
}

/** Cópia independente: quem lê não pode alterar o valor guardado. */
function cloneJson<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

/** Liga o reaproveitamento das leituras do servidor no navegador. */
export function provideSsrFetchCache(): EnvironmentProviders {
  return makeEnvironmentProviders([
    // Antes de qualquer componente existir (e portanto antes da 1ª leitura).
    provideEnvironmentInitializer(() => inject(SsrFetchCache).install()),
    {
      provide: APP_BOOTSTRAP_LISTENER,
      multi: true,
      useFactory: () => {
        const cache = inject(SsrFetchCache);
        return () => cache.releaseWhenStable();
      }
    }
  ]);
}
