import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, firstValueFrom } from 'rxjs';
import { ModuleKey, User } from '../../../core/models/user.model';
import { ADMIN_MODULES, AdminModule } from '../../../core/models/modules.config';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuarios-list.component.html',
  styleUrl: './usuarios-list.component.scss'
})
export class UsuariosListComponent implements OnInit {
  users: User[] = [];
  userForm: FormGroup;
  loading = false;
  saving = false;
  formOpen = false;
  error = '';
  feedback = '';
  editingUser: User | null = null;
  deletingId: string | null = null;

  readonly roleLabels: Record<string, string> = {
    admin: 'Administrador',
    editor: 'Editor',
    viewer: 'Visualizador'
  };

  /** Módulos exibidos como checkboxes de permissão no formulário. */
  readonly adminModules: AdminModule[] = ADMIN_MODULES;

  /** Permissões marcadas no formulário (para usuários não-admin). */
  selectedPermissions = new Set<ModuleKey>();

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {
    this.userForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(6)]],
      role: ['admin', [Validators.required]],
      status: ['active', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.error = '';
    this.userService.getUsers().subscribe({
      next: users => {
        this.users = users;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.error = err?.message || 'Erro ao carregar usuários.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openForm(user?: User) {
    this.formOpen = true;
    this.editingUser = user || null;
    const emailCtrl = this.userForm.get('email');
    const passwordCtrl = this.userForm.get('password');

    if (user) {
      // Edição: e-mail e senha não são alteráveis aqui (limitação do client SDK)
      emailCtrl?.disable();
      passwordCtrl?.disable();
      this.selectedPermissions = new Set<ModuleKey>(user.permissions ?? []);
      this.userForm.reset({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        status: user.status
      });
    } else {
      emailCtrl?.enable();
      passwordCtrl?.enable();
      passwordCtrl?.setValidators([Validators.required, Validators.minLength(6)]);
      passwordCtrl?.updateValueAndValidity();
      this.selectedPermissions = new Set<ModuleKey>();
      this.userForm.reset({
        name: '',
        email: '',
        password: '',
        role: 'admin',
        status: 'active'
      });
    }
  }

  /** `true` quando o perfil selecionado é admin (acesso total, sem checkboxes). */
  get isAdminRole(): boolean {
    return this.userForm.get('role')?.value === 'admin';
  }

  isPermissionSelected(key: ModuleKey): boolean {
    return this.selectedPermissions.has(key);
  }

  togglePermission(key: ModuleKey, checked: boolean): void {
    if (checked) {
      this.selectedPermissions.add(key);
    } else {
      this.selectedPermissions.delete(key);
    }
  }

  closeForm() {
    if (this.saving) return;
    this.formOpen = false;
    this.editingUser = null;
  }

  async saveUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';

    try {
      const values = this.userForm.getRawValue();
      // Admin tem acesso a tudo — a lista de permissões fica vazia (é ignorada).
      const permissions: ModuleKey[] = values.role === 'admin'
        ? []
        : Array.from(this.selectedPermissions);

      if (this.editingUser) {
        await firstValueFrom(this.userService.updateUser(this.editingUser.id, {
          name: values.name,
          role: values.role,
          status: values.status,
          permissions
        }));
        this.showSuccess('Usuário atualizado com sucesso.');
      } else {
        await firstValueFrom(this.userService.createUser({
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role,
          status: values.status,
          permissions
        }));
        this.showSuccess('Usuário criado com sucesso.');
      }

      this.formOpen = false;
      this.editingUser = null;
      this.loadUsers();
    } catch (err: any) {
      const message = this.translateFirebaseError(err);
      this.error = message;
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  deleteUser(user: User) {
    if (!confirm(`Excluir o usuário "${user.name}"? A conta no Firebase Auth precisará ser removida manualmente no console.`)) {
      return;
    }

    this.deletingId = user.id;
    this.userService.deleteUser(user.id).pipe(finalize(() => this.deletingId = null)).subscribe({
      next: () => {
        this.showSuccess('Usuário excluído com sucesso.');
        this.loadUsers();
      },
      error: err => {
        this.error = err?.message || 'Erro ao excluir usuário.';
        this.cdr.detectChanges();
      }
    });
  }

  isFieldInvalid(name: string): boolean {
    const control = this.userForm.get(name);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private showSuccess(message: string) {
    this.feedback = message;
    this.error = '';
    this.cdr.detectChanges();
    setTimeout(() => {
      this.feedback = '';
      this.cdr.detectChanges();
    }, 2500);
  }

  private translateFirebaseError(err: any): string {
    const code = err?.code || '';
    const map: Record<string, string> = {
      'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
      'auth/operation-not-allowed': 'Cadastro por e-mail/senha não está habilitado no Firebase.'
    };
    return map[code] || err?.message || 'Erro ao salvar usuário.';
  }
}
