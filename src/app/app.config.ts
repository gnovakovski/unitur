import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { UrlSerializer, provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { TrailingSlashUrlSerializer } from './core/routing/trailing-slash-url-serializer';
import { provideSsrFetchCache } from './core/ssr/fetch-cache.browser';
import { safeLocalStorageGet } from './core/utils/browser';

/**
 * Navegador de quem está (ou esteve) logado no painel.
 *
 * O HTML que vem do servidor fica até ~1 minuto no cache da CDN. Para o
 * visitante isso não faz diferença, mas quem acabou de salvar uma viagem ou um
 * post precisa ver a alteração na hora. Nesses navegadores o site funciona como
 * antes do SSR: descarta o HTML pronto e monta a página lendo o Firestore
 * direto (sem hidratação nem reaproveitamento das leituras do servidor — ver
 * SsrFetchCache.install). No servidor é sempre `false`.
 */
const hasAdminSession = !!safeLocalStorageGet('auth_user');

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
    // URLs sempre com barra final (/blog/post/): sem isto o Angular removia a barra
    // ao carregar a página e o GA4 contava 2 page_views por entrada.
    { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer },
    provideHttpClient(withInterceptors([authInterceptor, httpErrorInterceptor])),
    // As páginas públicas chegam renderizadas do servidor (SSR). A hidratação faz
    // o app assumir esse HTML no navegador sem apagar e redesenhar a tela; o
    // "event replay" guarda os cliques dados antes de o app terminar de carregar.
    ...(hasAdminSession ? [] : [provideClientHydration(withEventReplay())]),
    // As leituras do Firestore feitas no servidor vêm dentro do HTML e são
    // reaproveitadas na hidratação (a página não volta para "carregando").
    provideSsrFetchCache(),
    // Não há APP_INITIALIZER de propósito: antes havia um que, a cada visita,
    // criava/logava uma conta admin de teste no Firebase Auth antes de renderizar
    // qualquer coisa. Isso travava o primeiro paint (FCP/LCP) e expunha a senha
    // no bundle público. Contas de admin são criadas pelo console do Firebase.
  ],
};
