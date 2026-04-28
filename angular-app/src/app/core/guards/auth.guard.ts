import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.waitForAuthenticatedUser().then(isAuthenticated => {
    if (isAuthenticated) {
      return true;
    }

    return router.createUrlTree(['/administrador'], {
      queryParams: { returnUrl: state.url }
    });
  });
};
