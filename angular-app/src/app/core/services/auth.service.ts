import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, switchMap, tap } from 'rxjs';
import { Router } from '@angular/router';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FirebaseService } from './firebase.service';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  
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
          user: {
            id: user.uid,
            name: user.displayName || user.email || 'Administrador',
            email: user.email || credentials.email,
            role: 'admin'
          }
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
    const token = this.getToken();
    if (!token) {
      return false;
    }
    
    // Verifica se token está expirado
    return !this.isTokenExpired(token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
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
