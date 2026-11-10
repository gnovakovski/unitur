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
} from 'firebase/firestore/lite';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
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
  permissions?: User['permissions'];
}

export interface UserUpdatePayload {
  name?: string;
  role?: User['role'];
  status?: User['status'];
  password?: string;
  permissions?: User['permissions'];
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

      let uid: string;
      let displayNameUser: Parameters<typeof updateProfile>[0] | null = null;

      try {
        const credential = await createUserWithEmailAndPassword(secondaryAuth, payload.email, payload.password);
        uid = credential.user.uid;
        displayNameUser = credential.user;
      } catch (err: any) {
        // A conta já existe no Auth. Isso costuma acontecer quando um usuário foi
        // excluído só do Firestore (o app cliente não pode apagar contas de outros
        // do Auth — isso exige o Admin SDK no backend), deixando uma conta "órfã".
        // Aqui tentamos reaproveitá-la: logamos com a senha informada e, se não
        // houver perfil no Firestore, recriamos o perfil sobre o mesmo uid.
        if (err?.code !== 'auth/email-already-in-use') {
          throw err;
        }

        const recovered = await this.recoverOrphanAuthAccount(secondaryAuth, payload, err);
        uid = recovered.uid;
        displayNameUser = recovered.authUser;
      }

      if (displayNameUser) {
        try {
          await updateProfile(displayNameUser, { displayName: payload.name });
        } catch {
          // displayName é cosmético; falhar aqui não invalida o cadastro
        }
      }

      const now = new Date();
      const user: User = {
        id: uid,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        status: payload.status,
        permissions: payload.permissions ?? [],
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
   * Trata o caso de uma conta que existe no Auth mas pode não ter perfil no
   * Firestore (conta "órfã", típica de quem foi excluído só do banco).
   *
   * - Se a senha informada bate e NÃO há perfil no Firestore → reaproveita a conta.
   * - Se a senha informada bate mas JÁ existe perfil → é um cadastro realmente
   *   duplicado; repropaga o erro `email-already-in-use`.
   * - Se a senha não bate → a conta existe com outra senha; erro específico.
   */
  private async recoverOrphanAuthAccount(
    secondaryAuth: ReturnType<typeof getAuth>,
    payload: UserCreatePayload,
    originalError: any
  ): Promise<{ uid: string; authUser: Parameters<typeof updateProfile>[0] }> {
    let signedIn;
    try {
      signedIn = await signInWithEmailAndPassword(secondaryAuth, payload.email, payload.password);
    } catch {
      // Conta existe no Auth, mas a senha informada não confere. Não dá para
      // reaproveitar pelo client; orienta a usar outra senha/limpar no Console.
      const e: any = new Error(
        'Este e-mail já tem uma conta de acesso com outra senha. Use a senha original dessa conta para reativá-la, ou remova-a em Authentication no console do Firebase.'
      );
      e.code = 'auth/account-exists-other-password';
      throw e;
    }

    const uid = signedIn.user.uid;
    const profileRef = doc(this.firebaseService.firestore, this.collectionName, uid);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      // Há conta no Auth E perfil no banco → é mesmo um duplicado.
      throw originalError;
    }

    // Conta órfã (sem perfil): reaproveitamos o uid existente.
    return { uid, authUser: signedIn.user };
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
    if (payload.permissions !== undefined) updates['permissions'] = payload.permissions;

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
