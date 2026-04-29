import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  guide: string;
  guideRole: string;
  coordinator: string;
  operator: string;
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
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  currentSlide = 0;
  private slideInterval: any;

  constructor(private tripService: TripService) {}

  bannerImages = [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1600&h=700&fit=crop'
  ];

  peregrinacoes: HomeTripCard[] = [
    {
      slug: 'terra-santa',
      title: 'Terra Santa',
      country: 'Israel',
      date: 'Junho 2026',
      duration: '12 dias',
      image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=500&h=350&fit=crop',
      price: 'R$ 8.999',
      spots: '8 vagas',
      guide: 'Pe. João Batista',
      guideRole: 'Guia Espiritual',
      coordinator: 'Ana Silva',
      operator: 'Unitur'
    },
    {
      slug: 'caminho-de-santiago',
      title: 'Caminho de Santiago',
      country: 'Espanha',
      date: 'Agosto 2026',
      duration: '15 dias',
      image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=500&h=350&fit=crop',
      price: 'R$ 6.499',
      spots: '12 vagas',
      guide: 'Pe. Carlos Mendes',
      guideRole: 'Guia Espiritual',
      coordinator: 'Carlos Mendes',
      operator: 'Unitur'
    },
    {
      title: 'Fátima e Lourdes',
      country: 'Portugal e França',
      slug: 'fatima-e-lourdes',
      date: 'Setembro 2026',
      duration: '10 dias',
      image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=500&h=350&fit=crop',
      price: 'R$ 7.299',
      spots: '15 vagas',
      guide: 'Pe. André Lima',
      guideRole: 'Guia Espiritual',
      coordinator: 'Marina Costa',
      operator: 'Unitur'
    }
  ];

  regulares: HomeTripCard[] = [
    {
      slug: 'europa-classica',
      title: 'Europa Classica',
      country: 'Italia, Franca e Portugal',
      date: 'Outubro 2026',
      duration: '14 dias',
      image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=500&h=350&fit=crop',
      price: 'R$ 9.890',
      spots: '10 vagas',
      guide: 'Equipe Unitur',
      guideRole: 'Guia',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur'
    },
    {
      slug: 'nordeste-encantador',
      title: 'Nordeste Encantador',
      country: 'Brasil',
      date: 'Julho 2026',
      duration: '8 dias',
      image: 'https://images.unsplash.com/photo-1516306580123-e6e52b1b7b5f?w=500&h=350&fit=crop',
      price: 'R$ 4.290',
      spots: '14 vagas',
      guide: 'Equipe Unitur',
      guideRole: 'Guia',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur'
    },
    {
      slug: 'patagonia-completa',
      title: 'Patagonia Completa',
      country: 'Argentina e Chile',
      date: 'Novembro 2026',
      duration: '11 dias',
      image: 'https://images.unsplash.com/photo-1531804159968-24716780d214?w=500&h=350&fit=crop',
      price: 'R$ 11.500',
      spots: '6 vagas',
      guide: 'Equipe Unitur',
      guideRole: 'Guia',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur'
    }
  ];

  continents = [
    {
      name: 'Europa',
      icon: '🏰',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=400&fit=crop',
      description: 'Paris, Roma, Lisboa e muito mais'
    },
    {
      name: 'Américas',
      icon: '🌎',
      image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=600&h=400&fit=crop',
      description: 'Machu Picchu, Patagônia e Caribe'
    },
    {
      name: 'Ásia',
      icon: '🏯',
      image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&h=400&fit=crop',
      description: 'Japão, Tailândia, Bali e Dubai'
    },
    {
      name: 'Oceania',
      icon: '🦘',
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
      guide: trip.guide,
      coordinator: trip.coordinator,
      operator: trip.operator,
      image: trip.image
    };
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
      if (!response.data.length) {
        return;
      }

      const activeTrips = response.data.filter(trip => trip.status !== 'inactive');
      const peregrinacoes = activeTrips.filter(trip => trip.tripType === 'peregrinacao');
      const regulares = activeTrips.filter(trip => trip.tripType === 'regular');
      if (peregrinacoes.length) {
        this.peregrinacoes = peregrinacoes.map(trip => this.mapTripCard(trip, 'Guia Espiritual'));
      }

      if (regulares.length) {
        this.regulares = regulares.map(trip => this.mapTripCard(trip, 'Guia'));
      }
    });
  }

  private mapTripCard(trip: Trip, guideRole: string): HomeTripCard {
    return {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      country: trip.country || trip.destination || 'A definir',
      date: trip.period || this.formatTripPeriod(trip.startDate),
      duration: trip.duration ? `${trip.duration} dias` : 'A definir',
      image: trip.mainImage || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&h=350&fit=crop',
      price: trip.price ? `R$ ${Number(trip.price).toLocaleString('pt-BR')}` : 'Consulte',
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      guide: trip.spiritualGuide || 'A definir',
      guideRole,
      coordinator: trip.coordinator || 'Equipe Unitur',
      operator: trip.operator || 'Unitur'
    };
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
