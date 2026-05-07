import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, timeout } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { PaginatedResponse, TripService } from '../../core/services/trip.service';

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
  title: string;
  subtitle: string;
  description: string;
  image: string;
  curator: string;
  tags: string[];
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
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  bannerImages = [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1600&h=700&fit=crop'
  ];

  peregrinacoes: HomeTripCard[] = [];

  regulares: HomeTripCard[] = [];

  continents = [
    {
      name: 'Europa',
      icon: 'EU',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=400&fit=crop',
      description: 'Paris, Roma, Lisboa e muito mais'
    },
    {
      name: 'Américas',
      icon: 'AM',
      image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=600&h=400&fit=crop',
      description: 'Machu Picchu, Patagônia e Caribe'
    },
    {
      name: 'Ásia',
      icon: 'AS',
      image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&h=400&fit=crop',
      description: 'Japão, Tailândia, Bali e Dubai'
    },
    {
      name: 'Oceania',
      icon: 'OC',
      image: 'https://images.unsplash.com/photo-1469521669194-babb45599def?w=600&h=400&fit=crop',
      description: 'Austrália, Nova Zelândia e ilhas do Pacífico'
    }
  ];

  curadoria: HomeCuradoriaCard[] = [
    {
      title: 'Lua de Mel dos Sonhos',
      subtitle: 'Maldivas + Dubai',
      description: 'A combinação perfeita de romance e luxo. Praias paradisíacas e experiências exclusivas.',
      image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&h=400&fit=crop',
      curator: 'Recomendado por Ana Silva',
      tags: ['Romântico', 'Luxo', 'Praia']
    },
    {
      title: 'Aventura Radical',
      subtitle: 'Nova Zelândia',
      description: 'Para os aventureiros de plantão. Bungee jump, trilhas e paisagens de tirar o fôlego.',
      image: 'https://images.unsplash.com/photo-1469521669194-babb45599def?w=600&h=400&fit=crop',
      curator: 'Recomendado por Carlos Mendes',
      tags: ['Aventura', 'Natureza', 'Esportes']
    },
    {
      title: 'Cultura e História',
      subtitle: 'Grécia e Turquia',
      description: 'Mergulhe na história antiga. Ruínas, museus e gastronomia mediterrânea.',
      image: 'https://images.unsplash.com/photo-1503152394-c571994fd383?w=600&h=400&fit=crop',
      curator: 'Recomendado por Maria Costa',
      tags: ['Cultura', 'História', 'Gastronomia']
    }
  ];

  testimonials = [
    {
      name: 'Maria Silva',
      text: 'A viagem para Terra Santa foi transformadora. Cada detalhe foi cuidadosamente planejado pela equipe.',
      rating: 5,
      image: 'https://i.pravatar.cc/150?img=1',
      trip: 'Terra Santa'
    },
    {
      name: 'João Santos',
      text: 'Experiência incrível no Caminho de Santiago. Suporte impecável durante toda a jornada.',
      rating: 5,
      image: 'https://i.pravatar.cc/150?img=12',
      trip: 'Caminho de Santiago'
    },
    {
      name: 'Ana Costa',
      text: 'A lua de mel nas Maldivas superou todas as expectativas. Simplesmente perfeito!',
      rating: 5,
      image: 'https://i.pravatar.cc/150?img=5',
      trip: 'Maldivas'
    }
  ];

  blogPosts = [
    {
      title: 'Como planejar uma viagem sem imprevistos',
      slug: 'como-planejar-uma-viagem-sem-imprevistos',
      excerpt: 'Veja pontos essenciais para organizar documentos, roteiro, hospedagem e transporte antes de embarcar.',
      image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=900&h=600&fit=crop',
      date: 'Abril 2026',
      category: 'Dicas de viagem'
    },
    {
      title: 'Destinos para conhecer em grupo',
      slug: 'destinos-para-conhecer-em-grupo',
      excerpt: 'Sugestões para quem busca experiências completas, seguras e bem acompanhadas em viagens nacionais e internacionais.',
      image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&h=600&fit=crop',
      date: 'Abril 2026',
      category: 'Destinos'
    },
    {
      title: 'O que levar na mala de mão',
      slug: 'o-que-levar-na-mala-de-mao',
      excerpt: 'Uma lista prática para manter documentos, itens pessoais e objetos importantes sempre por perto.',
      image: 'https://images.unsplash.com/photo-1553531384-cc64ac80f931?w=900&h=600&fit=crop',
      date: 'Abril 2026',
      category: 'Dicas de viagem'
    }
  ];

  ngOnInit() {
    this.continents = [
      ...this.continents,
      {
        name: 'Africa',
        icon: 'AF',
        image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600&h=400&fit=crop',
        description: 'Africa do Sul, Marrocos, Egito e safaris'
      },
      {
        name: 'Brasil',
        icon: 'BR',
        image: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=600&h=400&fit=crop',
        description: 'Nordeste, Sul, Amazonia e destinos nacionais'
      }
    ];
    this.startSlideShow();
    this.loadTrips();
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
    this.currentSlide = (this.currentSlide + 1) % this.bannerImages.length;
  }

  prevSlide() {
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
      timeout(12000),
      catchError(() => of(emptyResponse))
    ).subscribe(response => {
      const activeTrips = response.data.filter(trip => trip.status !== 'inactive');
      const peregrinacoes = activeTrips.filter(trip => trip.tripType === 'peregrinacao');
      const regulares = activeTrips.filter(trip => trip.tripType === 'regular');
      this.peregrinacoes = peregrinacoes.map(trip => this.mapTripCard(trip, 'Guia Espiritual'));
      this.regulares = regulares.map(trip => this.mapTripCard(trip, 'Guia'));
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
    return image || this.fallbackTripImage;
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
}

