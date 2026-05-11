import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, timeout } from 'rxjs';
import { Trip } from '../../core/models/trip.model';
import { TripService } from '../../core/services/trip.service';
import { formatForeignCurrency } from '../../core/utils/currency-format';

interface ProductTrip {
  slug: string;
  title: string;
  eyebrow: string;
  destination: string;
  date: string;
  duration: string;
  price: string;
  foreignPrice?: string;
  spots: string;
  showSpots?: boolean;
  guide: string;
  coordinator: string;
  operator?: string;
  image: string;
  summary: string;
  experienceImages?: string[];
  highlights: string[];
  itinerary: Array<{ day: string; title: string; description: string }>;
  hotels?: Array<{ name: string; image: string }>;
  paymentMethods?: string[];
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
  itineraryExpanded = false;

  private readonly trips: ProductTrip[] = [
    {
      slug: 'terra-santa',
      title: 'Terra Santa',
      eyebrow: 'Peregrinação internacional',
      destination: 'Israel',
      date: 'Junho 2026',
      duration: '12 dias',
      price: 'R$25.000,00',
      foreignPrice: 'U$4.500,00',
      spots: '8 vagas',
      guide: 'Pe. JoÃ£o Batista',
      coordinator: 'Ana Silva',
      operator: 'Unitur',
      image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1600&h=900&fit=crop',
      summary: 'Uma jornada espiritual pelos lugares centrais da fé cristã, com acompanhamento especializado, roteiro equilibrado e suporte em todos os deslocamentos.',
      highlights: ['Jerusalém antiga', 'Mar da Galileia', 'Belém', 'Nazaré', 'Monte das Bem-Aventuranças'],
      itinerary: [
        { day: 'Dia 1', title: 'Embarque e acolhida', description: 'Encontro do grupo, orientações iniciais e embarque internacional.' },
        { day: 'Dias 2 a 5', title: 'Galileia e Nazaré', description: 'Visitas aos principais locais bíblicos da região norte, com momentos de reflexão.' },
        { day: 'Dias 6 a 10', title: 'Jerusalém e Belém', description: 'Roteiro pela Cidade Antiga, Via Dolorosa, Santo Sepulcro e locais históricos.' },
        { day: 'Dias 11 e 12', title: 'Encerramento', description: 'Tempo final para celebração, retorno e chegada ao Brasil.' }
      ],
      included: ['Hospedagem selecionada', 'Traslados do roteiro', 'Acompanhamento da Unitur', 'Seguro viagem', 'Café da manhã'],
      notIncluded: ['Passaporte e vistos', 'Despesas pessoais', 'Refeições não mencionadas', 'Passeios opcionais']
    },
    {
      slug: 'caminho-de-santiago',
      title: 'Caminho de Santiago',
      eyebrow: 'Experiência de peregrinação',
      destination: 'Espanha',
      date: 'Agosto 2026',
      duration: '15 dias',
      price: 'R$19.900,00',
      foreignPrice: 'U$3.580,00',
      spots: '12 vagas',
      guide: 'Pe. Carlos Mendes',
      coordinator: 'Carlos Mendes',
      operator: 'Unitur',
      image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=1600&h=900&fit=crop',
      summary: 'Uma experiência de caminhada, contemplação e convivência pelo tradicional Caminho de Santiago, com logística organizada e ritmo pensado para o grupo.',
      highlights: ['Santiago de Compostela', 'Vilarejos históricos', 'Caminhadas guiadas', 'Credencial do peregrino'],
      itinerary: [
        { day: 'Dia 1', title: 'Chegada à Espanha', description: 'Recepção e preparação para o início da caminhada.' },
        { day: 'Dias 2 a 12', title: 'Etapas do Caminho', description: 'Percursos diários com pausas, apoio e hospedagens planejadas.' },
        { day: 'Dias 13 a 15', title: 'Santiago e retorno', description: 'Chegada à Catedral, celebração final e retorno.' }
      ],
      included: ['Hospedagens', 'Apoio logístico', 'Traslados previstos', 'Seguro viagem', 'Orientação do grupo'],
      notIncluded: ['Equipamentos pessoais', 'Refeições extras', 'Despesas de documentação']
    },
    {
      slug: 'fatima-e-lourdes',
      title: 'Fátima e Lourdes',
      eyebrow: 'Roteiro mariano',
      destination: 'Portugal e França',
      date: 'Setembro 2026',
      duration: '10 dias',
      price: 'R$22.500,00',
      foreignPrice: 'U$4.050,00',
      spots: '15 vagas',
      guide: 'Pe. Andre Lima',
      coordinator: 'Marina Costa',
      operator: 'Unitur',
      image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1600&h=900&fit=crop',
      summary: 'Um roteiro por dois grandes santuários marianos da Europa, combinando espiritualidade, cultura, história e acompanhamento cuidadoso.',
      highlights: ['Santuário de Fátima', 'Lourdes', 'Lisboa', 'Experiências de oração', 'Cidades históricas'],
      itinerary: [
        { day: 'Dias 1 a 3', title: 'Lisboa e Fátima', description: 'Chegada, visitas culturais e programação no Santuário de Fátima.' },
        { day: 'Dias 4 a 8', title: 'França e Lourdes', description: 'Deslocamento para Lourdes e vivências no santuário.' },
        { day: 'Dias 9 e 10', title: 'Retorno', description: 'Encerramento do roteiro e retorno ao Brasil.' }
      ],
      included: ['Hospedagem', 'Traslados', 'Seguro viagem', 'Acompanhamento', 'Café da manhã'],
      notIncluded: ['Despesas pessoais', 'Refeições extras', 'Passeios opcionais']
    },
    {
      slug: 'europa-classica',
      title: 'Europa Clássica',
      eyebrow: 'Circuito cultural',
      destination: 'Paris, Roma, Londres e Barcelona',
      date: 'Saídas programadas',
      duration: '14 dias',
      price: 'R$29.900,00',
      foreignPrice: 'U$5.380,00',
      spots: 'Vagas limitadas',
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1600&h=900&fit=crop',
      summary: 'Um circuito para conhecer alguns dos destinos mais icônicos da Europa com conforto, organização e tempo para viver cada cidade.',
      highlights: ['Paris', 'Roma', 'Londres', 'Barcelona', 'Museus e monumentos'],
      itinerary: [
        { day: 'Etapa 1', title: 'Paris e Londres', description: 'Visitas panorâmicas, pontos históricos e experiências culturais.' },
        { day: 'Etapa 2', title: 'Roma e Vaticano', description: 'Roteiro por praças, basílicas, ruínas e principais cartões-postais.' },
        { day: 'Etapa 3', title: 'Barcelona', description: 'Arquitetura, gastronomia e tempo livre orientado.' }
      ],
      included: ['Hospedagem', 'Traslados do roteiro', 'Seguro viagem', 'Guias locais em passeios selecionados'],
      notIncluded: ['Ingressos opcionais', 'Refeições não indicadas', 'Despesas pessoais']
    },
    {
      slug: 'caribe-paradisiaco',
      title: 'Caribe Paradisíaco',
      eyebrow: 'Praias e descanso',
      destination: 'Cancún, Punta Cana e Aruba',
      date: 'Consulte saídas',
      duration: '7 dias',
      price: 'R$5.499,00',
      spots: 'Vagas limitadas',
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur',
      image: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=1600&h=900&fit=crop',
      summary: 'Uma viagem para descansar em praias de águas cristalinas, com estrutura completa e curadoria de experiências para aproveitar sem pressa.',
      highlights: ['Praias caribenhas', 'Resorts selecionados', 'Passeios náuticos', 'Tempo livre'],
      itinerary: [
        { day: 'Dias 1 e 2', title: 'Chegada e adaptação', description: 'Recepção, check-in e primeiras experiências no destino.' },
        { day: 'Dias 3 a 6', title: 'Praias e passeios', description: 'Programação flexível com opções de descanso e experiências locais.' },
        { day: 'Dia 7', title: 'Retorno', description: 'Check-out e retorno.' }
      ],
      included: ['Hospedagem', 'Seguro viagem', 'Traslados previstos', 'Suporte Unitur'],
      notIncluded: ['Passeios opcionais', 'Taxas locais', 'Despesas pessoais']
    },
    {
      slug: 'asia-mistica',
      title: 'Ásia Mística',
      eyebrow: 'Cultura e descoberta',
      destination: 'Tailândia, Japão e Bali',
      date: 'Consulte saídas',
      duration: '16 dias',
      price: 'R$31.900,00',
      foreignPrice: 'U$5.740,00',
      spots: 'Vagas limitadas',
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur',
      image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1600&h=900&fit=crop',
      summary: 'Um roteiro para descobrir templos, sabores, tradições e paisagens marcantes da Ásia, com uma curadoria que equilibra cultura e contemplação.',
      highlights: ['Templos', 'Gastronomia local', 'Tradições orientais', 'Paisagens tropicais'],
      itinerary: [
        { day: 'Etapa 1', title: 'Tailândia', description: 'Templos, mercados e experiências culturais.' },
        { day: 'Etapa 2', title: 'Japão', description: 'Contrastes entre tradição, tecnologia e cidades históricas.' },
        { day: 'Etapa 3', title: 'Bali', description: 'Natureza, espiritualidade e descanso.' }
      ],
      included: ['Hospedagem', 'Seguro viagem', 'Traslados previstos', 'Acompanhamento'],
      notIncluded: ['Vistos', 'Refeições extras', 'Passeios opcionais']
    },
    {
      slug: 'america-do-sul',
      title: 'América do Sul',
      eyebrow: 'Natureza e história',
      destination: 'Machu Picchu, Patagônia e Buenos Aires',
      date: 'Consulte saídas',
      duration: '10 dias',
      price: 'R$18.900,00',
      foreignPrice: 'U$3.400,00',
      spots: 'Vagas limitadas',
      guide: 'A definir',
      coordinator: 'Equipe Unitur',
      operator: 'Unitur',
      image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=1600&h=900&fit=crop',
      summary: 'Um roteiro para viver paisagens intensas e cidades cheias de história, com experiências selecionadas no continente sul-americano.',
      highlights: ['Machu Picchu', 'Patagônia', 'Buenos Aires', 'Cultura andina', 'Paisagens naturais'],
      itinerary: [
        { day: 'Etapa 1', title: 'Peru', description: 'Cultura andina, Cusco e Machu Picchu.' },
        { day: 'Etapa 2', title: 'Patagônia', description: 'Natureza, montanhas e experiências ao ar livre.' },
        { day: 'Etapa 3', title: 'Buenos Aires', description: 'História, gastronomia e vida urbana.' }
      ],
      included: ['Hospedagem', 'Seguro viagem', 'Traslados previstos', 'Acompanhamento'],
      notIncluded: ['Ingressos opcionais', 'Refeições extras', 'Despesas pessoais']
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private tripService: TripService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      this.loadTrip(slug);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  get visibleItinerary() {
    if (!this.trip) {
      return [];
    }

    return this.itineraryExpanded ? this.trip.itinerary : this.trip.itinerary.slice(0, 3);
  }

  toggleItinerary() {
    this.itineraryExpanded = !this.itineraryExpanded;
  }

  private loadTrip(slug: string | null) {
    this.itineraryExpanded = false;
    if (!slug) {
      this.trip = null;
      return;
    }

    const queryTrip = this.getTripFromQuery(slug);
    if (queryTrip) {
      this.trip = queryTrip;
      return;
    }

    const fallback = null;

    this.tripService.getTrips({ limit: 100 }).pipe(
      timeout(10000),
      catchError(() => of({ data: [], total: 0, page: 1, limit: 100, totalPages: 1 }))
    ).subscribe(response => {
      const firestoreTrip = response.data.find(item => this.matchesSlug(item, slug));
      this.trip = firestoreTrip ? this.mapFirestoreTrip(firestoreTrip) : fallback;
    });
  }

  private getTripFromQuery(slug: string): ProductTrip | null {
    const query = this.route.snapshot.queryParamMap;
    const title = query.get('title');

    if (!title) {
      return null;
    }

    const destination = query.get('destination') || 'A definir';
    const duration = query.get('duration') || 'A definir';
    const date = query.get('date') || 'A definir';
    const operator = query.get('operator') || 'Unitur';

    return {
      slug,
      title,
      eyebrow: query.get('category') || 'Viagem Unitur',
      destination,
      date,
      duration,
      price: query.get('price') || 'Consulte',
      foreignPrice: this.formatForeignPrice(query.get('foreignPrice') || ''),
      spots: query.get('spots') || 'Vagas limitadas',
      showSpots: query.get('showSpots') !== 'false',
      guide: query.get('guide') || 'A definir',
      coordinator: query.get('coordinator') || 'Equipe Unitur',
      operator,
      image: query.get('image') || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&h=900&fit=crop',
      summary: `Uma experiencia organizada pela Unitur para ${destination}, com roteiro planejado, acompanhamento e suporte em todas as etapas da viagem.`,
      experienceImages: [],
      highlights: [destination, date, duration],
      itinerary: [
        { day: 'Etapa 1', title: 'Preparacao e embarque', description: 'Orientacoes iniciais, alinhamento do grupo e inicio da experiencia.' },
        { day: 'Etapa 2', title: 'Vivencia no destino', description: 'Roteiro conduzido conforme a proposta da viagem, com suporte da equipe Unitur.' },
        { day: 'Etapa 3', title: 'Encerramento', description: 'Finalizacao da programacao e retorno com acompanhamento.' }
      ],
      included: ['Acompanhamento Unitur', 'Roteiro organizado', 'Suporte durante a viagem', 'Orientacoes antes do embarque'],
      notIncluded: ['Despesas pessoais', 'Documentacao', 'Servicos nao mencionados', 'Passeios opcionais'],
      hotels: [],
      paymentMethods: this.defaultPaymentMethods(),
      cancellationPolicy: this.defaultCancellationPolicy()
    };
  }

  private matchesSlug(trip: Trip, slug: string) {
    return [
      trip.slug,
      this.tripService.generateSlug(trip.title),
      String(trip.id)
    ].filter(Boolean).includes(slug);
  }

  private mapFirestoreTrip(trip: Trip): ProductTrip {
    const destination = trip.country || trip.destination || 'A definir';
    const duration = trip.duration ? `${trip.duration} dias` : 'A definir';
    const price = trip.price ? `R$${Number(trip.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Consulte';
    const summary = trip.shortDescription || trip.description || 'Roteiro organizado pela Unitur com acompanhamento e suporte em todas as etapas.';

    return {
      slug: trip.slug || this.tripService.generateSlug(trip.title) || String(trip.id),
      title: trip.title,
      eyebrow: this.getTripTypeLabel(trip.tripType),
      destination,
      date: trip.period || this.formatPeriod(trip.startDate),
      duration,
      price,
      foreignPrice: this.formatForeignPrice(trip.foreignPrice),
      spots: `${Number(trip.availableSpots || 0)} vagas`,
      showSpots: trip.showAvailableSpots !== false,
      guide: trip.spiritualGuide || 'A definir',
      coordinator: trip.coordinator || 'Equipe Unitur',
      operator: trip.operator || 'Unitur',
      image: trip.mainImage || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&h=900&fit=crop',
      summary,
      experienceImages: trip.experienceImages || trip.gallery || [],
      highlights: [destination, trip.period || 'Periodo a definir', duration],
      itinerary: trip.itinerary
        ? this.parseItinerary(trip.itinerary)
        : [
            { day: 'Etapa 1', title: 'Preparacao e embarque', description: 'Orientacoes iniciais, alinhamento do grupo e inicio da experiencia.' },
            { day: 'Etapa 2', title: 'Vivencia no destino', description: 'Roteiro conduzido conforme a proposta da viagem, com suporte da equipe.' },
            { day: 'Etapa 3', title: 'Encerramento', description: 'Finalizacao da programacao e retorno com acompanhamento Unitur.' }
          ],
      included: trip.included?.length ? trip.included : ['Acompanhamento Unitur', 'Suporte durante a viagem', 'Roteiro organizado'],
      notIncluded: trip.notIncluded?.length ? trip.notIncluded : ['Despesas pessoais', 'Documentacao', 'Servicos nao mencionados'],
      hotels: trip.hotels || [],
      paymentMethods: trip.paymentMethods?.length ? trip.paymentMethods : this.defaultPaymentMethods(),
      cancellationPolicy: trip.cancellationPolicy || this.defaultCancellationPolicy()
    };
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

  private formatForeignPrice(value?: number | string): string {
    return formatForeignCurrency(value);
  }

  private defaultPaymentMethods(): string[] {
    return ['Entrada + parcelas no boleto', 'Cartao de credito', 'Pix ou transferencia'];
  }

  private defaultCancellationPolicy(): string {
    return 'Politica de cancelamento padrao conforme contrato da viagem.';
  }

  private getTripTypeLabel(type?: Trip['tripType']) {
    const labels: Record<string, string> = {
      peregrinacao: 'Viagens de Peregrinacao',
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
