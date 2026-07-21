import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, NgZone, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, timeout } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { TripService } from '../../core/services/trip.service';
import { ForeignCurrencyCode, formatForeignAmount } from '../../core/utils/currency-format';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { safeScrollToTop } from '../../core/utils/browser';
import { SeoService } from '../../core/services/seo.service';
import { SiteContentService } from '../../core/services/site-content.service';
import { normalizeWhatsAppNumber, slugFromHeaderRoute } from '../../core/models/site-content.model';
import { tripScope, tripCanonicalPath } from '../../core/utils/trip-scope';
import { tripSeo } from '../../core/utils/seo-fallback';
import { buildWhatsappLink, resolveWhatsappMessage } from '../../core/utils/whatsapp-message';
import { TripTag } from '../../core/models/tag.model';
import { TagService } from '../../core/services/tag.service';
import { TagBadge, resolveTagBadge } from '../../core/utils/tag-badge';

interface ProductTrip {
  slug: string;
  tagId?: number | null;
  title: string;
  eyebrow: string;
  destination: string;
  date: string;
  duration: string;
  price: string;
  priceTagline?: string;
  whatsappMessage?: string;
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
  paymentMethods?: Array<{ title: string; description?: string }>;
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
  /** Tags cadastradas, para resolver o badge desta viagem por `tagId`. */
  tags: TripTag[] = [];
  /** Número de WhatsApp (só dígitos) vindo do conteúdo de contato do site. */
  private whatsappNumber = '';
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tripService: TripService,
    private exchangeRateService: ExchangeRateService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private seo: SeoService,
    private siteContentService: SiteContentService,
    private tagService: TagService
  ) {}

  /** Badge da tag desta viagem, exibido acima do título. */
  get tagBadge(): TagBadge | null {
    return resolveTagBadge(this.trip?.tagId, this.tags);
  }

  /**
   * Salvaguarda contra "página não encontrada": se o slug não é uma viagem mas
   * casa com um menu do cabeçalho, renderiza a listagem daquele menu. Cobre o
   * caso em que o matcher de rota ainda não conhecia o slug (ex.: menu novo
   * acessado por URL direta / SSR). Retorna true se redirecionou.
   */
  private redirectIfMenuSlug(slug: string): boolean {
    const links = this.siteContentService.getCurrentHeaderLinks();
    const isMenu = links.some(l => slugFromHeaderRoute(l.route) === slug);
    if (!isMenu) return false;
    this.router.navigate(['/viagens', slug], { replaceUrl: true });
    return true;
  }

  /**
   * Link de WhatsApp dinâmico: número real do contato + a mensagem cadastrada
   * na viagem (ou o texto padrão com o nome dela, quando não há mensagem).
   */
  get whatsappLink(): string {
    const texto = resolveWhatsappMessage(this.trip?.whatsappMessage, this.trip?.title);
    return buildWhatsappLink(this.whatsappNumber, texto);
  }

  ngOnInit() {
    // Tag exibida no topo da página (cadastrada no admin da viagem).
    // markForCheck e não detectChanges: o cache do TagService reemite de forma
    // síncrona quando já está quente, e forçar CD dentro do ngOnInit seria
    // reentrante.
    this.tagService.getAllTags().subscribe(tags => {
      this.tags = tags;
      this.cdr.markForCheck();
    });

    // Número de WhatsApp do contato do site (usado no botão "Reservar agora").
    this.siteContentService.contact$.subscribe(contact => {
      this.whatsappNumber = normalizeWhatsAppNumber(contact?.whatsapp);
      this.cdr.detectChanges();
    });
    this.siteContentService.loadContact().subscribe();

    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      this.loadTrip(slug);
      safeScrollToTop('smooth');
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
    // `Image` não existe no SSR; o preload é puramente uma otimização de browser.
    if (!this.isBrowser) return;
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

  /** Quebra a política de cancelamento em itens — aceita \n ou marcadores como "- ", "• ", "* ". */
  get cancellationLines(): string[] {
    const raw = (this.trip?.cancellationPolicy || '').trim();
    if (!raw) return [];
    return raw
      .split(/\r?\n+/)
      .map(line => line.replace(/^\s*[-•*]\s*/, '').trim())
      .filter(Boolean);
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
            // Antes de 404, verifica se o slug é, na verdade, um menu do site.
            if (this.redirectIfMenuSlug(slug)) {
              return;
            }
            this.trip = null;
            this.notFound = true;
            this.applyNotFoundSeo();
          } else if (trip.status === 'inactive' || trip.status === 'draft') {
            this.trip = null;
            this.notFound = true;
            this.applyNotFoundSeo();
          } else {
            this.trip = this.mapFirestoreTrip(trip);
            this.applyTripSeo(trip);
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

  /** Define meta tags, canonical e JSON-LD (Product + Breadcrumb) da viagem. */
  private applyTripSeo(trip: Trip): void {
    const { title, description, image } = tripSeo(trip);
    const canonicalPath = tripCanonicalPath(trip);
    const scopeLabel = tripScope(trip) === 'nacional' ? 'Roteiros Nacionais' : 'Roteiros Internacionais';
    const scopePath = tripScope(trip) === 'nacional' ? '/roteiros-nacionais/' : '/roteiros-internacionais/';

    this.seo.setMeta({ title, description, image, canonicalPath, type: 'product' });

    this.seo.setJsonLd('product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description,
      image: this.seo.absoluteUrl(image),
      url: this.seo.absoluteUrl(canonicalPath),
      brand: { '@type': 'Brand', name: 'Unitur' },
      ...(trip.price && Number(trip.price) > 0
        ? {
            offers: {
              '@type': 'Offer',
              price: Number(trip.price),
              priceCurrency: 'BRL',
              availability: 'https://schema.org/InStock',
              url: this.seo.absoluteUrl(canonicalPath)
            }
          }
        : {})
    });

    this.seo.setJsonLd('breadcrumb', this.seo.breadcrumbSchema([
      { name: 'Início', path: '/' },
      { name: scopeLabel, path: scopePath },
      { name: title, path: canonicalPath }
    ]));
  }

  private applyNotFoundSeo(): void {
    this.seo.setMeta({
      title: 'Viagem não encontrada',
      description: 'A viagem que você procura não está mais disponível.',
      noindex: true
    });
  }

  private mapFirestoreTrip(trip: Trip): ProductTrip {
    const destination = trip.country || trip.destination || 'A definir';
    const duration = trip.duration ? `${trip.duration} dias` : 'A definir';
    const price = trip.price ? `R$${Number(trip.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Consulte';
    const summary = trip.shortDescription || trip.description || 'Roteiro organizado pela Unitur com acompanhamento e suporte em todas as etapas.';

    const mapped: ProductTrip = {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      tagId: trip.tagId ?? null,
      title: trip.title,
      eyebrow: this.getTripTypeLabel(trip.tripType),
      destination,
      date: trip.period || this.formatPeriod(trip.startDate),
      duration,
      price,
      priceTagline: trip.priceTagline !== undefined ? trip.priceTagline : 'Aéreo e apartamento duplo, a partir de:',
      whatsappMessage: trip.whatsappMessage || '',
      foreignPrice: '',
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: (trip.spiritualGuide || '').trim(),
      coordinator: (trip.coordinator || '').trim(),
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
      paymentMethods: this.normalizePaymentMethods(trip.paymentMethods),
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

  private defaultPaymentMethods(): Array<{ title: string; description?: string }> {
    return [
      { title: 'Entrada + parcelas no boleto' },
      { title: 'Cartão de crédito' },
      { title: 'Pix ou transferência' }
    ];
  }

  /**
   * Aceita tanto o formato novo (array de blocos) quanto o legado (string[]).
   * Se vier vazio, devolve as formas padrão.
   */
  private normalizePaymentMethods(value: unknown): Array<{ title: string; description?: string }> {
    if (!Array.isArray(value) || value.length === 0) return this.defaultPaymentMethods();
    const normalized = value
      .map(item => {
        if (typeof item === 'string') {
          const title = item.trim();
          return title ? { title } : null;
        }
        if (item && typeof item === 'object') {
          const obj = item as { title?: string; description?: string };
          const title = (obj.title || '').trim();
          const description = (obj.description || '').trim();
          if (!title && !description) return null;
          return description ? { title, description } : { title };
        }
        return null;
      })
      .filter((b): b is { title: string; description?: string } => !!b);
    return normalized.length > 0 ? normalized : this.defaultPaymentMethods();
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
