import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  constructor(
    private tripService: TripService,
    private testimonialService: TestimonialService,
    private bannerService: BannerService,
    private postService: PostService,
    private aboutContentService: AboutContentService,
    private exchangeRateService: ExchangeRateService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  homeAbout: HomeAboutContent = JSON.parse(JSON.stringify(DEFAULT_ABOUT_CONTENT.home));

  bannerImages: string[] = [];

  peregrinacoes: HomeTripCard[] = [];

  regulares: HomeTripCard[] = [];

  continents: HomeWorldCard[] = [];

  curadoria: HomeCuradoriaCard[] = [];

  testimonials: HomeTestimonialCard[] = [];

  blogPosts: HomeBlogPostCard[] = [];

  ngOnInit() {
    this.loadBanners();
    this.loadTrips();
    this.loadTestimonials();
    this.loadPosts();
    this.loadAboutContent();
  }

  private loadAboutContent() {
    this.aboutContentService.content$.subscribe(content => {
      this.homeAbout = content.home;
      this.cdr.detectChanges();
    });
    this.aboutContentService.load().subscribe();
  }

  ngOnDestroy() {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  startSlideShow() {
    this.slideInterval = setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  nextSlide() {
    if (this.bannerImages.length === 0) {
      return;
    }

    this.currentSlide = (this.currentSlide + 1) % this.bannerImages.length;
  }

  prevSlide() {
    if (this.bannerImages.length === 0) {
      return;
    }

    this.currentSlide = this.currentSlide === 0 ? this.bannerImages.length - 1 : this.currentSlide - 1;
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
      const activeTrips = response.data;
      this.peregrinacoes = activeTrips
        .filter(trip => trip.tripType === 'peregrinacao')
        .map(trip => this.mapTripCard(trip, 'Guia Espiritual Convidado'));
      this.regulares = activeTrips
        .filter(trip => trip.tripType === 'regular')
        .map(trip => this.mapTripCard(trip, 'Guia'));
      this.curadoria = activeTrips
        .filter(trip => trip.tripType === 'curadoria')
        .map(trip => this.mapCuradoriaCard(trip));
      this.continents = this.mapWorldCards(activeTrips);

      this.cdr.detectChanges();
    });
  }

  private loadBanners() {
    this.bannerService.getActiveBanners().pipe(
      timeout(12000),
      catchError(() => of([]))
    ).subscribe(banners => {
      this.bannerImages = banners
        .filter(banner => banner.imageUrl)
        .map(banner => this.normalizeImage(banner.imageUrl));
      this.currentSlide = 0;
      if (this.bannerImages.length > 0) {
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
      guide: trip.spiritualGuide || 'A definir',
      guideRole,
      coordinator: trip.coordinator || 'Equipe Unitur'
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

