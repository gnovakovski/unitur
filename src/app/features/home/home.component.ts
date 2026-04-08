import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  currentSlide = 0;
  private slideInterval: any;

  bannerImages = [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1600&h=700&fit=crop'
  ];

  peregrinacoes = [
    {
      title: 'Terra Santa',
      country: 'Israel',
      date: 'Junho 2026',
      duration: '12 dias',
      image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=500&h=350&fit=crop',
      price: 'R$ 8.999',
      spots: '8 vagas',
      guide: 'Pe. João Batista',
      guideRole: 'Guia Espiritual'
    },
    {
      title: 'Caminho de Santiago',
      country: 'Espanha',
      date: 'Agosto 2026',
      duration: '15 dias',
      image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=500&h=350&fit=crop',
      price: 'R$ 6.499',
      spots: '12 vagas',
      guide: 'Pe. Carlos Mendes',
      guideRole: 'Guia Espiritual'
    },
    {
      title: 'Fátima e Lourdes',
      country: 'Portugal e França',
      date: 'Setembro 2026',
      duration: '10 dias',
      image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=500&h=350&fit=crop',
      price: 'R$ 7.299',
      spots: '15 vagas',
      guide: 'Pe. André Lima',
      guideRole: 'Guia Espiritual'
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

  curadoria = [
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
      title: 'Os melhores destinos para peregrinação em 2026',
      excerpt: 'Descubra os roteiros espirituais mais procurados e como se preparar para essa jornada transformadora.',
      image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=500&h=300&fit=crop',
      date: 'Março 2026',
      category: 'Peregrinação'
    },
    {
      title: 'Dicas essenciais para viajar pela Europa',
      excerpt: 'Tudo o que você precisa saber antes de embarcar na sua aventura europeia: documentos, moeda e muito mais.',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&h=300&fit=crop',
      date: 'Fevereiro 2026',
      category: 'Dicas'
    },
    {
      title: 'Caribe: o paraíso que você precisa conhecer',
      excerpt: 'Praias de areia branca, águas cristalinas e uma cultura vibrante esperam por você nesse destino incrível.',
      image: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=500&h=300&fit=crop',
      date: 'Janeiro 2026',
      category: 'Destinos'
    }
  ];

  ngOnInit() {
    this.startSlideShow();
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
}
