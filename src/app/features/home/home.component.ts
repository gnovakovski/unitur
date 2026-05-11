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
import { formatForeignCurrency } from '../../core/utils/currency-format';

interface HomeTripCard {
  slug: string;
  title: string;
  country: string;
  date: string;
  duration: string;
  image: string;
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
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

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

  getTripQuery(trip: HomeTripCard): Record<string, string> {
    return {
      title: trip.title,
      destination: trip.country,
      date: trip.date,
      duration: trip.duration,
      price: trip.price,
      spots: trip.spots,
      showSpots: String(trip.showSpots),
      foreignPrice: trip.foreignPrice || '',
      guide: trip.guide,
      coordinator: trip.coordinator,
      image: trip.image
    };
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

    this.tripService.getTrips({ limit: 100 }).pipe(
      catchError(() => of(emptyResponse))
    ).subscribe(response => {
      const activeTrips = response.data.filter(trip => trip.status !== 'inactive');
      const peregrinacoes = activeTrips.filter(trip => trip.tripType === 'peregrinacao');
      const regulares = activeTrips.filter(trip => trip.tripType === 'regular');
      const curadoria = activeTrips.filter(trip => trip.tripType === 'curadoria');
      const nextPeregrinacoes = peregrinacoes.map(trip => this.mapTripCard(trip, 'Guia Espiritual'));
      const nextRegulares = regulares.map(trip => this.mapTripCard(trip, 'Guia'));
      const nextCuradoria = curadoria.map(trip => this.mapCuradoriaCard(trip));
      const nextContinents = this.mapWorldCards(activeTrips);

      if (activeTrips.length > 0 || this.hasNoTripContent()) {
        this.peregrinacoes = nextPeregrinacoes;
        this.regulares = nextRegulares;
        this.curadoria = nextCuradoria;
        this.continents = nextContinents;
      }
      this.cdr.detectChanges();
    });
  }

  private loadBanners() {
    this.bannerService.getBanners().pipe(
      timeout(12000),
      catchError(() => of([]))
    ).subscribe(banners => {
      this.bannerImages = banners
        .filter(banner => banner.status === 'active' && banner.imageUrl)
        .map(banner => this.normalizeImage(banner.imageUrl));
      this.currentSlide = 0;
      this.startSlideShow();
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
    return {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      country: trip.country || trip.destination || 'A definir',
      date: trip.period || this.formatTripPeriod(trip.startDate),
      duration: trip.duration ? `${trip.duration} dias` : 'A definir',
      image: this.normalizeImage(trip.mainImage),
      price: trip.price ? `R$${Number(trip.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Consulte',
      foreignPrice: this.formatForeignPrice(trip.foreignPrice),
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: trip.spiritualGuide || 'A definir',
      guideRole,
      coordinator: trip.coordinator || 'Equipe Unitur'
    };
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

  private hasNoTripContent(): boolean {
    return this.peregrinacoes.length === 0 &&
      this.regulares.length === 0 &&
      this.curadoria.length === 0 &&
      this.continents.length === 0;
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

  private formatForeignPrice(value?: number | string): string {
    return formatForeignCurrency(value);
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

