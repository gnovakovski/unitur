import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, from, of, switchMap, timeout } from 'rxjs';
import { Category } from '../../../core/models/post.model';
import { AuthService } from '../../../core/services/auth.service';
import { CategoryService } from '../../../core/services/category.service';

@Component({
  selector: 'app-categorias-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Categorias</h1>
          <p>Organize posts e viagens por tipo de conteúdo.</p>
        </div>
        <button class="btn-primary" type="button" (click)="openForm()">
          <span>+</span> Nova Categoria
        </button>
      </div>

      @if (error) {
        <div class="alert-error">{{ error }}</div>
      }

      @if (formOpen) {
        <div class="modal-overlay" (click)="closeForm()">
        <form class="form-card modal-card" [formGroup]="categoryForm" (ngSubmit)="saveCategory()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingCategory ? 'Editar categoria' : 'Nova categoria' }}</h2>
            <button class="btn-close" type="button" (click)="closeForm()">X</button>
          </div>
          <div class="form-grid">
            <label>
              Nome
              <input class="form-control" type="text" formControlName="name" placeholder="Ex: Dicas de viagem">
            </label>

            <label>
              Slug
              <input class="form-control" type="text" formControlName="slug" placeholder="dicas-de-viagem">
            </label>

            <label>
              Tipo
              <select class="form-control" formControlName="type">
                <option value="blog">Blog</option>
                <option value="trip">Viagens</option>
                <option value="both">Blog e viagens</option>
              </select>
            </label>

            <label>
              Cor
              <input class="form-control" type="color" formControlName="color">
            </label>
          </div>

          <label>
            Descrição
            <textarea class="form-control" rows="3" formControlName="description" placeholder="Descrição opcional"></textarea>
          </label>

          <div class="form-actions">
            <button class="btn-secondary" type="button" (click)="closeForm()" [disabled]="saving">Cancelar</button>
            <button class="btn-primary" type="submit" [disabled]="categoryForm.invalid || saving">
              {{ saving ? 'Salvando...' : (editingCategory ? 'Atualizar' : 'Criar') }}
            </button>
          </div>
        </form>
        </div>
      }

      @if (loading) {
        <div class="empty-state">
          <span class="empty-icon">...</span>
          <h3>Carregando categorias</h3>
        </div>
      } @else if (categories.length === 0) {
        <div class="empty-state">
          <span class="empty-icon">#</span>
          <h3>Nenhuma categoria cadastrada</h3>
          <p>Crie categorias para organizar posts e viagens.</p>
        </div>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Slug</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (category of categories; track category.id) {
                <tr>
                  <td>
                    <div class="name-cell">
                      <span class="color-dot" [style.background]="category.color || '#ff812c'"></span>
                      {{ category.name }}
                    </div>
                  </td>
                  <td>{{ category.slug }}</td>
                  <td>{{ getTypeLabel(category.type) }}</td>
                  <td>{{ category.description || '-' }}</td>
                  <td>
                    <div class="row-actions">
                      <button class="btn-small" type="button" (click)="openForm(category)">Editar</button>
                      <button class="btn-small danger" type="button" (click)="deleteCategory(category)" [disabled]="deletingId === category.id">
                        {{ deletingId === category.id ? 'Excluindo...' : 'Excluir' }}
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .page-container { width: 100%; max-width: none; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; }
    .page-header h1 { font-size: 2rem; color: #1a1a2e; margin: 0 0 0.35rem; }
    .page-header p { color: #6C757D; margin: 0; }
    .btn-primary, .btn-secondary, .btn-small { border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-primary { padding: 0.75rem 1.5rem; background: #ff812c; color: white; display: inline-flex; align-items: center; gap: 0.5rem; }
    .btn-primary:hover:not(:disabled) { background: #e67424; }
    .btn-secondary { padding: 0.75rem 1.25rem; background: #f0f0f0; color: #333; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .alert-error { margin-bottom: 1rem; padding: 1rem; background: #ffebee; color: #c62828; border-radius: 8px; }
    .form-card, .table-card, .empty-state { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
    .form-card { padding: 1.5rem; margin-bottom: 1.5rem; display: grid; gap: 1rem; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1400; background: rgba(0,0,0,0.45); display: grid; place-items: start center; padding: 6rem 1rem 2rem; overflow-y: auto; }
    .modal-card { width: min(760px, 100%); max-height: calc(100vh - 8rem); overflow: auto; margin-bottom: 0; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .modal-header h2 { margin: 0; color: #1a1a2e; }
    .btn-close { border: none; background: #f0f0f0; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; }
    .form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    label { display: grid; gap: 0.5rem; color: #333; font-weight: 600; font-size: 0.9rem; }
    .form-control { width: 100%; padding: 0.75rem 1rem; border: 1px solid #e0e0e0; border-radius: 8px; font: inherit; }
    .form-control:focus { outline: none; border-color: #ff812c; box-shadow: 0 0 0 3px rgba(255, 129, 44, 0.1); }
    input[type="color"].form-control { padding: 0.25rem; height: 46px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
    .empty-state { text-align: center; padding: 4rem 2rem; }
    .empty-icon { font-size: 3rem; display: block; margin-bottom: 1rem; color: #ff812c; font-weight: 800; }
    .empty-state h3 { color: #1a1a2e; margin-bottom: 0.5rem; }
    .empty-state p { color: #6C757D; }
    .table-card { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #edf0f2; vertical-align: top; }
    th { color: #6C757D; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; background: #F8F9FA; }
    .name-cell { display: flex; align-items: center; gap: 0.65rem; font-weight: 700; color: #1a1a2e; }
    .color-dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; }
    .row-actions { display: flex; gap: 0.5rem; }
    .btn-small { padding: 0.5rem 0.75rem; background: #eef3f8; color: #3a75c3; white-space: nowrap; }
    .btn-small.danger { background: #ffebee; color: #c62828; }
    @media (max-width: 900px) {
      .page-header { flex-direction: column; }
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class CategoriasListComponent implements OnInit {
  categories: Category[] = [];
  categoryForm: FormGroup;
  loading = false;
  saving = false;
  formOpen = false;
  error = '';
  editingCategory: Category | null = null;
  deletingId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      slug: ['', [Validators.required]],
      type: ['blog', [Validators.required]],
      description: [''],
      color: ['#ff812c']
    });
  }

  ngOnInit() {
    this.loadCategories();
    this.setupSlugGeneration();
  }

  loadCategories() {
    this.loading = true;
    this.error = '';

    from(this.authService.waitForAuthenticatedUser()).pipe(
      switchMap(isAuthenticated => {
        if (!isAuthenticated) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        return this.categoryService.getAllCategories();
      }),
      timeout(12000),
      catchError((err) => {
        console.error('Erro ao carregar categorias', err);
        this.error = err?.message || 'Erro ao carregar categorias. Verifique as regras e conexão do Firestore.';
        return of([]);
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe(categories => {
      this.categories = categories;
      this.cdr.detectChanges();
    });
  }

  openForm(category?: Category) {
    this.formOpen = true;
    this.error = '';
    this.editingCategory = category || null;

    if (category) {
      this.categoryForm.patchValue({
        name: category.name,
        slug: category.slug,
        type: category.type,
        description: category.description || '',
        color: category.color || '#ff812c'
      });
    } else {
      this.categoryForm.reset({
        name: '',
        slug: '',
        type: 'blog',
        description: '',
        color: '#ff812c'
      });
    }
  }

  closeForm() {
    this.formOpen = false;
    this.editingCategory = null;
    this.categoryForm.reset({
      name: '',
      slug: '',
      type: 'blog',
      description: '',
      color: '#ff812c'
    });
  }

  saveCategory() {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';
    const value = this.categoryForm.value;
    const request = this.editingCategory
      ? this.categoryService.updateCategory(this.editingCategory.id, value)
      : this.categoryService.createCategory(value);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.closeForm();
        this.loadCategories();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erro ao salvar categoria. Verifique as permissões do Firestore.';
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteCategory(category: Category) {
    if (!confirm(`Excluir a categoria "${category.name}"?`)) {
      return;
    }

    this.deletingId = category.id;
    this.error = '';

    this.categoryService.deleteCategory(category.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.loadCategories();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erro ao excluir categoria. Verifique as permissões do Firestore.';
        this.deletingId = null;
        this.cdr.detectChanges();
      }
    });
  }

  getTypeLabel(type: Category['type']) {
    const labels: Record<Category['type'], string> = {
      blog: 'Blog',
      trip: 'Viagens',
      both: 'Blog e viagens'
    };

    return labels[type];
  }

  private setupSlugGeneration() {
    this.categoryForm.get('name')?.valueChanges.subscribe(name => {
      if (!this.editingCategory && name) {
        this.categoryForm.patchValue({
          slug: this.categoryService.generateSlug(name)
        }, { emitEvent: false });
      }
    });
  }
}



