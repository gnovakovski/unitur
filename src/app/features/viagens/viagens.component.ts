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
  guide: string;
  coordinator: string;
  operator: string;
  category: string;
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
      price: 'R$ 8.999',
      spots: '8 vagas',
      guide: 'Pe. Joao Batista',
      coordinator: 'Ana Silva',
      operator: 'Unitur',
      category: 'Viagens de Peregrinacao'
    },
    {
      slug: 'caminho-de-santiago',
      title: 'Caminho de Santiago',
      location: 'Espanha',
      date: 'Agosto 2026',
      duration: '15 dias',
      image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=500&h=350&fit=crop',
      price: 'R$ 6.499',
      spots: '12 vagas',
      guide: 'Pe. Carlos Mendes',
      coordinator: 'Carlos Mendes',
      operator: 'Unitur',
      category: 'Viagens de Peregrinacao'
    },
    {
      slug: 'fatima-e-lourdes',
      title: 'Fatima e Lourdes',
      location: 'Portugal e Franca',
      date: 'Setembro 2026',
      duration: '10 dias',
      image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=500&h=350&fit=crop',
      price: 'R$ 7.299',
      spots: '15 vagas',
      guide: 'Pe. Andre Lima',
      coordinator: 'Marina Costa',
      operator: 'Unitur',
      category: 'Viagens de Peregrinacao'
    },
    {
      slug: 'europa-classica',
      title: 'Europa Classica',
      location: 'Franca, Italia, Inglaterra e Espanha',
      date: 'Julho 2026',
      duration: '14 dias',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&h=350&fit=crop',
      price: 'R$ 9.999',
      spots: '10 vagas',
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur',
      category: 'Viagens Regulares'
    },
    {
      slug: 'caribe-paradisiaco',
      title: 'Caribe Paradisiaco',
      location: 'Republica Dominicana',
      date: 'Outubro 2026',
      duration: '7 dias',
      image: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=500&h=350&fit=crop',
      price: 'R$ 5.499',
      spots: '20 vagas',
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur',
      category: 'Viagens Regulares'
    },
    {
      slug: 'asia-mistica',
      title: 'Asia Mistica',
      location: 'Japao',
      date: 'Novembro 2026',
      duration: '16 dias',
      image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=500&h=350&fit=crop',
      price: 'R$ 11.999',
      spots: '8 vagas',
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur',
      category: 'Viagens Regulares'
    },
    {
      slug: 'america-do-sul',
      title: 'America do Sul',
      location: 'Peru',
      date: 'Dezembro 2026',
      duration: '10 dias',
      image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=500&h=350&fit=crop',
      price: 'R$ 6.799',
      spots: '14 vagas',
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur',
      category: 'Viagens Regulares'
    },
    {
      slug: 'lua-de-mel-nas-maldivas',
      title: 'Lua de Mel nas Maldivas',
      location: 'Maldivas',
      date: 'Janeiro 2027',
      duration: '12 dias',
      image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=500&h=350&fit=crop',
      price: 'R$ 14.999',
      spots: '6 vagas',
      guide: 'Consultor especializado',
      coordinator: 'Ana Silva',
      operator: 'Unitur',
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
    return this.viagens.filter(v => v.category === this.selectedCategory);
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
      guide: trip.guide,
      coordinator: trip.coordinator,
      operator: trip.operator,
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
      price: trip.price ? `R$ ${Number(trip.price).toLocaleString('pt-BR')}` : 'Consulte',
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      guide: trip.spiritualGuide || 'A definir',
      coordinator: trip.coordinator || 'Equipe Unitur',
      operator: trip.operator || 'Unitur',
      category: this.getCategoryLabel(trip.tripType)
    };
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
