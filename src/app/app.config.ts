import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { UserBootstrapService } from './core/services/user-bootstrap.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled'
      })
    ),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        httpErrorInterceptor
      ])
    ),
    provideAppInitializer(() => {
      const bootstrap = inject(UserBootstrapService);
      return bootstrap.ensureSeedUser();
    })
  ]
};
