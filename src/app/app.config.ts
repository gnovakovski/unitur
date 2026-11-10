import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';

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
    // Não há APP_INITIALIZER de propósito: antes havia um que, a cada visita,
    // criava/logava uma conta admin de teste no Firebase Auth antes de renderizar
    // qualquer coisa. Isso travava o primeiro paint (FCP/LCP) e expunha a senha
    // no bundle público. Contas de admin são criadas pelo console do Firebase.
  ],
};
