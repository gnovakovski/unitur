import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Banner } from '../../../core/models/banner.model';
import { BannerService } from '../../../core/services/banner.service';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';

@Component({
  selector: 'app-banners-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageUploadComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Banners</h1>
        <button class="btn-primary" type="button" (click)="openForm()">+ Novo Banner</button>
      </div>

      @if (error) {
        <div class="alert-error">{{ error }}</div>
      }

      @if (loading) {
        <div class="empty-state"><h3>Carregando banners...</h3></div>
      } @else if (banners.length === 0) {
        <div class="empty-state">
          <span class="empty-icon">IMG</span>
          <h3>Nenhum banner cadastrado</h3>
          <p>Adicione imagens para o carrossel da home.</p>
        </div>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>Imagem</th>
                <th>Título</th>
                <th>Ordem</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (banner of banners; track banner.id) {
                <tr>
                  <td><img class="thumb" [src]="banner.imageUrl" [alt]="banner.title"></td>
                  <td>
                    <strong>{{ banner.title }}</strong>
                    <span>{{ banner.subtitle || '-' }}</span>
                  </td>
                  <td>{{ banner.order }}</td>
                  <td>{{ banner.status === 'active' ? 'Ativo' : 'Inativo' }}</td>
                  <td>
                    <div class="row-actions">
                      <button class="btn-small" type="button" (click)="openForm(banner)">Editar</button>
                      <button class="btn-small danger" type="button" (click)="deleteBanner(banner)" [disabled]="deletingId === banner.id">
                        {{ deletingId === banner.id ? 'Excluindo...' : 'Excluir' }}
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

    @if (formOpen) {
      <div class="modal-overlay" (click)="closeForm()">
        <form class="modal-card" [formGroup]="bannerForm" (ngSubmit)="saveBanner()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingBanner ? 'Editar banner' : 'Novo banner' }}</h2>
            <button class="btn-close" type="button" (click)="closeForm()">X</button>
          </div>
          <div class="form-grid">
            <label>Título <span class="required">*</span><input class="form-control" formControlName="title"></label>
            <label>Subtítulo <input class="form-control" formControlName="subtitle"></label>
            <label>Link <input class="form-control" formControlName="link"></label>
            <label>Texto do botão <input class="form-control" formControlName="buttonText"></label>
            <label>Ordem <input class="form-control" type="number" formControlName="order"></label>
            <label>Status
              <select class="form-control" formControlName="status">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
          </div>
          <app-image-upload label="Imagem do banner *" formControlName="imageUrl"></app-image-upload>
          <div class="form-actions">
            <button class="btn-secondary" type="button" (click)="closeForm()" [disabled]="saving">Cancelar</button>
            <button class="btn-primary" type="submit" [disabled]="bannerForm.invalid || saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    .page-container { max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .page-header h1 { font-size: 2rem; color: #1a1a2e; margin: 0; }
    .btn-primary, .btn-secondary, .btn-small { border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-primary { padding: 0.75rem 1.5rem; background: #ff812c; color: white; }
    .btn-secondary { padding: 0.75rem 1.25rem; background: #f0f0f0; color: #333; }
    .btn-small { padding: 0.5rem 0.75rem; background: #eef3f8; color: #3a75c3; white-space: nowrap; }
    .btn-small.danger { background: #ffebee; color: #c62828; }
    .alert-error { margin-bottom: 1rem; padding: 1rem; background: #ffebee; color: #c62828; border-radius: 8px; }
    .empty-state, .table-card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .empty-state { text-align: center; padding: 4rem 2rem; }
    .empty-icon { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 16px; background: #eef3f8; color: #3a75c3; font-weight: 800; margin-bottom: 1rem; }
    .table-card { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #edf0f2; vertical-align: middle; }
    th { color: #6C757D; font-size: 0.78rem; text-transform: uppercase; background: #F8F9FA; }
    td strong, td span { display: block; }
    td span { color: #6C757D; font-size: 0.88rem; margin-top: 0.2rem; }
    .thumb { width: 96px; height: 54px; object-fit: cover; border-radius: 8px; background: #f0f0f0; }
    .row-actions { display: flex; gap: 0.5rem; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1400; background: rgba(0,0,0,0.45); display: grid; place-items: start center; padding: 6rem 1rem 2rem; overflow-y: auto; }
    .modal-card { width: min(760px, 100%); max-height: calc(100vh - 8rem); overflow: auto; background: white; border-radius: 16px; padding: 1.5rem; display: grid; gap: 1rem; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .modal-header h2 { margin: 0; color: #1a1a2e; }
    .btn-close { border: none; background: #f0f0f0; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    label { display: grid; gap: 0.5rem; color: #333; font-weight: 600; font-size: 0.9rem; }
    .field-label { display: inline-flex; align-items: baseline; gap: 0.2rem; width: fit-content; white-space: nowrap; }
    .required { color: #c62828; }
    .form-control { width: 100%; border: 1px solid #e0e0e0; border-radius: 8px; padding: 0.75rem 1rem; font: inherit; }
    .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    @media (max-width: 760px) { .page-header, .form-actions { flex-direction: column; align-items: stretch; } .form-grid { grid-template-columns: 1fr; } }
  `]
})
export class BannersListComponent implements OnInit {
  banners: Banner[] = [];
  bannerForm: FormGroup;
  loading = false;
  saving = false;
  formOpen = false;
  error = '';
  editingBanner: Banner | null = null;
  deletingId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private bannerService: BannerService,
    private cdr: ChangeDetectorRef
  ) {
    this.bannerForm = this.fb.group({
      title: ['', [Validators.required]],
      subtitle: [''],
      imageUrl: ['', [Validators.required]],
      link: [''],
      buttonText: [''],
      order: [0],
      status: ['active', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadBanners();
  }

  loadBanners() {
    this.loading = true;
    this.error = '';
    this.bannerService.getBanners().pipe(finalize(() => {
      this.loading = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: banners => this.banners = banners,
      error: err => this.error = err?.message || 'Erro ao carregar banners.'
    });
  }

  openForm(banner?: Banner) {
    this.formOpen = true;
    this.editingBanner = banner || null;
    this.bannerForm.reset({
      title: banner?.title || '',
      subtitle: banner?.subtitle || '',
      imageUrl: banner?.imageUrl || '',
      link: banner?.link || '',
      buttonText: banner?.buttonText || '',
      order: banner?.order || 0,
      status: banner?.status || 'active'
    });
  }

  closeForm() {
    if (!this.saving) {
      this.formOpen = false;
      this.editingBanner = null;
    }
  }

  saveBanner() {
    if (this.bannerForm.invalid) {
      this.bannerForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const request = this.editingBanner
      ? this.bannerService.updateBanner(this.editingBanner.id, this.bannerForm.value)
      : this.bannerService.createBanner(this.bannerForm.value);

    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: () => {
        this.closeForm();
        this.loadBanners();
      },
      error: err => this.error = err?.message || 'Erro ao salvar banner.'
    });
  }

  deleteBanner(banner: Banner) {
    if (!confirm(`Excluir o banner "${banner.title}"?`)) {
      return;
    }

    this.deletingId = banner.id;
    this.bannerService.deleteBanner(banner.id).pipe(finalize(() => this.deletingId = null)).subscribe({
      next: () => this.loadBanners(),
      error: err => this.error = err?.message || 'Erro ao excluir banner.'
    });
  }
}
