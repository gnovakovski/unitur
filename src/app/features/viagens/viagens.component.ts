import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, of, timeout } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { TripService } from '../../core/services/trip.service';

interface ViagemCard {
  slug: string;
  title: string;
  location: string;
  date: string;
  duration: string;
  image: string;
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
export class ViagensComponent implements OnInit {
  loading = false;
  error = '';

  viagens: ViagemCard[] = [
    {
      slug: 'terra-santa',
      title: 'Terra Santa',
      location: 'Israel',
      date: 'Junho 2026',
      duration: '12 dias',
      image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=500&h=350&fit=crop',
      price: 'R$25.000,00',
      foreignPrice: 'U$4.500,00',
      spots: '8 vagas',
      showSpots: true,
      guide: 'Pe. Joao Batista',
      coordinator: 'Ana Silva',
      category: 'Viagens de Peregrinacao'
    },
    {
      slug: 'caminho-de-santiago',
      title: 'Caminho de Santiago',
      location: 'Espanha',
      date: 'Agosto 2026',
      duration: '15 dias',
      image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=500&h=350&fit=crop',
      price: 'R$19.900,00',
      foreignPrice: 'U$3.580,00',
      spots: '12 vagas',
      showSpots: true,
      guide: 'Pe. Carlos Mendes',
      coordinator: 'Carlos Mendes',
      category: 'Viagens de Peregrinacao'
    },
    {
      slug: 'fatima-e-lourdes',
      title: 'Fatima e Lourdes',
      location: 'Portugal e Franca',
      date: 'Setembro 2026',
      duration: '10 dias',
      image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=500&h=350&fit=crop',
      price: 'R$22.500,00',
      foreignPrice: 'U$4.050,00',
      spots: '15 vagas',
      showSpots: true,
      guide: 'Pe. Andre Lima',
      coordinator: 'Marina Costa',
      category: 'Viagens de Peregrinacao'
    },
    {
      slug: 'europa-classica',
      title: 'Europa Classica',
      location: 'Franca, Italia, Inglaterra e Espanha',
      date: 'Julho 2026',
      duration: '14 dias',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&h=350&fit=crop',
      price: 'R$29.900,00',
      foreignPrice: 'U$5.380,00',
      spots: '10 vagas',
      showSpots: true,
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      category: 'Viagens Regulares'
    },
    {
      slug: 'caribe-paradisiaco',
      title: 'Caribe Paradisiaco',
      location: 'Republica Dominicana',
      date: 'Outubro 2026',
      duration: '7 dias',
      image: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=500&h=350&fit=crop',
      price: 'R$5.499,00',
      spots: '20 vagas',
      showSpots: true,
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      category: 'Viagens Regulares'
    },
    {
      slug: 'asia-mistica',
      title: 'Asia Mistica',
      location: 'Japao',
      date: 'Novembro 2026',
      duration: '16 dias',
      image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=500&h=350&fit=crop',
      price: 'R$31.900,00',
      foreignPrice: 'U$5.740,00',
      spots: '8 vagas',
      showSpots: true,
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      category: 'Viagens Regulares'
    },
    {
      slug: 'america-do-sul',
      title: 'America do Sul',
      location: 'Peru',
      date: 'Dezembro 2026',
      duration: '10 dias',
      image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=500&h=350&fit=crop',
      price: 'R$18.900,00',
      foreignPrice: 'U$3.400,00',
      spots: '14 vagas',
      showSpots: true,
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      category: 'Viagens Regulares'
    },
    {
      slug: 'lua-de-mel-nas-maldivas',
      title: 'Lua de Mel nas Maldivas',
      location: 'Maldivas',
      date: 'Janeiro 2027',
      duration: '12 dias',
      image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=500&h=350&fit=crop',
      price: 'R$39.900,00',
      foreignPrice: 'U$7.180,00',
      spots: '6 vagas',
      showSpots: true,
      guide: 'Consultor especializado',
      coordinator: 'Ana Silva',
      category: 'Viagens de Curadoria'
    }
  ];

  selectedCategory = 'Viagens de Peregrinacao';
  categories = ['Viagens de Peregrinacao', 'Viagens Regulares', 'Viagens de Curadoria'];

  constructor(
    private route: ActivatedRoute,
    private tripService: TripService
  ) {}

  ngOnInit() {
    const path = this.route.snapshot.routeConfig?.path || '';
    const categoryByPath: Record<string, string> = {
      'viagens/peregrinacao': 'Viagens de Peregrinacao',
      'viagens/regulares': 'Viagens Regulares',
      'viagens/curadoria': 'Viagens de Curadoria'
    };

    this.selectedCategory = categoryByPath[path] || this.categories[0];
    this.loadTrips();
  }

  get filtered() {
    const destination = (this.route.snapshot.queryParamMap.get('destination') || '').trim().toLowerCase();
    const startDate = this.parseFilterDate(this.route.snapshot.queryParamMap.get('startDate'));
    const endDate = this.parseFilterDate(this.route.snapshot.queryParamMap.get('endDate'));

    return this.viagens.filter(v => {
      const matchesCategory = v.category === this.selectedCategory;
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

  getTripQuery(trip: ViagemCard): Record<string, string> {
    return {
      title: trip.title,
      destination: trip.location,
      date: trip.date,
      duration: trip.duration,
      price: trip.price,
      spots: trip.spots,
      showSpots: String(trip.showSpots),
      foreignPrice: trip.foreignPrice || '',
      guide: trip.guide,
      coordinator: trip.coordinator,
      image: trip.image,
      category: trip.category
    };
  }

  private loadTrips() {
    this.loading = true;
    this.error = '';

    this.tripService.getTrips({ limit: 100 }).pipe(
      timeout(12000),
      catchError((err) => {
        console.error('Erro ao carregar viagens publicas', err);
        this.error = 'Nao foi possivel carregar as viagens cadastradas. Exibindo viagens padrao.';
        return of({ data: [], total: 0, page: 1, limit: 100, totalPages: 1 });
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe(response => {
      const activeTrips = response.data.filter(trip => trip.status !== 'inactive');

      if (activeTrips.length) {
        this.viagens = activeTrips.map(trip => this.mapTrip(trip));
      }
    });
  }

  private mapTrip(trip: Trip): ViagemCard {
    return {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      location: trip.country || trip.destination || 'A definir',
      date: trip.period || this.formatPeriod(trip.startDate),
      duration: trip.duration ? `${trip.duration} dias` : 'A definir',
      image: trip.mainImage || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&h=350&fit=crop',
      price: trip.price ? `R$${Number(trip.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Consulte',
      foreignPrice: this.formatForeignPrice(trip.foreignPrice),
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: trip.spiritualGuide || 'A definir',
      coordinator: trip.coordinator || 'Equipe Unitur',
      category: this.getCategoryLabel(trip.tripType),
      startDate: trip.startDate
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
      peregrinacao: 'Viagens de Peregrinacao',
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
