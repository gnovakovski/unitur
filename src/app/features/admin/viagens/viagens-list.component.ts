import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, firstValueFrom, from, of, switchMap, timeout } from 'rxjs';
import { Trip } from '../../../core/models/trip.model';
import { AuthService } from '../../../core/services/auth.service';
import { TripService } from '../../../core/services/trip.service';
import { CurrencyEntry, ExchangeRateService } from '../../../core/services/exchange-rate.service';

@Component({
  selector: 'app-viagens-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: './viagens-list.component.html',
  styleUrl: './viagens-list.component.scss'
})
export class ViagensListComponent implements OnInit {
  trips: Trip[] = [];
  loading = false;
  error = '';
  deletingId: number | null = null;
  searchTerm = '';
  typeFilter = '';
  statusFilter = '';
  brokenImages = new Set<number>();

  // ---------- Modal de câmbio ----------
  exchangeModalOpen = false;
  exchangeForm: FormGroup;
  exchangeSaving = false;
  exchangeSaved = false;
  exchangeError = '';
  exchangeUpdatedAt: Date | null = null;

  constructor(
    private authService: AuthService,
    private tripService: TripService,
    private exchangeRateService: ExchangeRateService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.exchangeForm = this.fb.group({
      currencies: this.fb.array([])
    });
  }

  ngOnInit() {
    this.loadTrips();
  }

  get currencyControls(): FormArray {
    return this.exchangeForm.get('currencies') as FormArray;
  }

  openExchangeModal() {
    this.exchangeError = '';
    this.exchangeSaved = false;
    this.exchangeRateService.loadRates().subscribe(rates => {
      this.currencyControls.clear();
      rates.currencies.forEach(c => this.currencyControls.push(this.buildCurrencyGroup(c)));
      if (this.currencyControls.length === 0) {
        this.addCurrency();
      }
      this.exchangeUpdatedAt = rates.updatedAt || null;
      this.exchangeModalOpen = true;
      this.cdr.detectChanges();
    });
  }

  closeExchangeModal() {
    if (this.exchangeSaving) return;
    this.exchangeModalOpen = false;
  }

  addCurrency() {
    this.currencyControls.push(this.buildCurrencyGroup({ code: '', name: '', symbol: '', rate: null }));
    this.cdr.detectChanges();
  }

  removeCurrency(index: number) {
    if (this.currencyControls.length <= 0) return;
    this.currencyControls.removeAt(index);
    this.cdr.detectChanges();
  }

  async saveExchangeRates() {
    if (this.exchangeSaving) return;

    // Valida códigos únicos antes de salvar
    const codes = this.currencyControls.controls
      .map(c => String(c.get('code')?.value || '').toUpperCase().trim())
      .filter(Boolean);
    const uniques = new Set(codes);
    if (uniques.size !== codes.length) {
      this.exchangeError = 'Códigos de moeda duplicados. Use códigos diferentes (ex.: USD, EUR, ARS).';
      return;
    }
    if (this.exchangeForm.invalid) {
      this.exchangeForm.markAllAsTouched();
      this.exchangeError = 'Preencha código e nome de cada moeda.';
      return;
    }

    this.exchangeSaving = true;
    this.exchangeError = '';
    this.exchangeSaved = false;
    this.cdr.detectChanges();

    try {
      const payload: CurrencyEntry[] = this.currencyControls.controls.map(group => ({
        code: String(group.get('code')?.value || '').toUpperCase().trim(),
        name: String(group.get('name')?.value || '').trim(),
        symbol: String(group.get('symbol')?.value || '').trim() || undefined,
        rate: this.parseRate(group.get('rate')?.value)
      }));
      const saved = await firstValueFrom(this.exchangeRateService.saveRates(payload));
      this.exchangeUpdatedAt = saved.updatedAt || new Date();
      this.exchangeSaved = true;
      setTimeout(() => {
        this.exchangeSaved = false;
        this.exchangeModalOpen = false;
        this.cdr.detectChanges();
      }, 1200);
    } catch (err: any) {
      this.exchangeError = err?.message || 'Erro ao salvar cotações.';
    } finally {
      this.exchangeSaving = false;
      this.cdr.detectChanges();
    }
  }

  private buildCurrencyGroup(c: Partial<CurrencyEntry>): FormGroup {
    return this.fb.group({
      code: [(c.code || '').toUpperCase(), [Validators.required, Validators.maxLength(6)]],
      name: [c.name || '', [Validators.required]],
      symbol: [c.symbol || ''],
      rate: [c.rate ?? '']
    });
  }

  private parseRate(value: string | number | null): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  loadTrips() {
    this.loading = true;
    this.error = '';

    from(this.authService.waitForAuthenticatedUser()).pipe(
      switchMap(isAuthenticated => {
        if (!isAuthenticated) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        return this.tripService.getTrips({ limit: 100 });
      }),
      timeout(12000),
      catchError((err) => {
        console.error('Erro ao carregar viagens', err);
        this.error = err?.message || 'Erro ao carregar viagens. Verifique login e regras do Firestore.';
        return of({ data: [], total: 0, page: 1, limit: 100, totalPages: 1 });
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe(response => {
      this.trips = response.data;
      this.cdr.detectChanges();
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.typeFilter = '';
    this.statusFilter = '';
  }

  deleteTrip(trip: Trip) {
    if (!confirm(`Excluir a viagem "${trip.title}"?`)) {
      return;
    }

    this.deletingId = trip.id;
    this.tripService.deleteTrip(trip.id).pipe(
      finalize(() => {
        this.deletingId = null;
      })
    ).subscribe({
      next: () => this.loadTrips(),
      error: err => {
        console.error('Erro ao excluir viagem', err);
        this.error = err?.message || 'Erro ao excluir viagem.';
        this.cdr.detectChanges();
      }
    });
  }

  getTripImage(trip: Trip): string {
    if (this.brokenImages.has(trip.id)) return '';
    return trip.mainImage || trip.gallery?.[0] || '';
  }

  onTripImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    const tripId = Number(img.dataset['tripId']);
    if (tripId) this.brokenImages.add(tripId);
  }

  get filteredTrips() {
    const search = this.normalize(this.searchTerm);

    return this.trips.filter(trip => {
      const searchable = this.normalize([
        trip.title,
        trip.country,
        trip.destination,
        trip.period,
        this.getTypeLabel(trip.tripType)
      ].filter(Boolean).join(' '));
      const matchesSearch = !search || searchable.includes(search);
      const matchesType = !this.typeFilter || trip.tripType === this.typeFilter;
      const matchesStatus = !this.statusFilter || trip.status === this.statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }

  getTypeLabel(type?: Trip['tripType']) {
    const labels: Record<string, string> = {
      peregrinacao: 'Peregrinação',
      regular: 'Regular',
      curadoria: 'Curadoria'
    };

    return labels[type || 'regular'];
  }

  getStatusLabel(status?: Trip['status']) {
    const labels: Record<string, string> = {
      active: 'Ativa',
      inactive: 'Inativa',
      draft: 'Rascunho'
    };

    return labels[status || 'active'];
  }

  formatPrice(value: number | string | undefined): string {
    const n = Number(value);
    if (!n || Number.isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  private normalize(value: string) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
}
