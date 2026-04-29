import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Trip } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';

@Component({
  selector: 'app-viagem-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>{{ isEditMode ? 'Editar viagem' : 'Nova viagem' }}</h1>
          <p>Preencha os dados que serao exibidos na home e na vitrine de viagens.</p>
        </div>
      </div>

      @if (error) {
        <div class="alert-error">{{ error }}</div>
      }

      <form class="form-card" [formGroup]="tripForm" (ngSubmit)="saveTrip()">
        <div class="form-grid">
          <label>
            Nome da viagem
            <input class="form-control" formControlName="title" placeholder="Ex: Terra Santa">
          </label>

          <label>
            Tipo
            <select class="form-control" formControlName="tripType">
              <option value="peregrinacao">Viagens de Peregrinacao</option>
              <option value="regular">Viagens Regulares</option>
              <option value="curadoria">Viagens de Curadoria</option>
            </select>
          </label>

          <label>
            Pais principal
            <input class="form-control" formControlName="country" placeholder="Ex: Israel">
          </label>

          <label>
            Periodo
            <input class="form-control" formControlName="period" placeholder="Ex: Junho 2026">
          </label>

          <label>
            Dias
            <input class="form-control" type="number" formControlName="duration" min="1">
          </label>

          <label>
            Vagas
            <input class="form-control" type="number" formControlName="availableSpots" min="0">
          </label>

          <label>
            Preco
            <input class="form-control" type="number" formControlName="price" min="0">
          </label>

          <label>
            Status
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
            Operadora
            <input class="form-control" formControlName="operator" placeholder="Unitur">
          </label>

          <label>
            Imagem principal
            <input class="form-control" formControlName="mainImage" placeholder="URL da imagem">
          </label>
        </div>

        <label>
          Chamada curta
          <textarea class="form-control" rows="3" formControlName="shortDescription" placeholder="Resumo para cards e curadoria"></textarea>
        </label>

        <label>
          Descricao completa
          <textarea class="form-control" rows="5" formControlName="description" placeholder="Descricao da viagem"></textarea>
        </label>

        <div class="form-actions">
          <button class="btn-secondary" type="button" (click)="cancel()" [disabled]="saving">Cancelar</button>
          <button class="btn-primary" type="submit" [disabled]="tripForm.invalid || saving">
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
    .form-card { background: white; border-radius: 24px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: grid; gap: 1.25rem; }
    .form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    label { display: grid; gap: 0.5rem; color: #333; font-size: 0.9rem; font-weight: 700; }
    .form-control { width: 100%; border: 1px solid #e0e0e0; border-radius: 18px; padding: 0.8rem 1rem; font: inherit; }
    textarea.form-control { resize: vertical; }
    .form-control:focus { outline: none; border-color: #ff812c; box-shadow: 0 0 0 3px rgba(255,129,44,0.1); }
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
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.tripForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      tripType: ['peregrinacao', [Validators.required]],
      country: ['', [Validators.required]],
      period: ['', [Validators.required]],
      duration: [1, [Validators.required, Validators.min(1)]],
      availableSpots: [0, [Validators.required, Validators.min(0)]],
      price: [0, [Validators.required, Validators.min(0)]],
      status: ['active', [Validators.required]],
      spiritualGuide: [''],
      coordinator: [''],
      operator: ['Unitur'],
      mainImage: [''],
      shortDescription: [''],
      description: ['']
    });
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
          duration: trip.duration,
          availableSpots: trip.availableSpots,
          price: trip.price,
          status: trip.status,
          spiritualGuide: trip.spiritualGuide || '',
          coordinator: trip.coordinator || '',
          operator: trip.operator || 'Unitur',
          mainImage: trip.mainImage || '',
          shortDescription: trip.shortDescription || '',
          description: trip.description || ''
        });
      },
      error: err => {
        this.error = err?.message || 'Erro ao carregar viagem.';
      }
    });
  }

  saveTrip() {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';
    const value = this.tripForm.value;
    const now = new Date();
    const tripData: Partial<Trip> = {
      ...value,
      destination: value.country,
      categoryId: 0,
      startDate: now,
      endDate: now,
      featured: value.tripType === 'curadoria'
    };

    const request = this.isEditMode && this.tripId
      ? this.tripService.updateTrip(this.tripId, tripData)
      : this.tripService.createTrip(tripData);

    request.pipe(
      finalize(() => {
        this.saving = false;
      })
    ).subscribe({
      next: () => this.router.navigate(['/admin/viagens']),
      error: err => {
        this.error = err?.message || 'Erro ao salvar viagem. Verifique permissao do Firestore.';
      }
    });
  }

  cancel() {
    this.router.navigate(['/admin/viagens']);
  }
}
