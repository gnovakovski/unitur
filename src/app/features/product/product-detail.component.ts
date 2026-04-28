import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface ProductTrip {
  slug: string;
  title: string;
  eyebrow: string;
  destination: string;
  date: string;
  duration: string;
  price: string;
  spots: string;
  image: string;
  summary: string;
  highlights: string[];
  itinerary: Array<{ day: string; title: string; description: string }>;
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

  private readonly trips: ProductTrip[] = [
    {
      slug: 'terra-santa',
      title: 'Terra Santa',
      eyebrow: 'Peregrinação internacional',
      destination: 'Israel',
      date: 'Junho 2026',
      duration: '12 dias',
      price: 'R$ 8.999',
      spots: '8 vagas',
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
      price: 'R$ 6.499',
      spots: '12 vagas',
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
      price: 'R$ 7.299',
      spots: '15 vagas',
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
      price: 'R$ 9.999',
      spots: 'Vagas limitadas',
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
      price: 'R$ 5.499',
      spots: 'Vagas limitadas',
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
      price: 'R$ 11.999',
      spots: 'Vagas limitadas',
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
      price: 'R$ 6.799',
      spots: 'Vagas limitadas',
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

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      this.trip = this.trips.find(item => item.slug === slug) || null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
