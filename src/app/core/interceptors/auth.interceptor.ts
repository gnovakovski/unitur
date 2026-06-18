import { HttpInterceptorFn } from '@angular/common/http';
import { safeLocalStorageGet } from '../utils/browser';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = safeLocalStorageGet('auth_token');

  if (token && !req.url.includes('/auth/login')) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req);
};
