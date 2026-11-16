import { Injectable, PendingTasks, inject } from '@angular/core';
import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { Firestore, getFirestore, Timestamp } from 'firebase/firestore/lite';
import type { FirebaseStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';
import { ServerResponseService } from './server-response.service';

/**
 * Ponto único de acesso ao Firebase.
 *
 * Desempenho do site público:
 * - Firestore **Lite**: o site só faz leituras e gravações pontuais (sem tempo
 *   real nem cache offline), então usa a versão Lite, que é bem menor e fala
 *   com o Firestore por requisições HTTP simples. O SDK completo deixava uma
 *   conexão aberta (long polling), e o Lighthouse nunca via a página "terminar
 *   de carregar".
 * - **Auth** e **Storage** carregam sob demanda (`getAuth()` / `getStorage()`):
 *   só o admin usa login e upload, então o visitante do site não baixa esses
 *   módulos. O Firestore Lite passa a mandar o token do admin automaticamente
 *   assim que o Auth é carregado.
 */
@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  // Registra cada chamada ao Firestore como tarefa pendente: no SSR isso impede
  // a app de "estabilizar" (e serializar o HTML) antes dos dados chegarem,
  // garantindo que o conteúdo e as meta tags saiam renderizados no servidor.
  private readonly pendingTasks = inject(PendingTasks);
  private readonly serverResponse = inject(ServerResponseService);

  private app: FirebaseApp | null = null;
  private firestoreDb: Firestore | null = null;
  private authInstance: Auth | null = null;
  private authPromise: Promise<Auth> | null = null;
  private storagePromise: Promise<FirebaseStorage> | null = null;

  get firestore(): Firestore {
    if (!this.firestoreDb) {
      this.firestoreDb = getFirestore(this.getApp());
    }
    return this.firestoreDb;
  }

  /** Firebase Auth, carregado na primeira chamada (só o admin usa). */
  getAuth(): Promise<Auth> {
    if (!this.authPromise) {
      this.authPromise = import('firebase/auth').then(({ getAuth }) => {
        this.authInstance = getAuth(this.getApp());
        return this.authInstance;
      });
    }
    return this.authPromise;
  }

  /** Auth já carregado nesta sessão, ou null se ninguém pediu ainda. */
  get loadedAuth(): Auth | null {
    return this.authInstance;
  }

  /** Firebase Storage, carregado na primeira chamada (só uploads do admin). */
  getStorage(): Promise<FirebaseStorage> {
    if (!this.storagePromise) {
      this.storagePromise = import('firebase/storage').then(({ getStorage }) => getStorage(this.getApp()));
    }
    return this.storagePromise;
  }

  // Sem Firebase Analytics de propósito: a medição oficial do site é o GA4 do
  // GTM (G-38K0T9NBRC). O Firebase Analytics criava uma 2ª propriedade GA4
  // (G-SCBXHSPDWX) e mandava page_view em dobro, além de carregar outro gtag.js.

  normalizeDates<T>(data: T): T {
    if (!data || typeof data !== 'object') {
      return data;
    }

    return Object.entries(data as Record<string, unknown>).reduce((result, [key, value]) => {
      (result as Record<string, unknown>)[key] = value instanceof Timestamp ? value.toDate() : value;
      return result;
    }, { ...(data as Record<string, unknown>) }) as T;
  }

  withTimeout<T>(promise: Promise<T>, message = 'Tempo esgotado ao consultar o Firestore.', ms = 10000): Promise<T> {
    // Mantém a app "instável" durante o SSR até a promise resolver — assim o
    // HTML é serializado só depois dos dados chegarem (em vez de no estado de
    // loading). `add()` retorna a função que remove a tarefa pendente.
    const removeTask = this.pendingTasks.add();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    // clearTimeout + removeTask evitam que o timer pendente atrase a estabilização.
    return Promise.race([promise, timeout])
      .catch(error => {
        // No SSR, uma leitura que falhou deixaria a página incompleta (e ela
        // ficaria assim no cache da CDN). Avisa o servidor, que descarta este
        // HTML e entrega a versão que carrega os dados no navegador.
        this.serverResponse.markDegraded();
        throw error;
      })
      .finally(() => {
        clearTimeout(timer);
        removeTask();
      });
  }

  private getApp(): FirebaseApp {
    if (!this.app) {
      const config = environment.firebase as FirebaseOptions;

      if (!config.apiKey || !config.projectId || !config.appId) {
        throw new Error('Firebase não configurado. Preencha environment.firebase com as credenciais do projeto.');
      }

      this.app = initializeApp(config);
    }

    return this.app;
  }
}
