import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, of, timeout } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { TripService } from '../../core/services/trip.service';

interface ViagemCard {
  slug: string;
  title: string;
  location: string;
  date: string;
  duration: string;
  image: string;
  price: string;
  spots: string;
  showSpots: boolean;
  foreignPrice?: string;
  guide: string;
  coordinator: string;
  category: string;
  startDate?: Date;
}

@Component({
  selector: 'app-viagens',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './viagens.component.html',
  styleUrl: './viagens.component.scss'
})
export class ViagensComponent implements OnInit {
  private readonly fallbackImage = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&h=350&fit=crop';
  loading = false;
  error = '';

  viagens: ViagemCard[] = [];

  selectedCategory = 'Viagens de Peregrinacao';
  categories = ['Viagens de Peregrinacao', 'Viagens Regulares', 'Viagens de Curadoria'];

  constructor(
    private route: ActivatedRoute,
    private tripService: TripService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const path = this.route.snapshot.routeConfig?.path || '';
    const categoryByPath: Record<string, string> = {
      'viagens/peregrinacao': 'Viagens de Peregrinacao',
      'viagens/regulares': 'Viagens Regulares',
      'viagens/curadoria': 'Viagens de Curadoria'
    };

    this.selectedCategory = categoryByPath[path] || this.categories[0];
    this.loadTrips();
  }

  get filtered() {
    const destination = (this.route.snapshot.queryParamMap.get('destination') || '').trim().toLowerCase();
    const startDate = this.parseFilterDate(this.route.snapshot.queryParamMap.get('startDate'));
    const endDate = this.parseFilterDate(this.route.snapshot.queryParamMap.get('endDate'));
    const hasSearch = !!destination || !!startDate || !!endDate;

    return this.viagens.filter(v => {
      const matchesCategory = hasSearch || v.category === this.selectedCategory;
      const matchesDestination = !destination || v.location.toLowerCase().includes(destination) || v.title.toLowerCase().includes(destination);
      const tripDate = this.parseFilterDate(v.startDate);
      const matchesStart = !startDate || (tripDate ? tripDate >= startDate : false);
      const matchesEnd = !endDate || (tripDate ? tripDate <= endDate : false);

      return matchesCategory && matchesDestination && matchesStart && matchesEnd;
    });
  }

  selectCategory(cat: string) {
    this.selectedCategory = cat;
  }

  getTripQuery(trip: ViagemCard): Record<string, string> {
    return {
      title: trip.title,
      destination: trip.location,
      date: trip.date,
      duration: trip.duration,
      price: trip.price,
      spots: trip.spots,
      showSpots: String(trip.showSpots),
      foreignPrice: trip.foreignPrice || '',
      guide: trip.guide,
      coordinator: trip.coordinator,
      image: trip.image,
      category: trip.category
    };
  }

  useFallbackImage(event: Event) {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = this.fallbackImage;
  }

  private loadTrips() {
    this.loading = true;
    this.error = '';

    this.tripService.getTrips({ limit: 100 }).pipe(
      timeout(12000),
      catchError((err) => {
        console.error('Erro ao carregar viagens publicas', err);
        this.error = 'Nao foi possivel carregar as viagens cadastradas. Exibindo viagens padrao.';
        return of({ data: [], total: 0, page: 1, limit: 100, totalPages: 1 });
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe(response => {
      const activeTrips = response.data.filter(trip => trip.status !== 'inactive');

      this.viagens = activeTrips.map(trip => this.mapTrip(trip));
      this.cdr.detectChanges();
    });
  }

  private mapTrip(trip: Trip): ViagemCard {
    return {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      location: trip.country || trip.destination || 'A definir',
      date: trip.period || this.formatPeriod(trip.startDate),
      duration: trip.duration ? `${trip.duration} dias` : 'A definir',
      image: this.normalizeImage(trip.mainImage),
      price: trip.price ? `R$${Number(trip.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Consulte',
      foreignPrice: this.formatForeignPrice(trip.foreignPrice),
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: trip.spiritualGuide || 'A definir',
      coordinator: trip.coordinator || 'Equipe Unitur',
      category: this.getCategoryLabel(trip.tripType),
      startDate: trip.startDate
    };
  }

  private formatForeignPrice(value?: number | string): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'number') {
      return `U$${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    return value;
  }

  private normalizeImage(value?: string): string {
    const image = String(value || '').trim();
    return image || this.fallbackImage;
  }

  private parseFilterDate(value?: Date | string | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(`${value}`.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private getCategoryLabel(type?: Trip['tripType']) {
    const labels: Record<string, string> = {
      peregrinacao: 'Viagens de Peregrinacao',
      regular: 'Viagens Regulares',
      curadoria: 'Viagens de Curadoria'
    };

    return labels[type || 'regular'];
  }

  private formatPeriod(date?: Date) {
    if (!date) {
      return 'A definir';
    }

    const parsedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return 'A definir';
    }

    return parsedDate.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  }
}

