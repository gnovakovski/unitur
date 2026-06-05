import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ModuleKey } from '../models/user.model';
import { ADMIN_MODULES } from '../models/modules.config';

/**
 * Decide o que o usuário logado pode ver/fazer, com base no `role` e na lista
 * `permissions` do documento dele no Firestore.
 *
 * Regra central: `role === 'admin'` libera tudo; caso contrário vale a lista
 * `permissions`. Contas antigas sem `permissions` são tratadas como admin pelo
 * AuthService (fallback de compatibilidade), então aqui basta olhar o que veio
 * na sessão.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  constructor(private authService: AuthService) {}

  isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'admin';
  }

  private permissions(): ModuleKey[] {
    const user = this.authService.getCurrentUser();
    return Array.isArray(user?.permissions) ? user.permissions : [];
  }

  /**
   * `true` se o usuário tem acesso a pelo menos um módulo do painel. Um usuário
   * autenticado mas sem nenhum módulo (admin esqueceu de marcar permissões) não
   * tem para onde ir — quem chama deve deslogá-lo e avisar, em vez de redirecioná-lo
   * em loop.
   */
  hasAnyAccess(): boolean {
    return this.firstAllowedRoute() !== '/administrador';
  }

  /** `true` se o usuário tem acesso a pelo menos um dos módulos informados. */
  can(modules: ModuleKey | ModuleKey[]): boolean {
    if (this.isAdmin()) {
      return true;
    }
    const wanted = Array.isArray(modules) ? modules : [modules];
    const granted = this.permissions();
    return wanted.some(m => granted.includes(m));
  }

  /**
   * Rota para onde mandar o usuário após o login (ou quando ele tenta abrir uma
   * tela sem permissão). Retorna a primeira rota de módulo permitida na ordem
   * de `ADMIN_MODULES`.
   *
   * Caso especial: quem só tem `moeda` (sem rota própria) é enviado para
   * `/admin/viagens`, pois é lá que mora a modal de cotações.
   */
  firstAllowedRoute(): string {
    if (this.isAdmin()) {
      return '/admin/viagens';
    }

    const granted = this.permissions();

    for (const module of ADMIN_MODULES) {
      if (module.route && granted.includes(module.key)) {
        return module.route;
      }
    }

    // Só tem moeda → a modal vive na tela de Viagens.
    if (granted.includes('moeda')) {
      return '/admin/viagens';
    }

    // Sem nenhum módulo: volta ao login.
    return '/administrador';
  }
}
