import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PostService } from '../../core/services/post.service';
import { TripService } from '../../core/services/trip.service';
import { Post } from '../../core/models/post.model';
import { Trip } from '../../core/models/trip.model';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blog-detail.component.html',
  styleUrl: './blog-detail.component.scss'
})
export class BlogDetailComponent implements OnInit {
  post: Post | null = null;
  relatedPosts: Post[] = [];
  relatedTrips: Trip[] = [];
  loading = true;
  error: string | null = null;
  origin: 'home' | 'footer' | 'blog' = 'blog';

  private readonly fallbackPosts: Post[] = [
    {
      id: 1,
      title: 'Como planejar uma viagem sem imprevistos',
      slug: 'como-planejar-uma-viagem-sem-imprevistos',
      excerpt: 'Veja pontos essenciais para organizar documentos, roteiro, hospedagem e transporte antes de embarcar.',
      content: `
        <p>Uma boa viagem começa antes do embarque. Conferir documentos, datas, seguros e reservas reduz riscos e deixa mais espaço para aproveitar a experiência.</p>
        <p>Organize um roteiro realista, mantenha cópias digitais dos documentos e separe os contatos importantes. Para viagens em grupo, confirme horários e pontos de encontro com antecedência.</p>
      `,
      featuredImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&h=700&fit=crop',
      categoryId: 1,
      category: {
        id: 1,
        name: 'Dicas de viagem',
        slug: 'dicas-de-viagem',
        type: 'blog',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      tags: ['planejamento', 'turismo', 'dicas'],
      status: 'published',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: 1, name: 'Equipe Unitur' }
    },
    {
      id: 2,
      title: 'Destinos para conhecer em grupo',
      slug: 'destinos-para-conhecer-em-grupo',
      excerpt: 'Sugestões para quem busca experiências completas, seguras e bem acompanhadas em viagens nacionais e internacionais.',
      content: `
        <p>Viajar em grupo combina convivência, praticidade e suporte durante todo o percurso. Destinos com boa infraestrutura, programação variada e deslocamentos bem definidos costumam funcionar melhor.</p>
        <p>Antes de escolher o pacote, avalie o perfil do grupo, o ritmo dos passeios e a necessidade de acompanhamento especializado.</p>
      `,
      featuredImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&h=700&fit=crop',
      categoryId: 2,
      category: {
        id: 2,
        name: 'Destinos',
        slug: 'destinos',
        type: 'blog',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      tags: ['grupos', 'destinos', 'experiencias'],
      status: 'published',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: 1, name: 'Equipe Unitur' }
    },
    {
      id: 3,
      title: 'O que levar na mala de mão',
      slug: 'o-que-levar-na-mala-de-mao',
      excerpt: 'Uma lista prática para manter documentos, itens pessoais e objetos importantes sempre por perto.',
      content: `
        <p>A mala de mão deve reunir tudo que você não pode perder: documentos, remédios, eletrônicos, carregadores e uma muda de roupa.</p>
        <p>Evite excesso de peso e confira as regras da companhia aérea para líquidos, objetos cortantes e dimensões permitidas.</p>
      `,
      featuredImage: 'https://images.unsplash.com/photo-1553531384-cc64ac80f931?w=1200&h=700&fit=crop',
      categoryId: 1,
      category: {
        id: 1,
        name: 'Dicas de viagem',
        slug: 'dicas-de-viagem',
        type: 'blog',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      tags: ['bagagem', 'aeroporto', 'organizacao'],
      status: 'published',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: 1, name: 'Equipe Unitur' }
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private tripService: TripService
  ) {}

  ngOnInit() {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const origin = this.route.snapshot.queryParamMap.get('origin');
    this.origin = origin === 'home' || origin === 'footer' ? origin : 'blog';

    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.loadPost(slug);
      }
    });
  }

  loadPost(slug: string) {
    this.loading = true;
    this.error = null;
    this.post = null;

    this.postService.getPosts({ status: 'published', limit: 100 }).subscribe({
      next: (response) => {
        const post = response.data.find(p => this.matchesPostSlug(p, slug));
        
        if (post) {
          this.post = post;
          this.error = null;
          this.loadRelatedPosts(post);
          this.loadRelatedTrips(post);
        }
      },
      error: () => {
        this.setFallbackPost(slug);
        this.loading = false;
      },
      complete: () => {
        if (!this.post) {
          this.setFallbackPost(slug);
        }
        this.loading = false;
      }
    });
  }

  loadRelatedPosts(post: Post) {
    // Buscar posts relacionados da mesma categoria
    this.postService.getPosts({ 
      categoryId: post.categoryId,
      limit: 3,
      status: 'published'
    }).subscribe({
      next: (response) => {
        this.relatedPosts = response.data.filter(p => p.id !== post.id).slice(0, 3);
      },
      error: () => {
        this.relatedPosts = this.fallbackPosts
          .filter(relatedPost => relatedPost.id !== post.id && relatedPost.categoryId === post.categoryId)
          .slice(0, 3);
      }
    });
  }

  private setFallbackPost(slug: string) {
    const post = this.fallbackPosts.find(item => this.matchesPostSlug(item, slug));

    if (post) {
      this.post = post;
      this.loadRelatedPosts(post);
      this.loadRelatedTrips(post);
    } else {
      this.error = 'Post não encontrado';
    }

    this.loading = false;
  }

  private matchesPostSlug(post: Post, slug: string) {
    return post.slug === slug || String(post.id) === slug;
  }

  loadRelatedTrips(post: Post) {
    const ids = (post.relatedTrips || []).slice(0, 3).map(id => Number(id));
    if (!ids.length) {
      this.relatedTrips = [];
      return;
    }

    this.tripService.getTrips({ limit: 100 }).subscribe({
      next: response => {
        this.relatedTrips = response.data.filter(trip => ids.includes(Number(trip.id))).slice(0, 3);
      },
      error: () => {
        this.relatedTrips = [];
      }
    });
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  }

  shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(this.post?.title || '');
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  }

  shareOnWhatsApp() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(this.post?.title || '');
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
  }

  copyPostLink() {
    navigator.clipboard?.writeText(window.location.href);
  }

  goBackToHomeBlog(event: Event) {
    event.preventDefault();

    if (this.origin === 'footer' || this.origin === 'blog') {
      this.router.navigate(['/blog'], {
        queryParams: this.origin === 'footer' ? { origin: 'footer' } : undefined
      });
      return;
    }

    this.router.navigate(['/']).then(() => {
      window.setTimeout(() => {
        document.getElementById('blog-unitur')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    });
  }
}
