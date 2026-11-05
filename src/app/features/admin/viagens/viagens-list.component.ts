import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, from, of, switchMap, timeout } from 'rxjs';
import { Trip } from '../../../core/models/trip.model';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TripService } from '../../../core/services/trip.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { formatTripForeign } from '../../../core/utils/trip-pricing';
import { SiteContentService } from '../../../core/services/site-content.service';
import { HeaderLink } from '../../../core/models/site-content.model';
import { resolveTripMenuIds, tripMenus } from '../../../core/utils/trip-menu';

@Component({
  selector: 'app-viagens-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
  /** Menus do cabeçalho: dão nome ao "Tipo" de cada viagem e ao filtro. */
  menus: HeaderLink[] = [];

  constructor(
    private authService: AuthService,
    private permissionService: PermissionService,
    private tripService: TripService,
    private exchangeRateService: ExchangeRateService,
    private siteContentService: SiteContentService,
    private cdr: ChangeDetectorRef
  ) {}

  /** Pode gerenciar viagens (lista, criar, editar, excluir). */
  get canViagens(): boolean {
    return this.permissionService.can('viagens');
  }

  ngOnInit() {
    if (this.canViagens) {
      this.loadTrips();
      // Cotações atualizadas para a coluna de preço refletir o câmbio de agora.
      this.exchangeRateService.loadRates().subscribe(() => this.cdr.detectChanges());
      // O "Tipo" é o menu em que a viagem aparece, com o nome atual do menu.
      this.menus = this.siteContentService.getCurrentHeaderLinks();
      this.siteContentService.loadHeader().subscribe(() => {
        this.menus = this.siteContentService.getCurrentHeaderLinks();
        this.cdr.detectChanges();
      });
    }
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
        return of({ data: [], total: 0, page: 1, limit: 100, totalPages: 1, hasNextPage: false });
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
        ...this.getTripMenus(trip).map(menu => menu.label)
      ].filter(Boolean).join(' '));
      const matchesSearch = !search || searchable.includes(search);
      const matchesType = !this.typeFilter || resolveTripMenuIds(trip).includes(this.typeFilter);
      const matchesStatus = !this.statusFilter || trip.status === this.statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }

  /** Menus em que a viagem aparece (mesmos marcados em "Aparece nos menus"). */
  getTripMenus(trip: Trip): HeaderLink[] {
    return tripMenus(trip, this.menus);
  }

  getStatusLabel(status?: Trip['status']) {
    const labels: Record<string, string> = {
      active: 'Ativa',
      inactive: 'Inativa',
      draft: 'Rascunho'
    };

    return labels[status || 'active'];
  }

  /**
   * Preço em reais com a cotação atual — o mesmo número que o site e o
   * formulário mostram (ver `computeTripPrice`), e não o `price` gravado, que
   * ficou congelado no câmbio do dia em que a viagem foi salva.
   */
  formatPrice(trip: Trip): string {
    const { brl } = this.exchangeRateService.resolveTripPriceSnapshot(trip);
    if (!brl) return '—';
    return brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** "US$ 4.990,00" — valor cadastrado, exibido abaixo do preço em reais. */
  formatForeignPrice(trip: Trip): string {
    return formatTripForeign(this.exchangeRateService.resolveTripPriceSnapshot(trip));
  }

  formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  private normalize(value: string) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
}
