import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';
import { ModuleKey } from '../models/user.model';

/**
 * Guarda de rota por módulo. Use como factory na definição das rotas:
 *
 *   canActivate: [authGuard, permissionGuard('posts')]
 *   canActivate: [authGuard, permissionGuard(['viagens', 'moeda'])]
 *
 * Deve rodar DEPOIS do `authGuard` (que garante a sessão carregada). Se o
 * usuário não tem o(s) módulo(s), é redirecionado para a primeira tela a que
 * tem acesso.
 */
export function permissionGuard(modules: ModuleKey | ModuleKey[]): CanActivateFn {
  return () => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);

    if (permissionService.can(modules)) {
      return true;
    }

    return router.createUrlTree([permissionService.firstAllowedRoute()]);
  };
}
