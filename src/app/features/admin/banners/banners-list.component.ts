import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { finalize, firstValueFrom, timeout } from 'rxjs';
import { Banner } from '../../../core/models/banner.model';
import { BannerService } from '../../../core/services/banner.service';
import { TripService } from '../../../core/services/trip.service';
import { Trip } from '../../../core/models/trip.model';
import { tripCanonicalPath } from '../../../core/utils/trip-scope';
import { UploadService } from '../../../core/services/upload.service';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';
import { SavingOverlayComponent } from '../../../shared/components/saving-overlay/saving-overlay.component';
import { UnsavedChangesModalComponent, UnsavedAction } from '../../../shared/components/unsaved-changes-modal/unsaved-changes-modal.component';

@Component({
  selector: 'app-banners-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropModule, ImageUploadComponent, SavingOverlayComponent, UnsavedChangesModalComponent],
  template: `
    <section class="af-page">
      <header class="af-page-header">
        <div>
          <h1 class="af-page-header__title">Banners da home</h1>
          <p class="af-page-header__subtitle">Configure o carrossel principal exibido aos visitantes.</p>
        </div>
        <div class="af-page-header__actions">
          <button class="af-btn af-btn--primary" type="button" (click)="openForm()">
            + Novo banner
          </button>
        </div>
      </header>

      @if (error) {
        <div class="af-alert af-alert--error">
          <span class="af-alert__icon">!</span>
          <span>{{ error }}</span>
        </div>
      }

      @if (feedback) {
        <div class="af-alert af-alert--success">
          <span class="af-alert__icon">✓</span>
          <span>{{ feedback }}</span>
        </div>
      }

      @if (loading) {
        <div class="af-loading">
          <div class="af-spinner"></div>
          <p>Carregando banners...</p>
        </div>
      } @else if (banners.length === 0) {
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <circle cx="8" cy="10" r="1.5"/>
              <path d="M21 16l-5-5-9 8"/>
            </svg>
          </div>
          <h3>Nenhum banner cadastrado</h3>
          <p>Adicione imagens para o carrossel da home.</p>
          <button class="af-btn af-btn--primary" type="button" (click)="openForm()">
            + Adicionar primeiro banner
          </button>
        </div>
      } @else {
        <p class="banners-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="5 9 2 12 5 15"/>
            <polyline points="9 5 12 2 15 5"/>
            <polyline points="15 19 12 22 9 19"/>
            <polyline points="19 9 22 12 19 15"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="12" y1="2" x2="12" y2="22"/>
          </svg>
          Arraste os banners para reordenar — a ordem define como aparecem no carrossel da home.
        </p>
        <div class="banner-list" cdkDropList (cdkDropListDropped)="onBannerDrop($event)">
          @for (banner of banners; track banner.id) {
            <div class="banner-row" cdkDrag [cdkDragData]="banner">
              <div class="banner-row__placeholder" *cdkDragPlaceholder></div>

              <button type="button" class="banner-row__handle" cdkDragHandle title="Arrastar para reordenar" aria-label="Arrastar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                  <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                </svg>
              </button>

              <span class="banner-row__position">{{ $index + 1 }}</span>

              <img class="banner-row__thumb" [src]="banner.imageUrl" [alt]="banner.title">

              <div class="banner-row__info">
                <strong>{{ banner.title }}</strong>
                @if (banner.subtitle) {
                  <span class="muted">{{ banner.subtitle }}</span>
                }
              </div>

              <span class="status-pill" [class.is-active]="banner.status === 'active'">
                {{ banner.status === 'active' ? 'Ativo' : 'Inativo' }}
              </span>

              <div class="banner-row__actions">
                <button class="af-btn af-btn--ghost af-btn--sm" type="button" (click)="openForm(banner)">Editar</button>
                <button class="af-btn af-btn--danger af-btn--sm" type="button" (click)="deleteBanner(banner)" [disabled]="deletingId === banner.id">
                  {{ deletingId === banner.id ? 'Excluindo...' : 'Excluir' }}
                </button>
              </div>
            </div>
          }
        </div>

        @if (reordering) {
          <p class="banners-saving-order">
            <span class="af-spinner af-spinner--small"></span>
            Salvando nova ordem...
          </p>
        }
      }
    </section>

    @if (formOpen) {
      <div class="af-modal-overlay" (click)="closeForm()">
        <form class="af-modal" [formGroup]="bannerForm" (ngSubmit)="saveBanner()" (click)="$event.stopPropagation()">
          <div class="af-modal__header">
            <div>
              <h2 class="af-modal__title">{{ editingBanner ? 'Editar banner' : 'Novo banner' }}</h2>
              <p class="af-modal__subtitle">Configure imagem, link e visibilidade.</p>
            </div>
            <button class="af-modal__close" type="button" (click)="closeForm()" aria-label="Fechar">✕</button>
          </div>

          <div class="af-grid af-grid--2">
            <div class="af-field af-field--span-2">
              <label class="af-label">Título <span class="af-label__required">*</span></label>
              <input class="af-control" formControlName="title" placeholder="Ex: Peregrinação Terra Santa">
            </div>

            <div class="af-field af-field--span-2">
              <label class="af-label">Subtítulo <span class="af-label__optional">opcional</span></label>
              <input class="af-control" formControlName="subtitle" placeholder="Texto secundário do banner">
            </div>

            <div class="af-field af-field--span-2">
              <label class="af-label">Status</label>
              <select class="af-control" formControlName="status">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>

          <app-image-upload
            label="Imagem do banner (desktop) *"
            helper="Recomendado 1920×720. Será enviada ao Firebase Storage ao salvar."
            [cropRatio]="1920/720"
            formControlName="imageUrl">
          </app-image-upload>

          <app-image-upload
            label="Imagem do banner (celular)"
            helper="Arte vertical recomendada 1080×1350. Em telas pequenas o carrossel troca para esta imagem — o título, subtítulo e botão continuam os mesmos. Se ficar em branco, a arte de desktop é usada sem cortes."
            aspectRatio="portrait"
            [cropRatio]="1080/1350"
            formControlName="imageUrlMobile">
          </app-image-upload>

          <div class="af-grid af-grid--2">
            <div class="af-field af-field--span-2">
              <label class="af-label">Botão de direcionamento <span class="af-label__optional">opcional</span></label>
              <p class="af-hint">Escolha para onde o banner leva ao clicar. Deixe em "Nenhum" para um banner sem botão.</p>
              <select class="af-control" formControlName="link">
                <option value="">Nenhum (banner sem botão)</option>
                @for (g of routeGroups; track g.group) {
                  <optgroup [label]="g.group">
                    @for (opt of g.options; track opt.value) {
                      <option [value]="opt.value">{{ opt.label }}</option>
                    }
                  </optgroup>
                }
              </select>
            </div>

            @if (bannerForm.get('link')?.value) {
              <div class="af-field af-field--span-2">
                <label class="af-label">Texto do botão</label>
                <input class="af-control" formControlName="buttonText" placeholder="Ex: Saiba mais, Ver roteiro, Reservar">
                <p class="af-hint">Se vazio, o botão mostra "Saiba mais".</p>
              </div>
            }
          </div>

          @if (saving && savingStep) {
            <div class="af-alert af-alert--info">
              <span class="af-alert__icon">i</span>
              <span>{{ savingStep }}</span>
            </div>
          }

          <div class="af-actions">
            <button class="af-btn af-btn--secondary" type="button" (click)="closeForm()" [disabled]="saving">Cancelar</button>
            <button class="af-btn af-btn--primary" type="submit" [disabled]="bannerForm.invalid || saving">
              {{ saving ? 'Salvando...' : 'Salvar banner' }}
            </button>
          </div>
        </form>
      </div>
    }

    <app-saving-overlay
      [show]="saving"
      [title]="editingBanner ? 'Atualizando banner...' : 'Criando banner...'"
      [message]="savingStep || 'Aguarde enquanto salvamos o banner.'">
    </app-saving-overlay>

    <app-unsaved-changes-modal
      [show]="unsavedModalOpen"
      [canSave]="canSubmit()"
      [changedFields]="changedFields"
      (resolved)="onUnsavedResolved($event)">
    </app-unsaved-changes-modal>
  `,
  styleUrl: './banners-list.component.scss'
})
export class BannersListComponent implements OnInit {
  banners: Banner[] = [];
  bannerForm: FormGroup;
  loading = false;
  saving = false;
  savingStep = '';
  formOpen = false;
  error = '';
  feedback = '';
  editingBanner: Banner | null = null;
  deletingId: number | null = null;
  unsavedModalOpen = false;
  changedFields: string[] = [];
  reordering = false;

  /** Opções de rota para o botão do banner (rotas fixas + viagens cadastradas). */
  routeOptions: Array<{ label: string; value: string; group: string }> = [];

  private readonly fieldLabels: Record<string, string> = {
    title: 'Título',
    subtitle: 'Subtítulo',
    imageUrl: 'Imagem (desktop)',
    imageUrlMobile: 'Imagem (celular)',
    status: 'Status',
    link: 'Link do botão',
    buttonText: 'Texto do botão'
  };

  constructor(
    private fb: FormBuilder,
    private bannerService: BannerService,
    private tripService: TripService,
    private uploadService: UploadService,
    private cdr: ChangeDetectorRef
  ) {
    this.bannerForm = this.fb.group({
      title: ['', [Validators.required]],
      subtitle: [''],
      imageUrl: ['', [Validators.required]],
      imageUrlMobile: [''],
      status: ['active', [Validators.required]],
      link: [''],
      buttonText: ['']
    });
  }

  ngOnInit() {
    this.loadBanners();
    this.loadRouteOptions();
  }

  /** Monta as opções de rota: páginas fixas + cada viagem ativa pelo path canônico. */
  private loadRouteOptions() {
    const fixed = [
      { label: 'Home', value: '/', group: 'Páginas' },
      { label: 'Viagens (listagem)', value: '/viagens', group: 'Páginas' },
      { label: 'Blog', value: '/blog', group: 'Páginas' },
      { label: 'Sobre', value: '/sobre/sobre-a-unitur', group: 'Páginas' },
      { label: 'Contato', value: '/contato', group: 'Páginas' }
    ];
    this.routeOptions = [...fixed];

    this.tripService.getTrips({ status: 'active', limit: 100 }).subscribe(res => {
      const trips = (res.data || []).filter(t => t.slug || t.title);
      const tripOpts = trips.map((t: Trip) => ({
        label: t.title,
        value: tripCanonicalPath(t),
        group: 'Viagens'
      }));
      this.routeOptions = [...fixed, ...tripOpts];
      this.cdr.detectChanges();
    });
  }

  /** Agrupa as opções por categoria para o <optgroup> do select. */
  get routeGroups(): Array<{ group: string; options: Array<{ label: string; value: string }> }> {
    const groups: Record<string, Array<{ label: string; value: string }>> = {};
    for (const opt of this.routeOptions) {
      (groups[opt.group] ||= []).push({ label: opt.label, value: opt.value });
    }
    return Object.entries(groups).map(([group, options]) => ({ group, options }));
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

  private showError(message: string) {
    this.error = message;
    this.feedback = '';
    this.cdr.detectChanges();
  }

  loadBanners() {
    this.loading = true;
    this.error = '';
    this.bannerService.getBanners().subscribe({
      next: banners => {
        this.banners = banners;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = err?.message || 'Erro ao carregar banners.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openForm(banner?: Banner) {
    this.formOpen = true;
    this.editingBanner = banner || null;
    this.bannerForm.reset({
      title: banner?.title || '',
      subtitle: banner?.subtitle || '',
      imageUrl: banner?.imageUrl || '',
      imageUrlMobile: banner?.imageUrlMobile || '',
      status: banner?.status || 'active',
      link: banner?.link || '',
      buttonText: banner?.buttonText || ''
    });
    this.bannerForm.markAsPristine();
  }

  async onBannerDrop(event: CdkDragDrop<Banner[]>) {
    if (event.previousIndex === event.currentIndex) return;

    moveItemInArray(this.banners, event.previousIndex, event.currentIndex);
    this.reordering = true;
    this.cdr.detectChanges();

    try {
      const ids = this.banners.map(b => b.id);
      await firstValueFrom(this.bannerService.reorderBanners(ids).pipe(timeout(20000)));
      this.showSuccess('Ordem dos banners atualizada.');
    } catch (err: any) {
      this.showError(err?.message || 'Erro ao salvar nova ordem dos banners.');
    } finally {
      this.reordering = false;
      this.cdr.detectChanges();
    }
  }

  closeForm(force = false) {
    if (this.saving) return;
    if (!force && this.bannerForm.dirty) {
      this.changedFields = this.computeChangedFields();
      this.unsavedModalOpen = true;
      return;
    }
    this.formOpen = false;
    this.editingBanner = null;
  }

  canSubmit(): boolean {
    return this.bannerForm.valid;
  }

  async onUnsavedResolved(action: UnsavedAction) {
    this.unsavedModalOpen = false;
    if (action === 'cancel') return;
    if (action === 'discard') {
      this.bannerForm.markAsPristine();
      this.closeForm(true);
      return;
    }
    if (action === 'save') {
      this.saveBanner();
    }
  }

  private computeChangedFields(): string[] {
    const labels: string[] = [];
    Object.keys(this.bannerForm.controls).forEach(name => {
      if (this.bannerForm.get(name)?.dirty) {
        labels.push(this.fieldLabels[name] || name);
      }
    });
    return labels;
  }

  async saveBanner() {
    if (this.bannerForm.invalid) {
      this.bannerForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';
    this.savingStep = 'Salvando banner...';

    try {
      const { imageUrl, imageUrlMobile, ...rest } = this.bannerForm.value;
      const imageFile = imageUrl instanceof File ? imageUrl : null;
      const mobileFile = imageUrlMobile instanceof File ? imageUrlMobile : null;

      const baseData: Partial<Banner> = {
        ...rest,
        imageUrl: imageFile ? '' : String(imageUrl || ''),
        // Arquivo novo entra em branco agora e recebe a URL após o upload; string vazia
        // (imagem removida) precisa ser gravada para limpar a arte mobile antiga.
        imageUrlMobile: mobileFile ? '' : String(imageUrlMobile || '')
      };

      const saved = this.editingBanner
        ? await firstValueFrom(this.bannerService.updateBanner(this.editingBanner.id, baseData))
        : await firstValueFrom(this.bannerService.createBanner(baseData));

      const bannerIdToUse = saved?.id || this.editingBanner?.id;

      if ((imageFile || mobileFile) && bannerIdToUse) {
        this.savingStep = 'Enviando imagens para o Firebase Storage...';
        try {
          const urls: Partial<Banner> = {};

          if (imageFile) {
            const uploaded = await firstValueFrom(
              this.uploadService.uploadToEntity(imageFile, 'banners', bannerIdToUse).pipe(timeout(45000))
            );
            urls.imageUrl = uploaded.url;
          }

          if (mobileFile) {
            const uploaded = await firstValueFrom(
              this.uploadService.uploadToEntity(mobileFile, 'banners', bannerIdToUse).pipe(timeout(45000))
            );
            urls.imageUrlMobile = uploaded.url;
          }

          await firstValueFrom(this.bannerService.updateBanner(bannerIdToUse, urls));
        } catch (uploadErr: any) {
          this.error = `Banner salvo, mas falhou o upload da imagem: ${uploadErr?.message || 'erro desconhecido'}.`;
          console.error('Upload error', uploadErr);
          this.saving = false;
          this.savingStep = '';
          this.loadBanners();
          return;
        }
      }

      this.saving = false;
      this.savingStep = '';
      this.bannerForm.markAsPristine();
      this.closeForm(true);
      this.loadBanners();
      this.showSuccess(this.editingBanner ? 'Banner atualizado com sucesso.' : 'Banner criado com sucesso.');
    } catch (err: any) {
      this.saving = false;
      this.savingStep = '';
      this.showError(err?.message || 'Erro ao salvar banner.');
    }
  }

  deleteBanner(banner: Banner) {
    if (!confirm(`Excluir o banner "${banner.title}"?`)) {
      return;
    }

    this.deletingId = banner.id;
    this.bannerService.deleteBanner(banner.id).pipe(finalize(() => this.deletingId = null)).subscribe({
      next: () => {
        this.loadBanners();
        this.showSuccess('Banner excluído com sucesso.');
      },
      error: err => this.showError(err?.message || 'Erro ao excluir banner.')
    });
  }
}
