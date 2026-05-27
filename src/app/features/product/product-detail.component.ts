import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, timeout } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { TripService } from '../../core/services/trip.service';
import { ForeignCurrencyCode, formatForeignAmount } from '../../core/utils/currency-format';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';

interface ProductTrip {
  slug: string;
  title: string;
  eyebrow: string;
  destination: string;
  date: string;
  duration: string;
  price: string;
  foreignPrice?: string;
  spots: string;
  showSpots?: boolean;
  guide: string;
  coordinator: string;
  operator?: string;
  image: string;
  imagePosition?: string;
  imageFit?: string;
  imageRotation?: number;
  summary: string;
  description?: string;
  experienceImages?: string[];
  highlights: string[];
  itinerary: Array<{ day: string; title: string; description: string }>;
  hotels?: Array<{ name: string; image: string }>;
  paymentMethods?: string[];
  cancellationPolicy?: string;
  included: string[];
  notIncluded: string[];
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss'
})
export class ProductDetailComponent implements OnInit {
  trip: ProductTrip | null = null;
  loading = false;
  notFound = false;
  itineraryExpanded = false;
  galleryIndex = 0;
  galleryLightboxOpen = false;
  hotelIndex = 0;
  hotelLightboxOpen = false;

  constructor(
    private route: ActivatedRoute,
    private tripService: TripService,
    private exchangeRateService: ExchangeRateService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      this.loadTrip(slug);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---------- Galeria / carrossel ----------
  get galleryImages(): string[] {
    return this.trip?.experienceImages || [];
  }

  /**
   * Pré-carrega todas as imagens da galeria e dos hotéis para evitar delay
   * de download ao trocar no carrossel.
   */
  private preloadGalleryImages() {
    const urls = [
      ...this.galleryImages,
      ...this.hotelItems.map(h => h.image)
    ].filter(Boolean);
    for (const url of urls) {
      const img = new Image();
      img.src = url;
    }
  }

  galleryNext() {
    const total = this.galleryImages.length;
    if (!total) return;
    this.galleryIndex = (this.galleryIndex + 1) % total;
  }

  galleryPrev() {
    const total = this.galleryImages.length;
    if (!total) return;
    this.galleryIndex = (this.galleryIndex - 1 + total) % total;
  }

  goToGallery(index: number) {
    this.galleryIndex = index;
  }

  openLightbox(index: number) {
    this.galleryIndex = index;
    this.galleryLightboxOpen = true;
  }

  closeLightbox() {
    this.galleryLightboxOpen = false;
  }

  // ---------- Carrossel de hotéis ----------
  get hotelItems(): Array<{ name: string; image: string }> {
    return this.trip?.hotels || [];
  }

  hotelNext() {
    const total = this.hotelItems.length;
    if (!total) return;
    this.hotelIndex = (this.hotelIndex + 1) % total;
  }

  hotelPrev() {
    const total = this.hotelItems.length;
    if (!total) return;
    this.hotelIndex = (this.hotelIndex - 1 + total) % total;
  }

  goToHotel(index: number) {
    this.hotelIndex = index;
  }

  openHotelLightbox(index: number) {
    this.hotelIndex = index;
    this.hotelLightboxOpen = true;
  }

  closeHotelLightbox() {
    this.hotelLightboxOpen = false;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if (this.galleryLightboxOpen) {
      if (event.key === 'Escape') this.closeLightbox();
      else if (event.key === 'ArrowLeft') this.galleryPrev();
      else if (event.key === 'ArrowRight') this.galleryNext();
    } else if (this.hotelLightboxOpen) {
      if (event.key === 'Escape') this.closeHotelLightbox();
      else if (event.key === 'ArrowLeft') this.hotelPrev();
      else if (event.key === 'ArrowRight') this.hotelNext();
    }
  }

  get visibleItinerary() {
    if (!this.trip) {
      return [];
    }

    return this.itineraryExpanded ? this.trip.itinerary : this.trip.itinerary.slice(0, 3);
  }

  toggleItinerary() {
    this.itineraryExpanded = !this.itineraryExpanded;
  }

  private loadTrip(slug: string | null) {
    this.itineraryExpanded = false;
    this.notFound = false;

    if (!slug) {
      this.trip = null;
      this.notFound = true;
      return;
    }

    this.loading = true;
    this.galleryIndex = 0;
    this.hotelIndex = 0;

    this.tripService.getTripBySlug(slug).pipe(
      timeout(15000),
      catchError(() => of(null))
    ).subscribe({
      next: (trip) => {
        this.ngZone.run(() => {
          this.loading = false;

          if (!trip) {
            this.trip = null;
            this.notFound = true;
          } else if (trip.status === 'inactive' || trip.status === 'draft') {
            this.trip = null;
            this.notFound = true;
          } else {
            this.trip = this.mapFirestoreTrip(trip);
            this.preloadGalleryImages();
          }

          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('[ProductDetail] subscribe.error:', err);
          this.loading = false;
          this.notFound = true;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private mapFirestoreTrip(trip: Trip): ProductTrip {
    const destination = trip.country || trip.destination || 'A definir';
    const duration = trip.duration ? `${trip.duration} dias` : 'A definir';
    const price = trip.price ? `R$${Number(trip.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Consulte';
    const summary = trip.shortDescription || trip.description || 'Roteiro organizado pela Unitur com acompanhamento e suporte em todas as etapas.';

    const mapped: ProductTrip = {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      eyebrow: this.getTripTypeLabel(trip.tripType),
      destination,
      date: trip.period || this.formatPeriod(trip.startDate),
      duration,
      price,
      foreignPrice: '',
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: trip.spiritualGuide || 'A definir',
      coordinator: trip.coordinator || 'Equipe Unitur',
      operator: trip.operator || 'Unitur',
      image: trip.mainImage || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&h=900&fit=crop',
      imagePosition: trip.mainImagePosition || '50% 50%',
      imageFit: trip.mainImageFit || 'cover',
      imageRotation: Number(trip.mainImageRotation || 0),
      summary,
      description: trip.description || '',
      experienceImages: trip.experienceImages || trip.gallery || [],
      highlights: [destination, trip.period || 'Período a definir', duration],
      itinerary: trip.itinerary
        ? this.parseItinerary(trip.itinerary)
        : [],
      included: trip.included?.length ? trip.included : [],
      notIncluded: trip.notIncluded?.length ? trip.notIncluded : [],
      hotels: trip.hotels || [],
      paymentMethods: trip.paymentMethods?.length ? trip.paymentMethods : this.defaultPaymentMethods(),
      cancellationPolicy: trip.cancellationPolicy || this.defaultCancellationPolicy()
    };
    this.attachForeignPrice(mapped, trip);
    return mapped;
  }

  private attachForeignPrice(card: ProductTrip, trip: Trip) {
    const currency = trip.foreignCurrency as ForeignCurrencyCode | '' | undefined;
    if (!currency || !trip.price || Number(trip.price) <= 0) return;
    this.exchangeRateService.convertFromBRL(Number(trip.price), currency).subscribe(({ value }) => {
      if (value && value > 0) {
        card.foreignPrice = formatForeignAmount(value, currency);
        this.cdr.detectChanges();
      }
    });
  }

  private parseItinerary(value: string): Array<{ day: string; title: string; description: string }> {
    return value
      .split('\n')
      .map((line, index) => {
        const [title = `Dia ${index + 1}`, description = ''] = line.split('|').map(item => item.trim());
        return { day: `Dia ${index + 1}`, title, description: description || title };
      })
      .filter(item => item.title);
  }

  private defaultPaymentMethods(): string[] {
    return ['Entrada + parcelas no boleto', 'Cartão de crédito', 'Pix ou transferência'];
  }

  private defaultCancellationPolicy(): string {
    return 'Política de cancelamento padrão conforme contrato da viagem.';
  }

  private getTripTypeLabel(type?: Trip['tripType']) {
    const labels: Record<string, string> = {
      peregrinacao: 'Viagens de Peregrinação',
      regular: 'Viagens Regulares',
      curadoria: 'Viagens de Curadoria'
    };

    return labels[type || 'regular'];
  }

  private formatPeriod(date?: Date): string {
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
