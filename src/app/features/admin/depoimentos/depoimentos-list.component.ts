import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, firstValueFrom } from 'rxjs';
import { Testimonial } from '../../../core/models/testimonial.model';
import { TestimonialService } from '../../../core/services/testimonial.service';
import { UploadService } from '../../../core/services/upload.service';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';

@Component({
  selector: 'app-depoimentos-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageUploadComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Depoimentos</h1>
        <button class="btn-primary" type="button" (click)="openForm()">+ Novo Depoimento</button>
      </div>

      @if (error) {
        <div class="alert-error">{{ error }}</div>
      }

      @if (loading) {
        <div class="empty-state"><h3>Carregando depoimentos...</h3></div>
      } @else if (testimonials.length === 0) {
        <div class="empty-state">
          <span class="empty-icon">TXT</span>
          <h3>Nenhum depoimento cadastrado</h3>
          <p>Adicione feedback de clientes satisfeitos.</p>
        </div>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Texto</th>
                <th>Avaliação</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (testimonial of testimonials; track testimonial.id) {
                <tr>
                  <td>
                    <div class="client-cell">
                      @if (testimonial.clientPhoto) {
                        <img [src]="testimonial.clientPhoto" [alt]="testimonial.clientName">
                      } @else {
                        <span>{{ testimonial.clientName.slice(0, 1).toUpperCase() }}</span>
                      }
                      <strong>{{ testimonial.clientName }}</strong>
                    </div>
                  </td>
                  <td>{{ testimonial.text }}</td>
                  <td>{{ testimonial.rating }}/5</td>
                  <td>{{ getStatusLabel(testimonial.status) }}</td>
                  <td>
                    <div class="row-actions">
                      <button class="btn-small" type="button" (click)="openForm(testimonial)">Editar</button>
                      <button class="btn-small danger" type="button" (click)="deleteTestimonial(testimonial)" [disabled]="deletingId === testimonial.id">
                        {{ deletingId === testimonial.id ? 'Excluindo...' : 'Excluir' }}
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
        <form class="modal-card" [formGroup]="testimonialForm" (ngSubmit)="saveTestimonial()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingTestimonial ? 'Editar depoimento' : 'Novo depoimento' }}</h2>
            <button class="btn-close" type="button" (click)="closeForm()">X</button>
          </div>
          <div class="form-grid">
            <label><span class="field-label">Nome do cliente <span class="required">*</span></span><input class="form-control" formControlName="clientName"></label>
            <label>E-mail <input class="form-control" type="email" formControlName="clientEmail"></label>
            <label>Avaliação <input class="form-control" type="number" min="1" max="5" formControlName="rating"></label>
            <label>Status
              <select class="form-control" formControlName="status">
                <option value="pending">Pendente</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Rejeitado</option>
              </select>
            </label>
          </div>
          <app-image-upload label="Foto do cliente" formControlName="clientPhoto"></app-image-upload>
          <label><span class="field-label">Depoimento <span class="required">*</span></span><textarea class="form-control" rows="5" formControlName="text"></textarea></label>
          <div class="form-actions">
            <button class="btn-secondary" type="button" (click)="closeForm()" [disabled]="saving">Cancelar</button>
            <button class="btn-primary" type="submit" [disabled]="testimonialForm.invalid || saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
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
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #edf0f2; vertical-align: top; }
    th { color: #6C757D; font-size: 0.78rem; text-transform: uppercase; background: #F8F9FA; }
    .client-cell { display: flex; align-items: center; gap: 0.75rem; min-width: 180px; }
    .client-cell img, .client-cell span { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex: none; }
    .client-cell span { display: inline-flex; align-items: center; justify-content: center; background: #eef3f8; color: #3a75c3; font-weight: 800; }
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
    textarea.form-control { resize: vertical; }
    .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    @media (max-width: 760px) { .page-header, .form-actions { flex-direction: column; align-items: stretch; } .form-grid { grid-template-columns: 1fr; } }
  `]
})
export class DepoimentosListComponent implements OnInit {
  testimonials: Testimonial[] = [];
  testimonialForm: FormGroup;
  loading = false;
  saving = false;
  formOpen = false;
  error = '';
  editingTestimonial: Testimonial | null = null;
  deletingId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private testimonialService: TestimonialService,
    private uploadService: UploadService,
    private cdr: ChangeDetectorRef
  ) {
    this.testimonialForm = this.fb.group({
      clientName: ['', [Validators.required]],
      clientEmail: [''],
      clientPhoto: [''],
      text: ['', [Validators.required]],
      rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      status: ['approved', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadTestimonials();
  }

  loadTestimonials() {
    this.loading = true;
    this.error = '';
    this.testimonialService.getTestimonials({ limit: 100 }).pipe(finalize(() => {
      this.loading = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: response => this.testimonials = response.data,
      error: err => this.error = err?.message || 'Erro ao carregar depoimentos.'
    });
  }

  openForm(testimonial?: Testimonial) {
    this.formOpen = true;
    this.editingTestimonial = testimonial || null;
    this.testimonialForm.reset({
      clientName: testimonial?.clientName || '',
      clientEmail: testimonial?.clientEmail || '',
      clientPhoto: testimonial?.clientPhoto || '',
      text: testimonial?.text || '',
      rating: testimonial?.rating || 5,
      status: testimonial?.status || 'approved'
    });
  }

  closeForm() {
    if (!this.saving) {
      this.formOpen = false;
      this.editingTestimonial = null;
    }
  }

  async saveTestimonial() {
    if (this.testimonialForm.invalid) {
      this.testimonialForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';

    try {
      const value = {
        ...this.testimonialForm.value,
        clientPhoto: await this.uploadImageValue(this.testimonialForm.value.clientPhoto)
      };
      const request = this.editingTestimonial
        ? this.testimonialService.updateTestimonial(this.editingTestimonial.id, value)
        : this.testimonialService.createTestimonial(value);

      await firstValueFrom(request);
      this.saving = false;
      this.closeForm();
      this.loadTestimonials();
    } catch (err: any) {
      this.error = err?.message || 'Erro ao salvar depoimento.';
      this.saving = false;
    }
  }

  private async uploadImageValue(value: unknown): Promise<string> {
    if (value instanceof File) {
      return (await firstValueFrom(this.uploadService.uploadImage(value))).url;
    }

    return String(value || '');
  }

  deleteTestimonial(testimonial: Testimonial) {
    if (!confirm(`Excluir o depoimento de "${testimonial.clientName}"?`)) {
      return;
    }

    this.deletingId = testimonial.id;
    this.testimonialService.deleteTestimonial(testimonial.id).pipe(finalize(() => this.deletingId = null)).subscribe({
      next: () => this.loadTestimonials(),
      error: err => this.error = err?.message || 'Erro ao excluir depoimento.'
    });
  }

  getStatusLabel(status: Testimonial['status']) {
    const labels: Record<Testimonial['status'], string> = {
      pending: 'Pendente',
      approved: 'Aprovado',
      rejected: 'Rejeitado'
    };
    return labels[status];
  }
}
