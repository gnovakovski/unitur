import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { UserBootstrapService } from './core/services/user-bootstrap.service';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    // App roda sem zone.js: habilita o scheduler zoneless oficial, que reage a
    // markForCheck()/signals/ApplicationRef.tick() e dispara change detection
    // automática quando dados assíncronos (Firebase) chegam. Sem isto a view só
    // atualizava ao clicar (um evento de DOM forçava o ciclo manualmente).
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
    ),
    provideHttpClient(withInterceptors([authInterceptor, httpErrorInterceptor])),
    provideAppInitializer(() => {
      const bootstrap = inject(UserBootstrapService);
      return bootstrap.ensureSeedUser();
    }),
    provideClientHydration(withEventReplay()),
  ],
};
