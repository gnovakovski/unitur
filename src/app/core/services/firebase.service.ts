import { Injectable, PendingTasks, inject } from '@angular/core';
import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore, Timestamp } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  // Registra cada chamada ao Firestore como tarefa pendente: no SSR isso impede
  // a app de "estabilizar" (e serializar o HTML) antes dos dados chegarem,
  // garantindo que o conteúdo e as meta tags saiam renderizados no servidor.
  private readonly pendingTasks = inject(PendingTasks);

  private app: FirebaseApp | null = null;
  private firestoreDb: Firestore | null = null;

  get auth(): Auth {
    return getAuth(this.getApp());
  }

  get firestore(): Firestore {
    if (!this.firestoreDb) {
      try {
        this.firestoreDb = initializeFirestore(this.getApp(), {
          experimentalForceLongPolling: true,
          useFetchStreams: false
        } as Parameters<typeof initializeFirestore>[1]);
      } catch {
        this.firestoreDb = getFirestore(this.getApp());
      }
    }

    return this.firestoreDb;
  }

  get storage(): FirebaseStorage {
    return getStorage(this.getApp());
  }

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
    return Promise.race([promise, timeout]).finally(() => {
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
