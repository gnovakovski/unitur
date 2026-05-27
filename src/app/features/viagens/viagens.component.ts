import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { TripService } from '../../core/services/trip.service';
import { ForeignCurrencyCode, formatForeignAmount } from '../../core/utils/currency-format';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';

interface ViagemCard {
  slug: string;
  title: string;
  location: string;
  date: string;
  duration: string;
  image: string;
  imagePosition?: string;
  imageFit?: string;
  imageRotation?: number;
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
export class ViagensComponent implements OnInit, OnDestroy {
  private readonly fallbackImage = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&h=350&fit=crop';
  loading = false;
  error = '';

  viagens: ViagemCard[] = [];

  selectedCategory = 'Todas';
  categories = ['Todas', 'Viagens de Peregrinação', 'Viagens Regulares', 'Viagens de Curadoria'];
  private routeSub?: Subscription;
  private querySub?: Subscription;
  private filterDestination = '';
  private filterStartDate: Date | null = null;
  private filterEndDate: Date | null = null;

  constructor(
    private route: ActivatedRoute,
    private tripService: TripService,
    private exchangeRateService: ExchangeRateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.routeSub = this.route.url.subscribe(() => {
      this.updateSelectedCategory();
      this.cdr.detectChanges();
    });
    this.querySub = this.route.queryParamMap.subscribe(params => {
      this.filterDestination = (params.get('destination') || '').trim().toLowerCase();
      this.filterStartDate = this.parseFilterDate(params.get('startDate'));
      this.filterEndDate = this.parseFilterDate(params.get('endDate'));
      this.cdr.detectChanges();
    });
    this.updateSelectedCategory();
    this.loadTrips();
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  private updateSelectedCategory() {
    const path = this.route.snapshot.routeConfig?.path || '';
    const categoryByPath: Record<string, string> = {
      'viagens/peregrinacao': 'Viagens de Peregrinação',
      'viagens/regulares': 'Viagens Regulares',
      'viagens/curadoria': 'Viagens de Curadoria'
    };

    this.selectedCategory = categoryByPath[path] || 'Todas';
  }

  get filtered() {
    const destination = this.filterDestination;
    const startDate = this.filterStartDate;
    const endDate = this.filterEndDate;
    const hasSearch = !!destination || !!startDate || !!endDate;

    return this.viagens.filter(v => {
      const matchesCategory = hasSearch || this.selectedCategory === 'Todas' || v.category === this.selectedCategory;
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

  useFallbackImage(event: Event) {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = this.fallbackImage;
  }

  private loadTrips() {
    this.loading = true;
    this.error = '';

    this.tripService.getTrips({ status: 'active', limit: 100 }).pipe(
      catchError((err) => {
        console.error('Erro ao carregar viagens publicas', err);
        this.error = 'Não foi possível carregar as viagens cadastradas.';
        return of({ data: [], total: 0, page: 1, limit: 100, totalPages: 1 });
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe(response => {
      this.viagens = response.data.map(trip => this.mapTrip(trip));
      this.cdr.detectChanges();
    });
  }

  private mapTrip(trip: Trip): ViagemCard {
    const card: ViagemCard = {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      location: trip.country || trip.destination || 'A definir',
      date: trip.period || this.formatPeriod(trip.startDate),
      duration: trip.duration ? `${trip.duration} dias` : 'A definir',
      image: this.normalizeImage(trip.mainImage),
      imagePosition: trip.mainImagePosition || '50% 50%',
      imageFit: trip.mainImageFit || 'cover',
      imageRotation: Number(trip.mainImageRotation || 0),
      price: trip.price ? `R$${Number(trip.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Consulte',
      foreignPrice: '',
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: trip.spiritualGuide || 'A definir',
      coordinator: trip.coordinator || 'Equipe Unitur',
      category: this.getCategoryLabel(trip.tripType),
      startDate: trip.startDate
    };
    this.attachForeignPrice(card, trip);
    return card;
  }

  private attachForeignPrice(card: ViagemCard, trip: Trip) {
    const currency = trip.foreignCurrency as ForeignCurrencyCode | '' | undefined;
    if (!currency || !trip.price || Number(trip.price) <= 0) return;
    this.exchangeRateService.convertFromBRL(Number(trip.price), currency).subscribe(({ value }) => {
      if (value && value > 0) {
        card.foreignPrice = formatForeignAmount(value, currency);
        this.cdr.detectChanges();
      }
    });
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
      peregrinacao: 'Viagens de Peregrinação',
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

