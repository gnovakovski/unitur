import { ChangeDetectorRef, Component, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, timeout } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { PaginatedResponse, TripService } from '../../core/services/trip.service';
import { Testimonial } from '../../core/models/testimonial.model';
import { TestimonialService } from '../../core/services/testimonial.service';
import { BannerService } from '../../core/services/banner.service';
import { PostService } from '../../core/services/post.service';
import { Post } from '../../core/models/post.model';
import { ForeignCurrencyCode, formatForeignAmount, parseForeignAmount } from '../../core/utils/currency-format';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { AboutContentService } from '../../core/services/about-content.service';
import { DEFAULT_ABOUT_CONTENT, HomeAboutContent } from '../../core/models/about-content.model';
import { SiteContentService } from '../../core/services/site-content.service';
import { DEFAULT_HOME_CONTENT, LEGACY_TRIP_TYPE_TO_MENU_ID, SiteHomeContent } from '../../core/models/site-content.model';
import { Banner } from '../../core/models/banner.model';
import { SeoService } from '../../core/services/seo.service';

interface HomeTripCard {
  slug: string;
  title: string;
  country: string;
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
  guideRole: string;
  coordinator: string;
}

/**
 * Seção de viagens da home gerada dinamicamente a partir de um menu do header.
 * Título = nome atual do menu, então renomear/criar/excluir menu reflete na home.
 */
interface HomeTripSection {
  /** id estável do menu (HeaderLink.id). */
  id: string;
  title: string;
  /** Texto do badge no card ("Peregrinação", "Regular", ou o próprio nome do menu). */
  tagLabel: string;
  /** Usa o estilo azul de badge "regular". */
  isRegular: boolean;
  trips: HomeTripCard[];
}

interface HomeBannerSlide {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  link?: string;
  buttonText?: string;
}

interface HomeCuradoriaCard {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  curator: string;
  tags: string[];
}

interface HomeWorldCard {
  name: string;
  icon: string;
  image: string;
  description: string;
}

interface HomeTestimonialCard {
  name: string;
  text: string;
  rating: number;
  image: string;
  trip: string;
}

interface HomeBlogPostCard {
  title: string;
  slug: string;
  excerpt: string;
  image: string;
  date: string;
  category: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly fallbackTripImage = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&h=350&fit=crop';
  currentSlide = 0;
  searchDestination = '';
  searchStartDate = '';
  searchEndDate = '';
  private slideInterval: any;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(
    private tripService: TripService,
    private testimonialService: TestimonialService,
    private bannerService: BannerService,
    private postService: PostService,
    private aboutContentService: AboutContentService,
    private siteContentService: SiteContentService,
    private exchangeRateService: ExchangeRateService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private seo: SeoService
  ) {}

  homeAbout: HomeAboutContent = JSON.parse(JSON.stringify(DEFAULT_ABOUT_CONTENT.home));
  homeContent: SiteHomeContent = { ...DEFAULT_HOME_CONTENT };

  bannerSlides: HomeBannerSlide[] = [];

  /** Seções de viagem geradas dinamicamente, uma por menu visível do header. */
  tripSections: HomeTripSection[] = [];

  /** Viagens ativas já carregadas (reprocessadas quando o header muda). */
  private activeTrips: Trip[] = [];

  /** Menu que recebe layout especial de curadoria (cards grandes alternados). */
  private readonly curadoriaMenuId = 'curadoria';

  continents: HomeWorldCard[] = [];

  curadoria: HomeCuradoriaCard[] = [];

  testimonials: HomeTestimonialCard[] = [];

  blogPosts: HomeBlogPostCard[] = [];

  ngOnInit() {
    this.applySeo();
    this.loadBanners();
    this.loadHeaderMenus();
    this.loadTrips();
    this.loadTestimonials();
    this.loadPosts();
    this.loadAboutContent();
    this.loadHomeContent();
  }

  /**
   * Mantém as seções da home sincronizadas com os menus do header: ao
   * renomear/criar/excluir um menu no admin, as seções são recalculadas.
   */
  private loadHeaderMenus() {
    this.siteContentService.header$.subscribe(() => {
      this.buildTripSections();
      this.cdr.detectChanges();
    });
    this.siteContentService.loadHeader().subscribe();
  }

  private applySeo() {
    this.seo.setMeta({
      title: 'Unitur Agência de Viagens e Turismo | Peregrinações e Roteiros',
      description: 'A Unitur é uma agência de viagens especializada em peregrinações e roteiros para grupos pelo Brasil e diversos destinos internacionais. Conheça nossas viagens.',
      canonicalPath: '/',
      type: 'website'
    });
    // JSON-LD global: agência + site (com SearchAction).
    this.seo.setJsonLd('organization', this.seo.organizationSchema());
    this.seo.setJsonLd('website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Unitur',
      url: this.seo.absoluteUrl('/'),
      potentialAction: {
        '@type': 'SearchAction',
        target: this.seo.absoluteUrl('/viagens?destination={search_term_string}'),
        'query-input': 'required name=search_term_string'
      }
    });
  }

  private loadAboutContent() {
    this.aboutContentService.content$.subscribe(content => {
      this.homeAbout = content.home;
      this.cdr.detectChanges();
    });
    this.aboutContentService.load().subscribe();
  }

  private loadHomeContent() {
    this.siteContentService.home$.subscribe(content => {
      this.homeContent = content;
      this.cdr.detectChanges();
    });
    this.siteContentService.loadHome().subscribe();
  }

  ngOnDestroy() {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  startSlideShow() {
    // O autoplay do carousel é puramente visual; não roda no SSR.
    if (!this.isBrowser) return;
    this.slideInterval = setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  nextSlide() {
    if (this.bannerSlides.length === 0) {
      return;
    }

    this.currentSlide = (this.currentSlide + 1) % this.bannerSlides.length;
  }

  prevSlide() {
    if (this.bannerSlides.length === 0) {
      return;
    }

    this.currentSlide = this.currentSlide === 0 ? this.bannerSlides.length - 1 : this.currentSlide - 1;
  }

  goToSlide(index: number) {
    this.currentSlide = index;
  }

  useFallbackImage(event: Event) {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = this.fallbackTripImage;
  }

  searchTrips() {
    this.router.navigate(['/viagens'], {
      queryParams: {
        destination: this.searchDestination || null,
        startDate: this.searchStartDate || null,
        endDate: this.searchEndDate || null
      }
    });
  }

  private loadTrips() {
    const emptyResponse: PaginatedResponse<Trip> = {
      data: [],
      total: 0,
      page: 1,
      limit: 100,
      totalPages: 1
    };

    this.tripService.getTrips({ status: 'active', limit: 100 }).pipe(
      catchError(() => of(emptyResponse))
    ).subscribe(response => {
      this.activeTrips = response.data;
      this.buildTripSections();
      this.curadoria = this.activeTrips
        .filter(trip => this.belongsToMenu(trip, this.curadoriaMenuId))
        .map(trip => this.mapCuradoriaCard(trip));
      this.continents = this.mapWorldCards(this.activeTrips);

      this.cdr.detectChanges();
    });
  }

  /**
   * Gera uma seção de viagens para CADA menu visível do header (exceto curadoria,
   * que tem layout próprio). Título = nome atual do menu, então renomear/criar/
   * excluir menu no admin reflete automaticamente aqui. Só entram menus que têm
   * ao menos uma viagem vinculada, para não exibir seções vazias.
   */
  private buildTripSections() {
    const menus = this.siteContentService.getCurrentHeaderLinks()
      .filter(link => link.visible && link.id !== this.curadoriaMenuId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    this.tripSections = menus
      .map(menu => {
        // Peregrinação usa o papel "Guia Espiritual Convidado"; demais usam "Guia".
        const isPeregrinacao = menu.id === 'peregrinacao';
        const guideRole = isPeregrinacao ? 'Guia Espiritual Convidado' : 'Guia';
        const trips = this.activeTrips
          .filter(trip => this.belongsToMenu(trip, menu.id))
          .map(trip => this.mapTripCard(trip, guideRole));

        return {
          id: menu.id,
          title: menu.label,
          tagLabel: isPeregrinacao ? 'Peregrinação' : menu.label,
          isRegular: !isPeregrinacao,
          trips
        } as HomeTripSection;
      })
      .filter(section => section.trips.length > 0);
  }

  private loadBanners() {
    this.bannerService.getActiveBanners().pipe(
      timeout(12000),
      catchError(() => of([] as Banner[]))
    ).subscribe(banners => {
      this.bannerSlides = banners
        .filter(banner => banner.imageUrl)
        .map(banner => ({
          id: String(banner.id),
          imageUrl: this.normalizeImage(banner.imageUrl),
          title: banner.title || '',
          subtitle: banner.subtitle || '',
          link: banner.link || '',
          buttonText: banner.buttonText || ''
        }));
      this.currentSlide = 0;
      if (this.bannerSlides.length > 0) {
        this.startSlideShow();
      }
      this.cdr.detectChanges();
    });
  }

  private loadTestimonials() {
    const emptyResponse = {
      data: [],
      total: 0,
      page: 1,
      limit: 6,
      totalPages: 1
    };

    this.testimonialService.getTestimonials({ status: 'approved', limit: 6 }).pipe(
      timeout(12000),
      catchError(() => of(emptyResponse))
    ).subscribe(response => {
      this.testimonials = response.data.map(testimonial => this.mapTestimonialCard(testimonial));
      this.cdr.detectChanges();
    });
  }

  private loadPosts() {
    const emptyResponse = {
      data: [],
      total: 0,
      page: 1,
      limit: 3,
      totalPages: 1
    };

    this.postService.getPosts({ status: 'published', limit: 3 }).pipe(
      timeout(12000),
      catchError(() => of(emptyResponse))
    ).subscribe(response => {
      const nextPosts = response.data.map(post => this.mapBlogPostCard(post));
      if (nextPosts.length > 0 || this.blogPosts.length === 0) {
        this.blogPosts = nextPosts;
      }
      this.cdr.detectChanges();
    });
  }

  /**
   * Decide se a viagem pertence a uma seção da home (por id de menu), com
   * fallback para o tripType legado quando a viagem ainda não tem `menuIds`.
   */
  private belongsToMenu(trip: Trip, menuId: string): boolean {
    const menuIds = Array.isArray(trip.menuIds) ? trip.menuIds.filter(Boolean) : [];
    if (menuIds.length) return menuIds.includes(menuId);
    return LEGACY_TRIP_TYPE_TO_MENU_ID[trip.tripType || 'regular'] === menuId;
  }

  private mapTripCard(trip: Trip, guideRole: string): HomeTripCard {
    const card: HomeTripCard = {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      country: trip.country || trip.destination || 'A definir',
      date: trip.period || this.formatTripPeriod(trip.startDate),
      duration: trip.duration ? `${trip.duration} dias` : 'A definir',
      image: this.normalizeImage(trip.mainImage),
      imagePosition: trip.mainImagePosition || '50% 50%',
      imageFit: trip.mainImageFit || 'cover',
      imageRotation: Number(trip.mainImageRotation || 0),
      price: trip.price ? `R$${Number(trip.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Consulte',
      foreignPrice: '',
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: (trip.spiritualGuide || '').trim(),
      guideRole,
      coordinator: (trip.coordinator || '').trim()
    };
    this.attachForeignPrice(card, trip);
    return card;
  }

  private attachForeignPrice(card: { foreignPrice?: string }, trip: Trip) {
    const currency = trip.foreignCurrency as ForeignCurrencyCode | '' | undefined;
    if (!currency || !trip.price || Number(trip.price) <= 0) return;
    this.exchangeRateService.convertFromBRL(Number(trip.price), currency).subscribe(({ value }) => {
      if (value && value > 0) {
        card.foreignPrice = formatForeignAmount(value, currency);
        this.cdr.detectChanges();
      }
    });
  }

  private mapCuradoriaCard(trip: Trip): HomeCuradoriaCard {
    const destination = trip.country || trip.destination || 'Destino a definir';

    return {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      subtitle: destination,
      description: trip.shortDescription || trip.description || 'Roteiro selecionado pela curadoria Unitur.',
      image: this.normalizeImage(trip.mainImage),
      curator: trip.coordinator ? `Curadoria de ${trip.coordinator}` : 'Curadoria Unitur',
      tags: [
        destination,
        trip.duration ? `${trip.duration} dias` : '',
        trip.period || ''
      ].filter(Boolean).slice(0, 3)
    };
  }

  private mapWorldCards(trips: Trip[]): HomeWorldCard[] {
    const cards = new Map<string, HomeWorldCard & { total: number }>();

    trips.forEach(trip => {
      const destination = (trip.country || trip.destination || '').trim();
      if (!destination) {
        return;
      }

      const key = this.normalizeTextKey(destination);
      const existing = cards.get(key);

      if (existing) {
        existing.total += 1;
        existing.description = `${existing.total} viagens cadastradas para ${existing.name}`;
        if (existing.image === this.fallbackTripImage && trip.mainImage) {
          existing.image = this.normalizeImage(trip.mainImage);
        }
        return;
      }

      cards.set(key, {
        name: destination,
        icon: this.getDestinationIcon(destination),
        image: this.normalizeImage(trip.mainImage),
        description: trip.shortDescription || trip.period || `Viagens cadastradas para ${destination}`,
        total: 1
      });
    });

    return Array.from(cards.values()).map(({ total, ...card }) => card);
  }

  private mapTestimonialCard(testimonial: Testimonial): HomeTestimonialCard {
    return {
      name: testimonial.clientName,
      text: testimonial.text,
      rating: testimonial.rating || 5,
      image: this.normalizeImage(testimonial.clientPhoto),
      trip: testimonial.trip?.title || 'Cliente Unitur'
    };
  }

  private mapBlogPostCard(post: Post): HomeBlogPostCard {
    return {
      title: post.title,
      slug: post.slug || String(post.id),
      excerpt: post.excerpt || '',
      image: this.normalizeImage(post.featuredImage || post.contentImages?.[0]),
      date: this.formatBlogDate(post.publishedAt || post.createdAt),
      category: post.category?.name || post.tags?.[0] || 'Blog'
    };
  }


  private normalizeImage(value?: string): string {
    const image = String(value || '').trim();
    return image || this.fallbackTripImage;
  }

  private normalizeTextKey(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getDestinationIcon(value: string): string {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z\s]/g, '')
      .trim();
    const words = normalized.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }

    return normalized.slice(0, 2).toUpperCase() || 'UN';
  }

  private formatTripPeriod(date?: Date): string {
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

  private formatBlogDate(date?: Date): string {
    if (!date) {
      return '';
    }

    const parsedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return parsedDate.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  }
}

