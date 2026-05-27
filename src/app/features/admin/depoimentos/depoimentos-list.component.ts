import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, firstValueFrom, timeout } from 'rxjs';
import { Testimonial } from '../../../core/models/testimonial.model';
import { TestimonialService } from '../../../core/services/testimonial.service';
import { UploadService } from '../../../core/services/upload.service';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';
import { SavingOverlayComponent } from '../../../shared/components/saving-overlay/saving-overlay.component';
import { UnsavedChangesModalComponent, UnsavedAction } from '../../../shared/components/unsaved-changes-modal/unsaved-changes-modal.component';

@Component({
  selector: 'app-depoimentos-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageUploadComponent, SavingOverlayComponent, UnsavedChangesModalComponent],
  template: `
    <section class="af-page">
      <header class="af-page-header">
        <div>
          <h1 class="af-page-header__title">Depoimentos</h1>
          <p class="af-page-header__subtitle">Gerencie a vitrine de feedbacks dos clientes.</p>
        </div>
        <div class="af-page-header__actions">
          <button class="af-btn af-btn--primary" type="button" (click)="openForm()">
            + Novo depoimento
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
          <p>Carregando depoimentos...</p>
        </div>
      } @else if (testimonials.length === 0) {
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </div>
          <h3>Nenhum depoimento cadastrado</h3>
          <p>Adicione feedback de clientes satisfeitos.</p>
          <button class="af-btn af-btn--primary" type="button" (click)="openForm()">+ Adicionar depoimento</button>
        </div>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Depoimento</th>
                <th>Nota</th>
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
                        <span class="avatar-fallback">{{ testimonial.clientName.slice(0, 1).toUpperCase() }}</span>
                      }
                      <div>
                        <strong>{{ testimonial.clientName }}</strong>
                        @if (testimonial.clientEmail) {
                          <span class="muted">{{ testimonial.clientEmail }}</span>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="testimonial-text">{{ testimonial.text }}</td>
                  <td>
                    <div class="rating">
                      @for (n of [1,2,3,4,5]; track n) {
                        <span class="star" [class.is-active]="n <= testimonial.rating">★</span>
                      }
                    </div>
                  </td>
                  <td>
                    <span class="status-pill" [attr.data-status]="testimonial.status">
                      {{ getStatusLabel(testimonial.status) }}
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button class="af-btn af-btn--ghost af-btn--sm" type="button" (click)="openForm(testimonial)">Editar</button>
                      <button class="af-btn af-btn--danger af-btn--sm" type="button" (click)="deleteTestimonial(testimonial)" [disabled]="deletingId === testimonial.id">
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
    </section>

    @if (formOpen) {
      <div class="af-modal-overlay" (click)="closeForm()">
        <form class="af-modal" [formGroup]="testimonialForm" (ngSubmit)="saveTestimonial()" (click)="$event.stopPropagation()">
          <div class="af-modal__header">
            <div>
              <h2 class="af-modal__title">{{ editingTestimonial ? 'Editar depoimento' : 'Novo depoimento' }}</h2>
              <p class="af-modal__subtitle">Adicione um feedback que será exibido no site.</p>
            </div>
            <button class="af-modal__close" type="button" (click)="closeForm()" aria-label="Fechar">✕</button>
          </div>

          <div class="af-grid af-grid--2">
            <div class="af-field">
              <label class="af-label">Nome do cliente <span class="af-label__required">*</span></label>
              <input class="af-control" formControlName="clientName" placeholder="Ex: Maria das Graças">
            </div>

            <div class="af-field">
              <label class="af-label">E-mail <span class="af-label__optional">opcional</span></label>
              <input class="af-control" type="email" formControlName="clientEmail" placeholder="cliente@email.com">
            </div>

            <div class="af-field">
              <label class="af-label">Avaliação <span class="af-label__required">*</span></label>
              <div class="rating-input">
                @for (n of [1,2,3,4,5]; track n) {
                  <button
                    type="button"
                    class="rating-input__star"
                    [class.is-active]="n <= (testimonialForm.get('rating')?.value || 0)"
                    (click)="setRating(n)"
                    [attr.aria-label]="n + ' estrelas'">
                    ★
                  </button>
                }
                <span class="rating-input__value">{{ testimonialForm.get('rating')?.value || 0 }}/5</span>
              </div>
            </div>

            <div class="af-field">
              <label class="af-label">Status</label>
              <select class="af-control" formControlName="status">
                <option value="pending">Pendente</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Rejeitado</option>
              </select>
            </div>
          </div>

          <app-image-upload
            label="Foto do cliente (opcional)"
            helper="Ideal em formato quadrado. Será gravada no Storage ao salvar."
            aspectRatio="square"
            [cropRatio]="1"
            [compact]="true"
            formControlName="clientPhoto">
          </app-image-upload>

          <div class="af-field">
            <label class="af-label">Depoimento <span class="af-label__required">*</span></label>
            <textarea class="af-control af-control--textarea" rows="5" formControlName="text" placeholder="Texto do depoimento do cliente"></textarea>
          </div>

          @if (saving && savingStep) {
            <div class="af-alert af-alert--info">
              <span class="af-alert__icon">i</span>
              <span>{{ savingStep }}</span>
            </div>
          }

          <div class="af-actions">
            <button class="af-btn af-btn--secondary" type="button" (click)="closeForm()" [disabled]="saving">Cancelar</button>
            <button class="af-btn af-btn--primary" type="submit" [disabled]="testimonialForm.invalid || saving">
              {{ saving ? 'Salvando...' : 'Salvar depoimento' }}
            </button>
          </div>
        </form>
      </div>
    }

    <app-saving-overlay
      [show]="saving"
      [title]="editingTestimonial ? 'Atualizando depoimento...' : 'Criando depoimento...'"
      [message]="savingStep || 'Aguarde enquanto salvamos o depoimento.'">
    </app-saving-overlay>

    <app-unsaved-changes-modal
      [show]="unsavedModalOpen"
      [canSave]="canSubmit()"
      [changedFields]="changedFields"
      (resolved)="onUnsavedResolved($event)">
    </app-unsaved-changes-modal>
  `,
  styleUrl: './depoimentos-list.component.scss'
})
export class DepoimentosListComponent implements OnInit {
  testimonials: Testimonial[] = [];
  testimonialForm: FormGroup;
  loading = false;
  saving = false;
  savingStep = '';
  formOpen = false;
  error = '';
  editingTestimonial: Testimonial | null = null;
  deletingId: number | null = null;
  unsavedModalOpen = false;
  changedFields: string[] = [];

  private readonly fieldLabels: Record<string, string> = {
    clientName: 'Nome do cliente',
    clientEmail: 'E-mail',
    clientPhoto: 'Foto',
    text: 'Depoimento',
    rating: 'Avaliação',
    status: 'Status'
  };

  constructor(
    private fb: FormBuilder,
    private testimonialService: TestimonialService,
    private uploadService: UploadService,
    private cdr: ChangeDetectorRef
  ) {
    this.testimonialForm = this.fb.group({
      clientName: ['', [Validators.required, Validators.minLength(2)]],
      clientEmail: ['', [Validators.email]],
      clientPhoto: [''],
      text: ['', [Validators.required, Validators.minLength(10)]],
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
    this.testimonialForm.markAsPristine();
  }

  closeForm(force = false) {
    if (this.saving) return;
    if (!force && this.testimonialForm.dirty) {
      this.changedFields = this.computeChangedFields();
      this.unsavedModalOpen = true;
      return;
    }
    this.formOpen = false;
    this.editingTestimonial = null;
  }

  canSubmit(): boolean {
    return this.testimonialForm.valid;
  }

  async onUnsavedResolved(action: UnsavedAction) {
    this.unsavedModalOpen = false;
    if (action === 'cancel') return;
    if (action === 'discard') {
      this.testimonialForm.markAsPristine();
      this.closeForm(true);
      return;
    }
    if (action === 'save') {
      this.saveTestimonial();
    }
  }

  setRating(value: number) {
    const ctrl = this.testimonialForm.get('rating');
    ctrl?.setValue(value);
    ctrl?.markAsDirty();
  }

  private computeChangedFields(): string[] {
    const labels: string[] = [];
    Object.keys(this.testimonialForm.controls).forEach(name => {
      if (this.testimonialForm.get(name)?.dirty) {
        labels.push(this.fieldLabels[name] || name);
      }
    });
    return labels;
  }

  async saveTestimonial() {
    if (this.testimonialForm.invalid) {
      this.testimonialForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';
    this.savingStep = 'Salvando depoimento...';

    try {
      const { clientPhoto, ...rest } = this.testimonialForm.value;
      const photoFile = clientPhoto instanceof File ? clientPhoto : null;
      const existingPhoto = clientPhoto instanceof File ? '' : String(clientPhoto || '');

      const baseData: Partial<Testimonial> = {
        ...rest,
        clientPhoto: existingPhoto
      };

      const saved = this.editingTestimonial
        ? await firstValueFrom(this.testimonialService.updateTestimonial(this.editingTestimonial.id, baseData))
        : await firstValueFrom(this.testimonialService.createTestimonial(baseData));

      const idToUse = saved?.id || this.editingTestimonial?.id;

      if (photoFile && idToUse) {
        this.savingStep = 'Enviando foto para o Firebase Storage...';
        try {
          const uploaded = await firstValueFrom(
            this.uploadService.uploadToEntity(photoFile, 'depoimentos', idToUse).pipe(timeout(45000))
          );
          await firstValueFrom(this.testimonialService.updateTestimonial(idToUse, { clientPhoto: uploaded.url }));
        } catch (uploadErr: any) {
          this.error = `Depoimento salvo, mas falhou o upload da foto: ${uploadErr?.message || 'erro desconhecido'}.`;
          console.error('Upload error', uploadErr);
          this.saving = false;
          this.savingStep = '';
          this.loadTestimonials();
          return;
        }
      }

      this.saving = false;
      this.savingStep = '';
      this.testimonialForm.markAsPristine();
      this.closeForm(true);
      this.loadTestimonials();
    } catch (err: any) {
      this.error = err?.message || 'Erro ao salvar depoimento.';
      this.saving = false;
      this.savingStep = '';
    }
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
