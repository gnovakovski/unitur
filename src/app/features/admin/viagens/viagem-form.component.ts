import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Trip } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { UploadService } from '../../../core/services/upload.service';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';

@Component({
  selector: 'app-viagem-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageUploadComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>{{ isEditMode ? 'Editar viagem' : 'Nova viagem' }}</h1>
          <p>Preencha os dados que ser?o exibidos na home e na vitrine de viagens.</p>
        </div>
      </div>

      @if (error) {
        <div class="alert-error">{{ error }}</div>
      }

      <form class="form-card" [formGroup]="tripForm" (ngSubmit)="saveTrip()">
        <div class="form-grid">
          <label>
            <span class="field-label">Nome da viagem <span class="required">*</span></span>
            <input class="form-control" formControlName="title" placeholder="Ex: Terra Santa">
          </label>

          <label>
            <span class="field-label">Tipo <span class="required">*</span></span>
            <select class="form-control" formControlName="tripType">
              <option value="peregrinacao">Viagens de Peregrinação</option>
              <option value="regular">Viagens Regulares</option>
              <option value="curadoria">Viagens de Curadoria</option>
            </select>
          </label>

          <label>
            <span class="field-label">País principal <span class="required">*</span></span>
            <input class="form-control" formControlName="country" placeholder="Ex: Israel">
          </label>

          <label>
            <span class="field-label">Período <span class="required">*</span></span>
            <input class="form-control" formControlName="period" placeholder="Ex: Junho 2026">
          </label>

          <label>
            <span class="field-label">Data de embarque <span class="required">*</span></span>
            <input class="form-control" type="date" formControlName="startDate">
          </label>

          <label>
            <span class="field-label">Dias <span class="required">*</span></span>
            <input class="form-control" type="number" formControlName="duration" min="1">
          </label>

          <label>
            <span class="field-label">Vagas <span class="required">*</span></span>
            <input class="form-control" type="number" formControlName="availableSpots" min="0">
          </label>

          <label>
            <span class="field-label">Preço <span class="required">*</span></span>
            <input class="form-control" type="number" formControlName="price" min="1">
          </label>

          <label>
            Valor em moeda estrangeira
            <input class="form-control" formControlName="foreignPrice" placeholder="Ex: U$4.500,00">
          </label>

          <label>
            <span class="field-label">Status <span class="required">*</span></span>
            <select class="form-control" formControlName="status">
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
            </select>
          </label>
        </div>

        <div class="form-grid">
          <label>
            Guia espiritual
            <input class="form-control" formControlName="spiritualGuide" placeholder="Ex: Pe. Joao Batista">
          </label>

          <label>
            Coordenador
            <input class="form-control" formControlName="coordinator" placeholder="Ex: Ana Silva">
          </label>

          <label>
            Mostrar quantidade de vagas
            <select class="form-control" formControlName="showAvailableSpots">
              <option [ngValue]="true">Sim</option>
              <option [ngValue]="false">Não</option>
            </select>
          </label>

          <app-image-upload label="Imagem principal" formControlName="mainImage"></app-image-upload>
        </div>

        <label>
          <span class="field-label">Chamada curta <span class="required">*</span></span>
          <textarea class="form-control" rows="3" formControlName="shortDescription" placeholder="Resumo para cards e curadoria"></textarea>
        </label>

        <label>
          <span class="field-label">Descrição completa <span class="required">*</span></span>
          <textarea class="form-control" rows="5" formControlName="description" placeholder="Descrição da viagem"></textarea>
        </label>

        <div class="form-grid wide">
          <label>
            Imagens da experiencia
            <app-image-upload label="Selecionar imagem da experiência" formControlName="experienceImageUpload"></app-image-upload>
            <textarea class="form-control" rows="4" formControlName="experienceImagesText" placeholder="As imagens enviadas aparecem aqui automaticamente"></textarea>
          </label>

          <label>
            Roteiro
            <textarea class="form-control" rows="4" formControlName="itinerary" placeholder="Use uma linha por dia ou etapa"></textarea>
          </label>
        </div>

        <div class="form-grid wide">
          <label>
            Hotéis do grupo
            <app-image-upload label="Selecionar imagem do hotel" formControlName="hotelImageUpload"></app-image-upload>
            <textarea class="form-control" rows="4" formControlName="hotelsText" placeholder="Imagem do hotel | Nome do hotel"></textarea>
          </label>

          <label>
            Formas de pagamento
            <textarea class="form-control" rows="4" formControlName="paymentMethodsText" placeholder="Uma forma de pagamento por linha"></textarea>
          </label>
        </div>

        <div class="form-grid wide">
          <label>
            Incluso
            <textarea class="form-control" rows="4" formControlName="includedText" placeholder="Um item por linha"></textarea>
          </label>

          <label>
            Não incluso
            <textarea class="form-control" rows="4" formControlName="notIncludedText" placeholder="Um item por linha"></textarea>
          </label>
        </div>

        <label>
          Política de cancelamento
          <textarea class="form-control" rows="4" formControlName="cancellationPolicy" placeholder="Política padrão de cancelamento"></textarea>
        </label>

        <div class="form-actions">
          <button class="btn-secondary" type="button" (click)="cancel()" [disabled]="saving">Cancelar</button>
          <button class="btn-primary" type="submit" [disabled]="!canSaveTrip || saving">
            {{ saving ? 'Salvando...' : 'Salvar viagem' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1200px; }
    .page-header { margin-bottom: 2rem; }
    .page-header h1 { color: #1a1a2e; margin: 0 0 0.35rem; font-size: 2rem; }
    .page-header p { color: #6C757D; margin: 0; }
    .alert-error { margin-bottom: 1rem; padding: 1rem; background: #ffebee; color: #c62828; border-radius: 18px; }
    .form-card { background: white; border-radius: 24px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: grid; gap: 1rem; }
    .form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .form-grid.wide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    label { display: grid; gap: 0.35rem; color: #333; font-size: 0.9rem; font-weight: 700; align-content: start; }
    .field-label { display: inline-flex; align-items: baseline; gap: 0.2rem; width: fit-content; white-space: nowrap; min-height: 1.2rem; }
    .form-control { width: 100%; border: 1px solid #e0e0e0; border-radius: 12px; padding: 0.75rem 0.9rem; font: inherit; }
    textarea.form-control { resize: vertical; }
    .form-control:focus { outline: none; border-color: #ff812c; box-shadow: 0 0 0 3px rgba(255,129,44,0.1); }
    .required { color: #c62828; }
    .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
    .btn-primary, .btn-secondary { border: none; border-radius: 999px; padding: 0.85rem 1.5rem; font: inherit; font-weight: 800; cursor: pointer; }
    .btn-primary { background: #ff812c; color: white; }
    .btn-secondary { background: #f0f0f0; color: #333; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    @media (max-width: 980px) { .form-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 680px) { .form-grid { grid-template-columns: 1fr; } .form-actions { flex-direction: column; } }
  `]
})
export class ViagemFormComponent implements OnInit {
  tripForm: FormGroup;
  isEditMode = false;
  tripId: number | null = null;
  saving = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private tripService: TripService,
    private uploadService: UploadService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.tripForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      tripType: ['peregrinacao', [Validators.required]],
      country: ['', [Validators.required]],
      period: ['', [Validators.required]],
      startDate: ['', [Validators.required]],
      duration: [1, [Validators.required, Validators.min(1)]],
      availableSpots: [0, [Validators.required, Validators.min(0)]],
      price: ['', [Validators.required, Validators.min(1)]],
      foreignPrice: [''],
      status: ['active', [Validators.required]],
      spiritualGuide: [''],
      coordinator: [''],
      showAvailableSpots: [true],
      mainImage: [''],
      shortDescription: ['', [Validators.required]],
      description: ['', [Validators.required]],
      experienceImageUpload: [''],
      experienceImagesText: [''],
      hotelImageUpload: [''],
      hotelsText: [''],
      itinerary: [''],
      paymentMethodsText: [''],
      includedText: [''],
      notIncludedText: [''],
      cancellationPolicy: ['']
    });
  }


  get canSaveTrip(): boolean {
    const requiredFields = ['title', 'tripType', 'country', 'period', 'startDate', 'duration', 'availableSpots', 'price', 'status', 'shortDescription', 'description'];
    return requiredFields.every(fieldName => this.tripForm.get(fieldName)?.valid);
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.tripId = Number(id);
      this.loadTrip(this.tripId);
    }
  }

  loadTrip(id: number) {
    this.tripService.getTrip(id).subscribe({
      next: trip => {
        this.tripForm.patchValue({
          title: trip.title,
          tripType: trip.tripType || 'regular',
          country: trip.country || trip.destination,
          period: trip.period || '',
          startDate: this.formatDateInput(trip.startDate),
          duration: trip.duration,
          availableSpots: trip.availableSpots,
          price: trip.price,
          foreignPrice: trip.foreignPrice || '',
          status: trip.status,
          spiritualGuide: trip.spiritualGuide || '',
          coordinator: trip.coordinator || '',
          showAvailableSpots: trip.showAvailableSpots !== false,
          mainImage: trip.mainImage || '',
          shortDescription: trip.shortDescription || '',
          description: trip.description || '',
          experienceImagesText: (trip.experienceImages || trip.gallery || []).join('\n'),
          hotelsText: (trip.hotels || []).map(hotel => `${hotel.image} | ${hotel.name}`).join('\n'),
          itinerary: trip.itinerary || '',
          paymentMethodsText: (trip.paymentMethods || []).join('\n'),
          includedText: (trip.included || []).join('\n'),
          notIncludedText: (trip.notIncluded || []).join('\n'),
          cancellationPolicy: trip.cancellationPolicy || ''
        });
      },
      error: err => {
        this.error = err?.message || 'Erro ao carregar viagem.';
      }
    });
  }

  async saveTrip() {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';

    try {
      const value = this.tripForm.value;
      const {
        experienceImagesText,
        experienceImageUpload,
        hotelsText,
        hotelImageUpload,
        paymentMethodsText,
        includedText,
        notIncludedText,
        ...baseValue
      } = value;
      const uploadedExperienceImage = await this.uploadOptionalImage(experienceImageUpload);
      const uploadedHotelImage = await this.uploadOptionalImage(hotelImageUpload);
      const experienceImages = [
        ...this.parseLines(experienceImagesText),
        uploadedExperienceImage
      ].filter(Boolean) as string[];
      const hotels = this.parseHotels([
        hotelsText,
        uploadedHotelImage ? `${uploadedHotelImage} | ` : ''
      ].filter(Boolean).join('\n'));
      const now = new Date();
      const startDate = value.startDate ? new Date(`${value.startDate}T00:00:00`) : now;
      const tripData: Partial<Trip> = {
        ...baseValue,
        mainImage: await this.uploadImageValue(baseValue.mainImage),
        destination: value.country,
        categoryId: 0,
        startDate,
        endDate: startDate,
        featured: value.tripType === 'curadoria',
        experienceImages,
        gallery: experienceImages,
        hotels,
        paymentMethods: this.parseLines(paymentMethodsText),
        included: this.parseLines(includedText),
        notIncluded: this.parseLines(notIncludedText)
      };

      const request = this.isEditMode && this.tripId
        ? this.tripService.updateTrip(this.tripId, tripData)
        : this.tripService.createTrip(tripData);

      await firstValueFrom(request);
      this.router.navigate(['/admin/viagens']);
    } catch (err: any) {
      this.error = err?.message || 'Erro ao salvar viagem. Verifique permiss?o do Firestore.';
    } finally {
      this.saving = false;
    }
  }

  cancel() {
    this.router.navigate(['/admin/viagens']);
  }

  private parseLines(value: string): string[] {
    return String(value || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private parseHotels(value: string): Array<{ name: string; image: string }> {
    return this.parseLines(value).map(line => {
      const [image = '', name = ''] = line.split('|').map(item => item.trim());
      return { image, name: name || image };
    });
  }

  private async uploadImageValue(value: unknown): Promise<string> {
    if (value instanceof File) {
      return (await firstValueFrom(this.uploadService.uploadImage(value))).url;
    }

    return String(value || '');
  }

  private async uploadOptionalImage(value: unknown): Promise<string> {
    if (!value) {
      return '';
    }

    return this.uploadImageValue(value);
  }

  private formatDateInput(date?: Date): string {
    if (!date) {
      return '';
    }

    const parsedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return parsedDate.toISOString().slice(0, 10);
  }
}
