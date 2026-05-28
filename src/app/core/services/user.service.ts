import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile
} from 'firebase/auth';
import { initializeApp, deleteApp, getApps, FirebaseApp } from 'firebase/app';
import { environment } from '../../../environments/environment';
import { FirebaseService } from './firebase.service';
import { User } from '../models/user.model';

export interface UserCreatePayload {
  name: string;
  email: string;
  password: string;
  role: User['role'];
  status: User['status'];
}

export interface UserUpdatePayload {
  name?: string;
  role?: User['role'];
  status?: User['status'];
  password?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly collectionName = 'users';

  constructor(private firebaseService: FirebaseService) {}

  getUsers(): Observable<User[]> {
    return from(this.firebaseService.withTimeout(getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('name', 'asc')
    )), 'Tempo esgotado ao carregar usuários do Firestore.')).pipe(
      map(snapshot => snapshot.docs.map(item => {
        const data = this.firebaseService.normalizeDates(item.data()) as User;
        return { ...data, id: item.id } as User;
      }))
    );
  }

  /**
   * Cria um usuário no Firebase Auth E grava o perfil no Firestore.
   *
   * Usa uma instância secundária do Firebase para não derrubar a sessão
   * do admin atualmente logado. Sem isso, o `createUserWithEmailAndPassword`
   * troca o usuário ativo no Auth principal.
   */
  createUser(payload: UserCreatePayload): Observable<User> {
    return from(this.createUserInternal(payload));
  }

  private async createUserInternal(payload: UserCreatePayload): Promise<User> {
    const secondaryAppName = `secondary-${Date.now()}`;
    let secondaryApp: FirebaseApp | null = null;

    try {
      secondaryApp = initializeApp(environment.firebase, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const credential = await createUserWithEmailAndPassword(secondaryAuth, payload.email, payload.password);
      const uid = credential.user.uid;

      try {
        await updateProfile(credential.user, { displayName: payload.name });
      } catch {
        // displayName é cosmético; falhar aqui não invalida o cadastro
      }

      const now = new Date();
      const user: User = {
        id: uid,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        status: payload.status,
        createdAt: now,
        updatedAt: now
      };

      await setDoc(doc(this.firebaseService.firestore, this.collectionName, uid), user);

      // Encerra a sessão secundária — não queremos manter dois usuários autenticados
      await signOut(secondaryAuth).catch(() => undefined);

      return user;
    } finally {
      if (secondaryApp && getApps().includes(secondaryApp)) {
        await deleteApp(secondaryApp).catch(() => undefined);
      }
    }
  }

  /**
   * Atualiza nome/role/status no Firestore. Senha só é gravada se passada.
   * (Trocar senha de outro usuário precisaria do Admin SDK — fora de escopo aqui.)
   */
  updateUser(id: string, payload: UserUpdatePayload): Observable<User> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date()
    };
    if (payload.name !== undefined) updates['name'] = payload.name;
    if (payload.role !== undefined) updates['role'] = payload.role;
    if (payload.status !== undefined) updates['status'] = payload.status;

    const ref = doc(this.firebaseService.firestore, this.collectionName, id);
    return from(this.firebaseService.withTimeout(
      updateDoc(ref, updates).then(async () => {
        const snapshot = await getDoc(ref);
        const data = snapshot.exists() ? this.firebaseService.normalizeDates(snapshot.data()) as User : {} as User;
        return { ...data, id } as User;
      }),
      'Tempo esgotado ao atualizar usuário no Firestore.'
    ));
  }

  /**
   * Remove apenas o documento do Firestore. A conta no Firebase Auth
   * precisa ser removida via Console (ou via Admin SDK em backend).
   */
  deleteUser(id: string): Observable<void> {
    return from(this.firebaseService.withTimeout(
      deleteDoc(doc(this.firebaseService.firestore, this.collectionName, id)),
      'Tempo esgotado ao excluir usuário no Firestore.'
    ));
  }
}
