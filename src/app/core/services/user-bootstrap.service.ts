import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { initializeApp, deleteApp, getApps, FirebaseApp } from 'firebase/app';
import { environment } from '../../../environments/environment';
import { FirebaseService } from './firebase.service';
import { User } from '../models/user.model';

const SEED_USER = {
  email: 'teste@gmail.com',
  password: '123456',
  name: 'Usuário Teste',
  role: 'admin' as const,
  status: 'active' as const
};

@Injectable({ providedIn: 'root' })
export class UserBootstrapService {
  private hasRun = false;

  constructor(private firebaseService: FirebaseService) {}

  async ensureSeedUser(): Promise<void> {
    if (this.hasRun) return;
    this.hasRun = true;

    const secondaryAppName = `bootstrap-${Date.now()}`;
    let secondaryApp: FirebaseApp | null = null;

    try {
      secondaryApp = initializeApp(environment.firebase, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      let uid: string | null = null;

      try {
        const credential = await createUserWithEmailAndPassword(
          secondaryAuth,
          SEED_USER.email,
          SEED_USER.password
        );
        uid = credential.user.uid;
      } catch (err: any) {
        if (err?.code === 'auth/email-already-in-use') {
          try {
            const credential = await signInWithEmailAndPassword(
              secondaryAuth,
              SEED_USER.email,
              SEED_USER.password
            );
            uid = credential.user.uid;
          } catch {
            return;
          }
        } else {
          return;
        }
      }

      if (!uid) return;

      const ref = doc(this.firebaseService.firestore, 'users', uid);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        const now = new Date();
        const user: User = {
          id: uid,
          name: SEED_USER.name,
          email: SEED_USER.email,
          role: SEED_USER.role,
          status: SEED_USER.status,
          createdAt: now,
          updatedAt: now
        };
        await setDoc(ref, user);
      }

      await signOut(secondaryAuth).catch(() => undefined);
    } catch {
      // bootstrap nunca deve quebrar a inicialização do app
    } finally {
      if (secondaryApp && getApps().includes(secondaryApp)) {
        await deleteApp(secondaryApp).catch(() => undefined);
      }
    }
  }
}
