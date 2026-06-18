import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, from, of, switchMap, timeout } from 'rxjs';
import { Trip } from '../../../core/models/trip.model';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TripService } from '../../../core/services/trip.service';

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

  constructor(
    private authService: AuthService,
    private permissionService: PermissionService,
    private tripService: TripService,
    private cdr: ChangeDetectorRef
  ) {}

  /** Pode gerenciar viagens (lista, criar, editar, excluir). */
  get canViagens(): boolean {
    return this.permissionService.can('viagens');
  }

  ngOnInit() {
    if (this.canViagens) {
      this.loadTrips();
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
