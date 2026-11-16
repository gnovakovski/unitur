import { Injectable, RESPONSE_INIT, inject } from '@angular/core';
import { DEGRADED_RENDER_HEADER } from '../ssr/ssr-signals';

/**
 * Controla a resposta HTTP da página enquanto ela é renderizada no servidor:
 * status (404, 301) e o aviso de que faltou dado.
 *
 * No navegador não existe resposta para alterar (`RESPONSE_INIT` é nulo) e
 * todos os métodos viram no-op — os componentes podem chamar sem checar a
 * plataforma.
 */
@Injectable({ providedIn: 'root' })
export class ServerResponseService {
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  /** `true` quando há uma resposta HTTP sendo montada (renderização no servidor). */
  get isServer(): boolean {
    return !!this.responseInit;
  }

  /** O endereço não existe: a página de erro sai com status 404 de verdade. */
  notFound(): void {
    this.setStatus(404);
  }

  /**
   * Marca a navegação que vem a seguir (`router.navigate...`) como
   * redirecionamento permanente (301). Sem isto o servidor responde 302.
   */
  permanentRedirect(): void {
    this.setStatus(301);
  }

  /**
   * Alguma leitura de dados falhou durante a renderização. O servidor descarta
   * este HTML (ver `DEGRADED_RENDER_HEADER`).
   */
  markDegraded(): void {
    const headers = this.responseInit?.headers;
    if (headers instanceof Headers) {
      headers.set(DEGRADED_RENDER_HEADER, '1');
    }
  }

  private setStatus(status: number): void {
    if (this.responseInit) {
      this.responseInit.status = status;
    }
  }
}
