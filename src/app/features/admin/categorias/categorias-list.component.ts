import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, from, of, switchMap, timeout } from 'rxjs';
import { Category } from '../../../core/models/post.model';
import { AuthService } from '../../../core/services/auth.service';
import { CategoryService } from '../../../core/services/category.service';
import { SavingOverlayComponent } from '../../../shared/components/saving-overlay/saving-overlay.component';
import { UnsavedChangesModalComponent, UnsavedAction } from '../../../shared/components/unsaved-changes-modal/unsaved-changes-modal.component';

@Component({
  selector: 'app-categorias-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SavingOverlayComponent, UnsavedChangesModalComponent],
  template: `
    <section class="af-page">
      <header class="af-page-header">
        <div>
          <h1 class="af-page-header__title">Categorias</h1>
          <p class="af-page-header__subtitle">Organize posts e viagens por tipo de conteúdo.</p>
        </div>
        <div class="af-page-header__actions">
          <button class="af-btn af-btn--primary" type="button" (click)="openForm()">
            + Nova categoria
          </button>
        </div>
      </header>

      @if (error) {
        <div class="af-alert af-alert--error">
          <span class="af-alert__icon">!</span>
          <span>{{ error }}</span>
        </div>
      }

      @if (loading) {
        <div class="af-loading">
          <div class="af-spinner"></div>
          <p>Carregando categorias...</p>
        </div>
      } @else if (categories.length === 0) {
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </div>
          <h3>Nenhuma categoria cadastrada</h3>
          <p>Crie categorias para organizar posts e viagens.</p>
          <button class="af-btn af-btn--primary" type="button" (click)="openForm()">+ Adicionar primeira categoria</button>
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
                  <td><code class="slug-pill">{{ category.slug }}</code></td>
                  <td><span class="type-pill" [attr.data-type]="category.type">{{ getTypeLabel(category.type) }}</span></td>
                  <td class="muted">{{ category.description || '—' }}</td>
                  <td>
                    <div class="row-actions">
                      <button class="af-btn af-btn--ghost af-btn--sm" type="button" (click)="openForm(category)">Editar</button>
                      <button class="af-btn af-btn--danger af-btn--sm" type="button" (click)="deleteCategory(category)" [disabled]="deletingId === category.id">
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
    </section>

    @if (formOpen) {
      <div class="af-modal-overlay" (click)="closeForm()">
        <form class="af-modal" [formGroup]="categoryForm" (ngSubmit)="saveCategory()" (click)="$event.stopPropagation()">
          <div class="af-modal__header">
            <div>
              <h2 class="af-modal__title">{{ editingCategory ? 'Editar categoria' : 'Nova categoria' }}</h2>
              <p class="af-modal__subtitle">Use categorias para organizar e filtrar conteúdo.</p>
            </div>
            <button class="af-modal__close" type="button" (click)="closeForm()" aria-label="Fechar">✕</button>
          </div>

          <div class="af-grid af-grid--2">
            <div class="af-field">
              <label class="af-label">Nome <span class="af-label__required">*</span></label>
              <input class="af-control" type="text" formControlName="name" placeholder="Ex: Dicas de viagem">
            </div>

            <div class="af-field">
              <label class="af-label">Slug <span class="af-label__required">*</span></label>
              <div class="af-input-group">
                <span class="af-input-group__addon">/</span>
                <input class="af-control" type="text" formControlName="slug" placeholder="dicas-de-viagem">
              </div>
            </div>

            <div class="af-field">
              <label class="af-label">Tipo</label>
              <select class="af-control" formControlName="type">
                <option value="blog">Blog</option>
                <option value="trip">Viagens</option>
                <option value="both">Blog e viagens</option>
              </select>
            </div>

            <div class="af-field">
              <label class="af-label">Cor de destaque</label>
              <input class="af-control af-control--color" type="color" formControlName="color">
              <span class="af-hint">Aparece como marca da categoria.</span>
            </div>
          </div>

          <div class="af-field">
            <label class="af-label">Descrição <span class="af-label__optional">opcional</span></label>
            <textarea class="af-control af-control--textarea" rows="3" formControlName="description" placeholder="Descrição que aparece nas páginas de categoria."></textarea>
          </div>

          <div class="af-actions">
            <button class="af-btn af-btn--secondary" type="button" (click)="closeForm()" [disabled]="saving">Cancelar</button>
            <button class="af-btn af-btn--primary" type="submit" [disabled]="categoryForm.invalid || saving">
              {{ saving ? 'Salvando...' : (editingCategory ? 'Atualizar' : 'Criar categoria') }}
            </button>
          </div>
        </form>
      </div>
    }

    <app-saving-overlay
      [show]="saving"
      [title]="editingCategory ? 'Atualizando categoria...' : 'Criando categoria...'"
      message="Aguarde enquanto salvamos a categoria.">
    </app-saving-overlay>

    <app-unsaved-changes-modal
      [show]="unsavedModalOpen"
      [canSave]="canSubmit()"
      [changedFields]="changedFields"
      (resolved)="onUnsavedResolved($event)">
    </app-unsaved-changes-modal>
  `,
  styleUrl: './categorias-list.component.scss'
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
  unsavedModalOpen = false;
  changedFields: string[] = [];

  private readonly fieldLabels: Record<string, string> = {
    name: 'Nome',
    slug: 'Slug',
    type: 'Tipo',
    description: 'Descrição',
    color: 'Cor'
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
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
    this.categoryForm.markAsPristine();
  }

  closeForm(force = false) {
    if (!force && this.categoryForm.dirty && !this.saving) {
      this.changedFields = this.computeChangedFields();
      this.unsavedModalOpen = true;
      return;
    }

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

  canSubmit(): boolean {
    return this.categoryForm.valid;
  }

  async onUnsavedResolved(action: UnsavedAction) {
    this.unsavedModalOpen = false;
    if (action === 'cancel') return;
    if (action === 'discard') {
      this.categoryForm.markAsPristine();
      this.closeForm(true);
      return;
    }
    if (action === 'save') {
      this.saveCategory();
    }
  }

  private computeChangedFields(): string[] {
    const labels: string[] = [];
    Object.keys(this.categoryForm.controls).forEach(name => {
      if (this.categoryForm.get(name)?.dirty) {
        labels.push(this.fieldLabels[name] || name);
      }
    });
    return labels;
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
        this.categoryForm.markAsPristine();
        this.closeForm(true);
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
