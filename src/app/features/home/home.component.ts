import { ChangeDetectorRef, Component, ElementRef, OnInit, OnDestroy, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, timeout } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { TripTag } from '../../core/models/tag.model';
import { PaginatedResponse, TripService } from '../../core/services/trip.service';
import { TagService } from '../../core/services/tag.service';
import { TagBadge, resolveTagBadge } from '../../core/utils/tag-badge';
import { Testimonial } from '../../core/models/testimonial.model';
import { TestimonialService } from '../../core/services/testimonial.service';
import { BannerService } from '../../core/services/banner.service';
import { PostService } from '../../core/services/post.service';
import { Post } from '../../core/models/post.model';
import { AboutContentService } from '../../core/services/about-content.service';
import { DEFAULT_ABOUT_CONTENT, HomeAboutContent } from '../../core/models/about-content.model';
import { SiteContentService } from '../../core/services/site-content.service';
import { DEFAULT_HOME_CONTENT, LEGACY_TRIP_TYPE_TO_MENU_ID, SiteHomeContent } from '../../core/models/site-content.model';
import { Banner } from '../../core/models/banner.model';
import { SeoService } from '../../core/services/seo.service';
import { srcsetForImage } from '../../core/utils/responsive-image';
import { NewsletterSignupComponent } from '../../shared/components/newsletter-signup/newsletter-signup.component';
import { compareHomeTripMenus } from '../../core/utils/trip-menu';
import { tripLinkPath } from '../../core/utils/trip-scope';
import { SsrFetchCache } from '../../core/ssr/fetch-cache.browser';

interface HomeTripCard {
  slug: string;
  /** Endereço canônico da viagem, usado nos links do card. */
  path: string;
  tagId?: number | null;
  title: string;
  country: string;
  date: string;
  duration: string;
  image: string;
  imagePosition?: string;
  imageFit?: string;
  imageRotation?: number;
  spots: string;
  showSpots: boolean;
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
  /** Rota da listagem completa desta categoria (botão "Ver mais"). */
  route: string;
  /** Há mais viagens nesta categoria do que as exibidas na home. */
  hasMore: boolean;
}

interface HomeBannerSlide {
  id: string;
  imageUrl: string;
  /** Arte vertical opcional exibida em telas pequenas. */
  imageUrlMobile: string;
  /** Versões da arte desktop por largura ('' quando há um arquivo só). */
  srcset: string;
  /** Versões da arte mobile por largura ('' quando há um arquivo só). */
  mobileSrcset: string;
  link?: string;
  buttonText?: string;
}

interface HomeCuradoriaCard {
  slug: string;
  /** Endereço canônico da viagem, usado no link do card. */
  path: string;
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
  description?: string;
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
  imports: [CommonModule, RouterLink, FormsModule, NewsletterSignupComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly fallbackTripImage = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&h=350&fit=crop';
  currentSlide = 0;
  /** Tags cadastradas, para resolver o badge de cada card por `tagId`. */
  tags: TripTag[] = [];
  searchDestination = '';
  searchStartDate = '';
  searchEndDate = '';
  private slideInterval: any;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly ssrFetchCache = inject(SsrFetchCache);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor(
    private tripService: TripService,
    private testimonialService: TestimonialService,
    private bannerService: BannerService,
    private postService: PostService,
    private aboutContentService: AboutContentService,
    private siteContentService: SiteContentService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private seo: SeoService,
    private tagService: TagService
  ) {}

  /** Badge da tag do card, ou null se a viagem não tem tag / a tag sumiu. */
  tagBadge(tagId: number | null | undefined): TagBadge | null {
    return resolveTagBadge(tagId, this.tags);
  }

  homeAbout: HomeAboutContent = JSON.parse(JSON.stringify(DEFAULT_ABOUT_CONTENT.home));
  homeContent: SiteHomeContent = { ...DEFAULT_HOME_CONTENT };

  bannerSlides: HomeBannerSlide[] = [];

  /**
   * Largura em que o banner desktop aparece: a tela toda, até 2400 px (limite
   * de max-height 900 px na proporção 1920×720). O navegador usa isso para
   * escolher a versão certa do srcset (já considerando telas Retina/4K).
   */
  readonly bannerSizes = '(min-width: 2400px) 2400px, 100vw';

  /** Seções de viagem geradas dinamicamente, uma por menu visível do header. */
  tripSections: HomeTripSection[] = [];

  /** Viagens ativas já carregadas (reprocessadas quando o header muda). */
  private activeTrips: Trip[] = [];

  /** Menu que recebe layout especial de curadoria (cards grandes alternados). */
  private readonly curadoriaMenuId = 'curadoria';

  /** Máximo de viagens exibidas por categoria na home (resto vai no "Ver mais"). */
  private readonly homeTripsPerSection = 6;

  continents: HomeWorldCard[] = [];

  curadoria: HomeCuradoriaCard[] = [];

  get culturalTripsTitle(): string {
    return this.siteContentService.getCurrentHeaderLinks().find(link => link.id === this.curadoriaMenuId)?.label
      || this.homeContent.curadoriaTitle;
  }

  testimonials: HomeTestimonialCard[] = [];

  blogPosts: HomeBlogPostCard[] = [];

  ngOnInit() {
    this.applySeo();
    // Topo da página: carregam já.
    this.loadBanners();
    this.loadHeaderMenus();
    this.loadHomeContent();
    if (!this.isBrowser) {
      // Servidor (SSR): carrega os dados de todas as seções, para o texto delas
      // sair no HTML. `heroSettled` continua false, então as fotos dessas
      // seções não vão no HTML — só a do 1º banner, que é a imagem principal.
      this.loadBelowTheFold();
      return;
    }

    if (this.ssrFetchCache.active) {
      // A página veio pronta do servidor e os dados das seções estão dentro do
      // HTML (sem rede). Carrega já: se esperasse o banner, as seções que o
      // visitante já está vendo sumiriam e voltariam logo depois.
      this.loadBelowTheFold();
    }
    // Seções de baixo (viagens, blog, depoimentos, sobre): os dados (quando não
    // vieram do servidor) e as fotos esperam o banner aparecer — ver
    // settleHero(). Rede de segurança: no máximo 4 s.
    this.heroTimer = setTimeout(() => this.settleHero(), 4000);
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
      title: 'Unitur | Agência de Viagens e Turismo',
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
    if (this.heroTimer) {
      clearTimeout(this.heroTimer);
    }
  }

  startSlideShow() {
    // O autoplay do carousel é puramente visual; não roda no SSR.
    if (!this.isBrowser) return;
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
    // Roda fora da zona do Angular para não disparar change detection a cada tick,
    // mas força detecção manualmente ao avançar o slide.
    this.ngZone.runOutsideAngular(() => {
      this.slideInterval = setInterval(() => {
        this.ngZone.run(() => {
          this.heroSettled = true;
          this.currentSlide = (this.currentSlide + 1) % this.bannerSlides.length;
          this.cdr.detectChanges();
        });
      }, 5000);
    });
  }

  /**
   * Em telas pequenas o carrossel só assume a proporção vertical quando existe pelo
   * menos uma arte mobile cadastrada; caso contrário mantém a proporção larga.
   */
  get hasMobileBannerArt(): boolean {
    // Enquanto carrega, assume arte mobile (o caso normal), para o espaço
    // reservado já ter a altura certa no celular.
    if (!this.bannersLoaded) return true;
    return this.bannerSlides.some(slide => !!slide.imageUrlMobile);
  }

  /**
   * false até a 1ª resposta dos banners. Antes disso a home já mostra o espaço
   * do carrossel vazio: se o banner surgisse depois, empurraria a página toda
   * para baixo, e o Lighthouse mede isso como CLS (o site chegou a 0,7, quando
   * o limite bom é 0,1).
   */
  bannersLoaded = false;

  /**
   * Libera as demais imagens da home: slides seguintes do carrossel e as fotos
   * das seções (viagens, destinos, curadoria, blog, sobre, depoimentos).
   *
   * Fica false até a imagem do 1º banner carregar (ou não haver banner, ou 4 s,
   * ou o visitante usar as setas). Sem isso, como as seções surgem aos poucos,
   * o Chrome antecipava fotos "quase visíveis" (o PNG de 1,3 MB do blog, por
   * exemplo) e o banner, que é a imagem principal da página (LCP), dividia a
   * conexão com elas. Os quadros das fotos têm altura fixa, então nada pula.
   */
  heroSettled = false;
  private heroTimer?: ReturnType<typeof setTimeout>;

  settleHero() {
    if (this.heroSettled) return;
    this.heroSettled = true;
    if (this.heroTimer) clearTimeout(this.heroTimer);
    this.loadBelowTheFold();
    this.cdr.markForCheck();
  }

  /** Fundo desfocado de cada slide = a própria imagem já baixada (sem download extra). */
  backdropById: Record<string, string> = {};

  /**
   * Imagem de um slide carregou: o fundo desfocado passa a usar a mesma imagem
   * (`currentSrc`, já em cache, na versão que o navegador escolheu para a tela).
   * No 1º slide, espera a imagem ser pintada (2 frames + folga) antes de liberar
   * o resto da home; assim nada mais disputa a conexão antes do LCP.
   */
  onSlideImageLoad(index: number, slideId: string, event: Event) {
    const src = (event.target as HTMLImageElement | null)?.currentSrc;
    if (src && this.backdropById[slideId] !== src) {
      this.backdropById = { ...this.backdropById, [slideId]: src };
      this.cdr.markForCheck();
    }
    if (index !== 0 || this.heroSettled) return;
    if (!this.isBrowser || typeof requestAnimationFrame !== 'function') {
      this.settleHero();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => this.settleHero(), 300)));
  }

  private belowTheFoldLoaded = false;

  /**
   * Na hidratação, a imagem do 1º banner veio no HTML do servidor e pode ter
   * terminado de carregar antes de o app existir — aí o evento `load` já passou
   * e ninguém avisaria que o banner apareceu. Confere o estado atual da imagem.
   */
  private checkFirstSlideAlreadyLoaded() {
    if (!this.isBrowser || this.heroSettled || this.bannerSlides.length === 0) return;
    const image = this.host.nativeElement.querySelector<HTMLImageElement>('.carousel-slide img');
    if (!image || !image.complete) return;

    if (image.naturalWidth > 0) {
      this.onSlideImageLoad(0, this.bannerSlides[0].id, { target: image } as unknown as Event);
    } else {
      this.settleHero(); // a imagem falhou antes de o app assumir a página
    }
  }

  /** Dados das seções abaixo do banner. Roda uma vez só. */
  private loadBelowTheFold() {
    if (this.belowTheFoldLoaded) return;
    this.belowTheFoldLoaded = true;
    this.loadTags();
    this.loadTrips();
    this.loadTestimonials();
    this.loadPosts();
    this.loadAboutContent();
  }

  nextSlide() {
    if (this.bannerSlides.length === 0) return;
    this.settleHero();
    this.currentSlide = (this.currentSlide + 1) % this.bannerSlides.length;
    this.startSlideShow();
  }

  prevSlide() {
    if (this.bannerSlides.length === 0) return;
    this.settleHero();
    this.currentSlide = this.currentSlide === 0 ? this.bannerSlides.length - 1 : this.currentSlide - 1;
    this.startSlideShow();
  }

  goToSlide(index: number) {
    this.settleHero();
    this.currentSlide = index;
    this.startSlideShow();
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
      totalPages: 1,
      hasNextPage: false
    };

    this.tripService.getTrips({ status: 'active', limit: 100, light: true }).pipe(
      catchError(() => of(emptyResponse))
    ).subscribe(response => {
      this.activeTrips = response.data;
      this.buildTripSections();
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
      .sort(compareHomeTripMenus);

    const culturalMenu = this.siteContentService.getCurrentHeaderLinks().find(link => link.id === this.curadoriaMenuId);
    this.curadoria = culturalMenu?.visible ? this.activeTrips
      .filter(trip => this.belongsToMenu(trip, this.curadoriaMenuId) && trip.showOnHome !== false)
      .map(trip => this.mapCuradoriaCard(trip)) : [];

    this.tripSections = menus
      .map(menu => {
        // Peregrinação usa o papel "Guia Espiritual Convidado"; demais usam "Guia".
        const isPeregrinacao = /^peregrina/i.test(menu.label) || menu.id === 'peregrinacao';
        const guideRole = isPeregrinacao ? 'Guia Espiritual Convidado' : 'Guia';
        // Todas as viagens ativas da categoria (base do "Ver mais", que leva à
        // listagem completa) e as que o admin marcou para aparecer na home.
        const menuTrips = this.activeTrips.filter(trip => this.belongsToMenu(trip, menu.id));
        const homeTrips = menuTrips.filter(trip => trip.showOnHome !== false);
        const trips = homeTrips
          .slice(0, this.homeTripsPerSection)
          .map(trip => this.mapTripCard(trip, guideRole));

        return {
          id: menu.id,
          title: menu.label,
          tagLabel: isPeregrinacao ? 'Peregrinação' : menu.label,
          isRegular: !isPeregrinacao,
          trips,
          route: menu.route,
          // "Ver mais" quando a listagem completa da categoria tem mais viagens
          // do que as exibidas aqui na home.
          hasMore: menuTrips.length > trips.length
        } as HomeTripSection;
      })
      .filter(section => section.trips.length > 0);
  }

  private loadTags() {
    this.tagService.getAllTags().pipe(
      timeout(12000),
      catchError(() => of([] as TripTag[]))
    ).subscribe(tags => {
      this.tags = tags;
      // markForCheck e não detectChanges: o cache do TagService reemite de forma
      // síncrona quando já está quente, e forçar CD dentro do ngOnInit seria
      // reentrante.
      this.cdr.markForCheck();
    });
  }

  private loadBanners() {
    this.bannerService.getActiveBanners().pipe(
      timeout(12000),
      catchError(() => of([] as Banner[]))
    ).subscribe(banners => {
      this.bannersLoaded = true;
      this.bannerSlides = banners
        .filter(banner => banner.imageUrl)
        .map(banner => {
          const imageUrl = this.normalizeImage(banner.imageUrl);
          const imageUrlMobile = banner.imageUrlMobile ? this.normalizeImage(banner.imageUrlMobile) : '';
          const srcset = srcsetForImage(banner.imageSrcset, imageUrl);
          const mobileSrcset = imageUrlMobile ? srcsetForImage(banner.imageMobileSrcset, imageUrlMobile) : '';
          return {
            id: String(banner.id),
            imageUrl,
            imageUrlMobile,
            srcset,
            mobileSrcset,
            link: banner.link || '',
            buttonText: banner.buttonText || ''
          };
        });
      this.currentSlide = 0;
      if (this.bannerSlides.length === 0) {
        // Sem banner não há imagem principal a esperar.
        this.settleHero();
      }
      if (this.bannerSlides.length > 0) {
        this.startSlideShow();
      }
      this.cdr.detectChanges();
      this.checkFirstSlideAlreadyLoaded();
    });
  }

  private loadTestimonials() {
    const emptyResponse = {
      data: [],
      total: 0,
      page: 1,
      limit: 6,
      totalPages: 1,
      hasNextPage: false
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
    // Só os 3 mais recentes: antes a home baixava os ~360 posts (4+ MB com o HTML
    // de cada um) para exibir 3 cards.
    this.postService.getLatestPosts(3).pipe(
      timeout(12000),
      catchError(() => of([] as Post[]))
    ).subscribe(posts => {
      const nextPosts = posts.map(post => this.mapBlogPostCard(post));
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
    const slug = trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id);
    const card: HomeTripCard = {
      slug,
      path: tripLinkPath(trip, slug),
      tagId: trip.tagId ?? null,
      title: trip.title,
      country: trip.country || trip.destination || 'A definir',
      date: trip.period || this.formatTripPeriod(trip.startDate),
      duration: trip.duration ? `${trip.duration} dias` : 'A definir',
      image: this.normalizeImage(trip.mainImage),
      imagePosition: trip.mainImagePosition || '50% 50%',
      imageFit: trip.mainImageFit || 'cover',
      imageRotation: Number(trip.mainImageRotation || 0),
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: (trip.spiritualGuide || '').trim(),
      guideRole,
      coordinator: (trip.coordinator || '').trim()
    };
    return card;
  }

  private mapCuradoriaCard(trip: Trip): HomeCuradoriaCard {
    const destination = trip.country || trip.destination || 'Destino a definir';
    const slug = trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id);

    return {
      slug,
      path: tripLinkPath(trip, slug),
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
        if (existing.image === this.fallbackTripImage && trip.mainImage) {
          existing.image = this.normalizeImage(trip.mainImage);
        }
        return;
      }

      cards.set(key, {
        name: destination,
        icon: this.getDestinationIcon(destination),
        image: this.normalizeImage(trip.mainImage),
        // Sem frase genérica: se a viagem não tiver descrição, o card mostra só o nome do destino.
        description: trip.shortDescription?.trim() || '',
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

