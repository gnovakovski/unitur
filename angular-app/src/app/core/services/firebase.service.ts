import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, Timestamp } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app: FirebaseApp | null = null;

  get auth(): Auth {
    return getAuth(this.getApp());
  }

  get firestore(): Firestore {
    return getFirestore(this.getApp());
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
