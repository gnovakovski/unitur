import {
  ApplicationConfig,
  TransferState,
  inject,
  mergeApplicationConfig,
  provideEnvironmentInitializer
} from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { FETCH_CACHE_STATE } from './core/ssr/fetch-cache.shared';
import { currentFetchRecorder } from './core/ssr/fetch-cache.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // As leituras do Firestore usadas para montar esta página vão dentro do HTML
    // (TransferState), para o navegador não precisar refazê-las ao assumir a tela.
    provideEnvironmentInitializer(() => {
      const recorder = currentFetchRecorder();
      if (!recorder) return;
      inject(TransferState).onSerialize(FETCH_CACHE_STATE, () => recorder.toEntries());
    })
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
