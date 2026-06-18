import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  error = '';
  /** Vazio = decidir pelo primeiro módulo permitido (firstAllowedRoute). */
  returnUrl = '';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private permissionService: PermissionService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    // Redireciona se já estiver autenticado E tiver acesso a algum módulo.
    // Sem acesso, mantém na tela de login (evita loop de redirect p/ o login).
    if (this.authService.isAuthenticated() && this.permissionService.hasAnyAccess()) {
      this.router.navigateByUrl(this.permissionService.firstAllowedRoute());
    }

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });

    // Pega URL de retorno dos query params (se houver)
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '';
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        // Usuário ativo mas sem nenhum módulo liberado: não há para onde ir.
        // Desloga e avisa, em vez de cair em loop de redirect para o login.
        if (!this.returnUrl && !this.permissionService.hasAnyAccess()) {
          this.authService.logout();
          this.error = 'Seu usuário ainda não tem acesso a nenhum módulo. Solicite a um administrador que libere suas permissões.';
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }

        // Com a sessão já carregada, decide o destino pelos módulos permitidos.
        const target = this.returnUrl || this.permissionService.firstAllowedRoute();
        this.router.navigateByUrl(target);
      },
      error: (err) => {
        this.error = err?.message || err?.error?.message || 'Erro ao fazer login. Verifique suas credenciais.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
