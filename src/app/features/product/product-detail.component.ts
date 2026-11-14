import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, NgZone, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, timeout } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { TripService } from '../../core/services/trip.service';
import { ResolvedTripPrice, formatTripBRL, formatTripForeign } from '../../core/utils/trip-pricing';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { safeScrollToTop } from '../../core/utils/browser';
import { SeoService } from '../../core/services/seo.service';
import { SiteContentService } from '../../core/services/site-content.service';
import { HeaderLink, normalizeWhatsAppNumber, slugFromHeaderRoute } from '../../core/models/site-content.model';
import { tripScope, tripCanonicalPath } from '../../core/utils/trip-scope';
import { tripSeo } from '../../core/utils/seo-fallback';
import { buildWhatsappLink, resolveWhatsappMessage } from '../../core/utils/whatsapp-message';
import { TripTag } from '../../core/models/tag.model';
import { TagService } from '../../core/services/tag.service';
import { TagBadge, resolveTagBadge } from '../../core/utils/tag-badge';
import { resolveTripMenuIds, tripMenuLabel } from '../../core/utils/trip-menu';
import { formatTripDates } from '../../core/utils/trip-dates';
import { ToastService } from '../../core/services/toast.service';

interface ProductTrip {
  slug: string;
  tagId?: number | null;
  title: string;
  /** Menus do cabeçalho em que a viagem aparece (base do selo de categoria). */
  menuIds: string[];
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
  downloadingPdf = false;
  private canonicalUrl = '';
  /** Tags cadastradas, para resolver o badge desta viagem por `tagId`. */
  tags: TripTag[] = [];
  /** Número de WhatsApp (só dígitos) vindo do conteúdo de contato do site. */
  private whatsappNumber = '';
  /** Menus do cabeçalho já carregados do Firestore; null enquanto não chegam. */
  private headerLinks: HeaderLink[] | null = null;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly toast = inject(ToastService);

  async shareTrip(): Promise<void> {
    if (!this.isBrowser || !this.trip) return;
    const url = this.canonicalUrl;
    try {
      if (navigator.share) {
        await navigator.share({ title: this.trip.title, text: 'Conheça este roteiro da Unitur', url });
      } else {
        await navigator.clipboard.writeText(url);
        this.toast.success('Link do roteiro copiado!');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      this.toast.error('Não foi possível compartilhar. Copie o endereço da página.');
    }
  }

  async downloadPdf(): Promise<void> {
    if (!this.isBrowser || !this.trip || this.downloadingPdf) return;
    const trip = this.trip;
    const url = this.canonicalUrl;
    this.downloadingPdf = true;
    try {
      const { createTripPdf } = await import('../../core/utils/trip-pdf');
      const pdf = await createTripPdf(trip, url);
      pdf.save(`unitur-${trip.slug.replace(/[^a-z0-9-]/gi, '-')}.pdf`);
    } catch {
      this.toast.error('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      this.downloadingPdf = false;
      this.cdr.markForCheck();
    }
  }

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
   * Selo laranja com a categoria da viagem: nome atual do menu dela no
   * cabeçalho. Fica oculto até os menus chegarem do Firestore — antes disso só
   * existiriam os nomes padrão (ex.: "Viagens Regulares"), que podem não ser os
   * do site.
   */
  get categoryLabel(): string {
    if (!this.trip || !this.headerLinks) return '';
    return tripMenuLabel({ menuIds: this.trip.menuIds }, this.headerLinks);
  }

  get showHeroTripDate(): boolean {
    return !!this.trip;
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
   * Endereço de viagem que não está publicada: roteiro antigo do WordPress,
   * viagem encerrada ou rascunho. Em vez de "Viagem não encontrada", leva para a
   * mesma viagem com o slug novo (ex.: "...-2664" → "gramado-e-canela") ou, se
   * não houver equivalente, para a listagem de viagens.
   *
   * Os endereços antigos conhecidos já têm redirect 301 no vercel.json; este
   * fallback cobre os demais. Não redireciona se o catálogo não pôde ser lido
   * (erro/timeout), para não tirar do ar uma viagem que existe.
   */
  private redirectRetiredTrip(slug: string): boolean {
    const replacement = this.tripService.findActiveReplacement(slug);
    if (replacement === undefined) return false;
    const target = replacement ? tripCanonicalPath(replacement) : '/viagens/';
    this.router.navigateByUrl(target, { replaceUrl: true });
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

    // Menus do cabeçalho, para o selo de categoria usar o nome atual do menu.
    this.siteContentService.loadHeader().subscribe(() => {
      this.headerLinks = this.siteContentService.getCurrentHeaderLinks();
      this.cdr.markForCheck();
    });

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
            if (this.redirectRetiredTrip(slug)) {
              return;
            }
            this.trip = null;
            this.notFound = true;
            this.applyNotFoundSeo();
          } else if (trip.status === 'inactive' || trip.status === 'draft') {
            if (this.redirectRetiredTrip(slug)) {
              return;
            }
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
    this.canonicalUrl = this.seo.absoluteUrl(canonicalPath);
    const scopeLabel = tripScope(trip) === 'nacional' ? 'Roteiros Nacionais' : 'Roteiros Internacionais';
    const scopePath = tripScope(trip) === 'nacional' ? '/roteiros-nacionais/' : '/roteiros-internacionais/';
    const priceBRL = this.exchangeRateService.resolveTripPriceSnapshot(trip).brl;

    this.seo.setMeta({ title, description, image, canonicalPath, type: 'product' });

    this.seo.setJsonLd('product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description,
      image: this.seo.absoluteUrl(image),
      url: this.seo.absoluteUrl(canonicalPath),
      brand: { '@type': 'Brand', name: 'Unitur' },
      // Mesmo preço exibido no painel de reserva (derivado da cotação atual),
      // para o rich result do Google não divergir da página.
      ...(priceBRL > 0
        ? {
            offers: {
              '@type': 'Offer',
              price: priceBRL,
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
    const summary = trip.shortDescription || trip.description || 'Roteiro organizado pela Unitur com acompanhamento e suporte em todas as etapas.';

    const mapped: ProductTrip = {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      tagId: trip.tagId ?? null,
      title: trip.title,
      menuIds: resolveTripMenuIds(trip),
      destination,
      date: formatTripDates(trip.startDate, trip.endDate, trip.period),
      duration,
      price: 'Consulte',
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
      description: (trip.description || '').trim(),
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
    this.attachPrices(mapped, trip);
    return mapped;
  }

  /**
   * Preenche R$ e valor em moeda estrangeira a partir do que está cadastrado na
   * viagem (ver `computeTripPrice`). Pinta na hora com as cotações em cache e
   * corrige — inclusive o preço do JSON-LD — quando as do Firestore chegam.
   */
  private attachPrices(card: ProductTrip, trip: Trip) {
    const apply = (resolved: ResolvedTripPrice) => {
      card.price = formatTripBRL(resolved.brl);
      card.foreignPrice = formatTripForeign(resolved);
    };

    apply(this.exchangeRateService.resolveTripPriceSnapshot(trip));
    this.exchangeRateService.resolveTripPrice(trip).subscribe(resolved => {
      apply(resolved);
      this.applyTripSeo(trip);
      this.cdr.markForCheck();
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

}
