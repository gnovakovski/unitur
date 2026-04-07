import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-viagens',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './viagens.component.html',
  styleUrl: './viagens.component.scss'
})
export class ViagensComponent {
  viagens = [
    {
      title: 'Terra Santa',
      location: 'Israel',
      date: 'Junho 2026',
      duration: '12 dias',
      image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=500&h=350&fit=crop',
      price: 'R$ 8.999',
      spots: '8 vagas',
      category: 'Peregrinação'
    },
    {
      title: 'Caminho de Santiago',
      location: 'Espanha',
      date: 'Agosto 2026',
      duration: '15 dias',
      image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=500&h=350&fit=crop',
      price: 'R$ 6.499',
      spots: '12 vagas',
      category: 'Peregrinação'
    },
    {
      title: 'Fátima e Lourdes',
      location: 'Portugal e França',
      date: 'Setembro 2026',
      duration: '10 dias',
      image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=500&h=350&fit=crop',
      price: 'R$ 7.299',
      spots: '15 vagas',
      category: 'Peregrinação'
    },
    {
      title: 'Europa Clássica',
      location: 'Paris, Roma, Londres e Barcelona',
      date: 'Julho 2026',
      duration: '14 dias',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&h=350&fit=crop',
      price: 'R$ 9.999',
      spots: '10 vagas',
      category: 'Turismo'
    },
    {
      title: 'Caribe Paradisíaco',
      location: 'Cancún, Punta Cana e Aruba',
      date: 'Outubro 2026',
      duration: '7 dias',
      image: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=500&h=350&fit=crop',
      price: 'R$ 5.499',
      spots: '20 vagas',
      category: 'Turismo'
    },
    {
      title: 'Ásia Mística',
      location: 'Tailândia, Japão e Bali',
      date: 'Novembro 2026',
      duration: '16 dias',
      image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=500&h=350&fit=crop',
      price: 'R$ 11.999',
      spots: '8 vagas',
      category: 'Turismo'
    },
    {
      title: 'América do Sul',
      location: 'Machu Picchu, Patagônia e Buenos Aires',
      date: 'Dezembro 2026',
      duration: '10 dias',
      image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=500&h=350&fit=crop',
      price: 'R$ 6.799',
      spots: '14 vagas',
      category: 'Turismo'
    },
    {
      title: 'Lua de Mel nas Maldivas',
      location: 'Maldivas + Dubai',
      date: 'Janeiro 2027',
      duration: '12 dias',
      image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=500&h=350&fit=crop',
      price: 'R$ 14.999',
      spots: '6 vagas',
      category: 'Especial'
    }
  ];

  selectedCategory = 'Todos';
  categories = ['Todos', 'Peregrinação', 'Turismo', 'Especial'];

  get filtered() {
    if (this.selectedCategory === 'Todos') return this.viagens;
    return this.viagens.filter(v => v.category === this.selectedCategory);
  }

  selectCategory(cat: string) {
    this.selectedCategory = cat;
  }
}
