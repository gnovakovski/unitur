import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, from, of, switchMap, timeout } from 'rxjs';
import { Trip } from '../../../core/models/trip.model';
import { AuthService } from '../../../core/services/auth.service';
import { TripService } from '../../../core/services/trip.service';

@Component({
  selector: 'app-viagens-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Viagens</h1>
          <p>Cadastre viagens que aparecem na home por tipo.</p>
        </div>
        <a class="btn-primary" routerLink="/admin/viagens/nova">Nova Viagem</a>
      </div>

      @if (error) {
        <div class="alert-error">{{ error }}</div>
      }

      <div class="filters-card">
        <input class="form-control" type="search" [(ngModel)]="searchTerm" placeholder="Buscar por nome, local, periodo...">
        <select class="form-control" [(ngModel)]="typeFilter">
          <option value="">Todos os tipos</option>
          <option value="peregrinacao">Viagens de Peregrinação</option>
          <option value="regular">Viagens Regulares</option>
          <option value="curadoria">Viagens de Curadoria</option>
        </select>
        <select class="form-control" [(ngModel)]="statusFilter">
          <option value="">Todos os status</option>
          <option value="active">Ativa</option>
          <option value="inactive">Inativa</option>
        </select>
      </div>

      @if (loading) {
        <div class="empty-state">
          <h3>Carregando viagens...</h3>
        </div>
      } @else if (trips.length === 0) {
        <div class="empty-state">
          <h3>Nenhuma viagem cadastrada</h3>
          <p>Comece criando sua primeira viagem.</p>
          <a class="btn-primary" routerLink="/admin/viagens/nova">Criar viagem</a>
        </div>
      } @else if (filteredTrips.length === 0) {
        <div class="empty-state">
          <h3>Nenhuma viagem encontrada</h3>
          <p>Ajuste os filtros para ver outros resultados.</p>
        </div>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>Viagem</th>
                <th>Tipo</th>
                <th>Período</th>
                <th>Dias</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (trip of filteredTrips; track trip.id) {
                <tr>
                  <td>
                    <strong>{{ trip.title }}</strong>
                    <span>{{ trip.country || trip.destination }}</span>
                  </td>
                  <td>{{ getTypeLabel(trip.tripType) }}</td>
                  <td>{{ trip.period || formatDate(trip.startDate) }}</td>
                  <td>{{ trip.duration }} dias</td>
                  <td>
                    <span class="status" [class.inactive]="trip.status === 'inactive'">
                      {{ trip.status === 'active' ? 'Ativa' : 'Inativa' }}
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <a class="btn-small" [routerLink]="['/admin/viagens', trip.id, 'editar']">Editar</a>
                      <button class="btn-small danger" type="button" (click)="deleteTrip(trip)" [disabled]="deletingId === trip.id">
                        {{ deletingId === trip.id ? 'Excluindo...' : 'Excluir' }}
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
  `,
  styles: [`
    .page-container { max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; }
    .page-header h1 { font-size: 2rem; color: #1a1a2e; margin: 0 0 0.35rem; }
    .page-header p { color: #6C757D; margin: 0; }
    .btn-primary { border: none; border-radius: 999px; font-weight: 700; cursor: pointer; text-decoration: none; }
    .btn-small { border: none; border-radius: 8px; font-weight: 600; cursor: pointer; text-decoration: none; }
    .btn-primary { padding: 0.8rem 1.5rem; background: #ff812c; color: white; display: inline-flex; }
    .btn-primary:hover { background: #e67424; }
    .alert-error { margin-bottom: 1rem; padding: 1rem; background: #ffebee; color: #c62828; border-radius: 18px; }
    .filters-card { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; background: white; border-radius: 18px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .form-control { width: 100%; border: 1px solid #e0e0e0; border-radius: 12px; padding: 0.75rem 1rem; font: inherit; }
    .table-card, .empty-state { background: white; border-radius: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
    .empty-state { text-align: center; padding: 4rem 2rem; }
    .empty-state h3 { color: #1a1a2e; margin-bottom: 0.5rem; }
    .empty-state p { color: #6C757D; margin-bottom: 1.5rem; }
    .table-card { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #edf0f2; vertical-align: middle; }
    th { color: #6C757D; font-size: 0.78rem; text-transform: uppercase; background: #F8F9FA; }
    td strong, td span { display: block; }
    td span { color: #6C757D; font-size: 0.88rem; margin-top: 0.2rem; }
    .status { display: inline-flex; padding: 0.35rem 0.8rem; border-radius: 999px; background: #e8f5e9; color: #2e7d32; font-weight: 700; font-size: 0.82rem; }
    .status.inactive { background: #f1f1f1; color: #666; }
    .row-actions { display: flex; gap: 0.5rem; }
    .btn-small { padding: 0.5rem 0.75rem; background: #eef3f8; color: #3a75c3; white-space: nowrap; }
    .btn-small.danger { background: #ffebee; color: #c62828; }
    @media (max-width: 780px) { .page-header { flex-direction: column; } .filters-card { grid-template-columns: 1fr; } }
  `]
})
export class ViagensListComponent implements OnInit {
  trips: Trip[] = [];
  loading = false;
  error = '';
  deletingId: number | null = null;
  searchTerm = '';
  typeFilter = '';
  statusFilter = '';

  constructor(
    private authService: AuthService,
    private tripService: TripService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadTrips();
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
      peregrinacao: 'Viagens de Peregrinação',
      regular: 'Viagens Regulares',
      curadoria: 'Viagens de Curadoria'
    };

    return labels[type || 'regular'];
  }

  formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  private normalize(value: string) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}
