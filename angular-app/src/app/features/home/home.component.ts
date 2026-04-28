import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

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

  bannerImages = [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&h=700&fit=crop',
    'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1600&h=700&fit=crop'
  ];

  peregrinacoes = [
    {
      slug: 'terra-santa',
      title: 'Terra Santa',
      location: 'Israel',
      date: 'Junho 2026',
      duration: '12 dias',
      image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=500&h=350&fit=crop',
      price: 'R$ 8.999',
      spots: '8 vagas'
    },
    {
      slug: 'caminho-de-santiago',
      title: 'Caminho de Santiago',
      location: 'Espanha',
      date: 'Agosto 2026',
      duration: '15 dias',
      image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=500&h=350&fit=crop',
      price: 'R$ 6.499',
      spots: '12 vagas'
    },
    {
      slug: 'fatima-e-lourdes',
      title: 'Fátima e Lourdes',
      location: 'Portugal e França',
      date: 'Setembro 2026',
      duration: '10 dias',
      image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=500&h=350&fit=crop',
      price: 'R$ 7.299',
      spots: '15 vagas'
    }
  ];

  destinations = [
    {
      slug: 'europa-classica',
      title: 'Europa Clássica',
      description: 'Paris, Roma, Londres e Barcelona',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&h=350&fit=crop',
      price: 'R$ 9.999',
      days: '14 dias'
    },
    {
      slug: 'caribe-paradisiaco',
      title: 'Caribe Paradisíaco',
      description: 'Cancún, Punta Cana e Aruba',
      image: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=500&h=350&fit=crop',
      price: 'R$ 5.499',
      days: '7 dias'
    },
    {
      slug: 'asia-mistica',
      title: 'Ásia Mística',
      description: 'Tailândia, Japão e Bali',
      image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=500&h=350&fit=crop',
      price: 'R$ 11.999',
      days: '16 dias'
    },
    {
      slug: 'america-do-sul',
      title: 'América do Sul',
      description: 'Machu Picchu, Patagônia e Buenos Aires',
      image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=500&h=350&fit=crop',
      price: 'R$ 6.799',
      days: '10 dias'
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
