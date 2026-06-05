import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, switchMap, tap } from 'rxjs';
import { Router } from '@angular/router';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { ModuleKey } from '../models/user.model';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: ModuleKey[];
}

export interface AuthResponse {
  token: string;
  user: SessionUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private authReadyPromise: Promise<boolean> | null = null;

  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private firebaseService: FirebaseService,
    private router: Router
  ) {}

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return from(signInWithEmailAndPassword(
      this.firebaseService.auth,
      credentials.email,
      credentials.password
    )).pipe(
      switchMap(async ({ user }) => {
        const token = await user.getIdToken();
        return {
          token,
          user: await this.buildSessionUser(user)
        };
      }),
      tap(response => {
        this.setSession(response);
      })
    );
  }

  logout(): void {
    signOut(this.firebaseService.auth).catch(() => undefined);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/administrador']);
  }

  isAuthenticated(): boolean {
    if (this.firebaseService.auth.currentUser) {
      return true;
    }

    const token = this.getToken();
    if (!token) {
      return false;
    }

    // Verifica se token está expirado
    return !this.isTokenExpired(token);
  }

  waitForAuthenticatedUser(): Promise<boolean> {
    const auth = this.firebaseService.auth;

    if (auth.currentUser) {
      const current = auth.currentUser;
      return current.getIdToken().then(async token => {
        this.setSession({
          token,
          user: await this.buildSessionUser(current)
        });
        return true;
      }).catch(() => {
        // getIdToken/leitura do perfil falhou → trata como não autenticado
        // (o authGuard redireciona ao login). Evita promover por erro de rede.
        return false;
      });
    }

    if (this.authReadyPromise) {
      return this.authReadyPromise;
    }

    this.authReadyPromise = new Promise(resolve => {
      const timeoutId = window.setTimeout(() => {
        unsubscribe();
        this.authReadyPromise = null;
        resolve(false);
      }, 10000);

      const unsubscribe = onAuthStateChanged(auth, user => {
        window.clearTimeout(timeoutId);
        unsubscribe();
        this.authReadyPromise = null;

        if (!user) {
          localStorage.removeItem(this.TOKEN_KEY);
          localStorage.removeItem(this.USER_KEY);
          this.currentUserSubject.next(null);
          resolve(false);
          return;
        }

        user.getIdToken().then(async token => {
          this.setSession({
            token,
            user: await this.buildSessionUser(user)
          });
          resolve(true);
        }).catch(() => resolve(false));
      });
    });

    return this.authReadyPromise;
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  /**
   * Monta o usuário da sessão a partir do perfil gravado no Firestore
   * (coleção `users`, doc = uid), de onde vêm o `role` e as `permissions` reais.
   *
   * Fallback de compatibilidade: se o documento NÃO EXISTIR (conta seed antiga,
   * primeiro admin criado direto no console), o usuário é tratado como `admin`
   * para não travar o acesso que já funcionava antes desta feature.
   *
   * IMPORTANTE (segurança): uma FALHA de leitura (timeout, regra do Firestore,
   * rede) NÃO cai no fallback admin — isso seria fail-open / escalada de
   * privilégio (qualquer glitch de rede promoveria um editor a admin). Nesse
   * caso o erro é propagado e quem chama trata como falha de autenticação.
   */
  private async buildSessionUser(firebaseUser: FirebaseUser): Promise<SessionUser> {
    const fallbackName = firebaseUser.displayName || firebaseUser.email || 'Administrador';
    const email = firebaseUser.email || '';

    const ref = doc(this.firebaseService.firestore, 'users', firebaseUser.uid);
    const snapshot = await this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar o perfil do usuário.'
    );

    if (snapshot.exists()) {
      const data = snapshot.data() as { name?: string; role?: string; permissions?: ModuleKey[] };
      return {
        id: firebaseUser.uid,
        name: data.name || fallbackName,
        email,
        role: data.role || 'admin',
        permissions: Array.isArray(data.permissions) ? data.permissions : []
      };
    }

    // Doc genuinamente ausente → fallback admin (compatibilidade).
    return {
      id: firebaseUser.uid,
      name: fallbackName,
      email,
      role: 'admin',
      permissions: []
    };
  }

  private setSession(authResult: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, authResult.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(authResult.user));
    this.currentUserSubject.next(authResult.user);
  }

  private getUserFromStorage(): any {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp;
      return Math.floor(new Date().getTime() / 1000) >= expiry;
    } catch {
      return true;
    }
  }
}
