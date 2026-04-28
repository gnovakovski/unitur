import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PostService, PostFilters } from '../../core/services/post.service';
import { CategoryService } from '../../core/services/category.service';
import { Post, Category } from '../../core/models/post.model';
import { catchError, finalize, of, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blog-list.component.html',
  styleUrl: './blog-list.component.scss'
})
export class BlogListComponent implements OnInit {
  posts: Post[] = [];
  categories: Category[] = [];
  selectedCategory: number | null = null;
  loading = false;
  
  currentPage = 1;
  totalPages = 1;
  itemsPerPage = 9;
  private readonly blogRequestTimeout = 1500;

  private readonly fallbackCategories: Category[] = [
    {
      id: 1,
      name: 'Dicas de viagem',
      slug: 'dicas-de-viagem',
      type: 'blog',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      name: 'Destinos',
      slug: 'destinos',
      type: 'blog',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  private readonly fallbackPosts: Post[] = [
    {
      id: 1,
      title: 'Como planejar uma viagem sem imprevistos',
      slug: 'como-planejar-uma-viagem-sem-imprevistos',
      excerpt: 'Veja pontos essenciais para organizar documentos, roteiro, hospedagem e transporte antes de embarcar.',
      content: '',
      featuredImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=900&h=600&fit=crop',
      categoryId: 1,
      category: this.fallbackCategories[0],
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
      content: '',
      featuredImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&h=600&fit=crop',
      categoryId: 2,
      category: this.fallbackCategories[1],
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
      content: '',
      featuredImage: 'https://images.unsplash.com/photo-1553531384-cc64ac80f931?w=900&h=600&fit=crop',
      categoryId: 1,
      category: this.fallbackCategories[0],
      tags: ['bagagem', 'aeroporto', 'organizacao'],
      status: 'published',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: 1, name: 'Equipe Unitur' }
    }
  ];

  constructor(
    private postService: PostService,
    private categoryService: CategoryService
  ) {}

  ngOnInit() {
    this.categories = this.fallbackCategories;
    this.posts = this.fallbackPosts;

    if (!environment.production) {
      return;
    }

    this.loadCategories();
    this.loadPosts();
  }

  loadCategories() {
    this.categoryService.getAllCategories().pipe(
      timeout(this.blogRequestTimeout),
      catchError(() => {
        return of(this.fallbackCategories);
      })
    ).subscribe({
      next: (categories) => {
        this.categories = categories.filter(c => c.type === 'blog' || c.type === 'both');
      }
    });
  }

  loadPosts() {
    this.loading = this.posts.length === 0;

    const filters: PostFilters = {
      status: 'published',
      page: this.currentPage,
      limit: this.itemsPerPage
    };

    if (this.selectedCategory) {
      filters.categoryId = this.selectedCategory;
    }

    this.postService.getPosts(filters).pipe(
      timeout(this.blogRequestTimeout),
      catchError(() => {
        const fallbackData = this.selectedCategory
          ? this.fallbackPosts.filter(post => post.categoryId === this.selectedCategory)
          : this.fallbackPosts;

        return of({
          data: fallbackData,
          total: fallbackData.length,
          page: this.currentPage,
          limit: this.itemsPerPage,
          totalPages: 1
        });
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe({
      next: (response) => {
        this.posts = response.data;
        this.totalPages = response.totalPages;
        if (this.currentPage > 1 || this.selectedCategory) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    });
  }

  filterByCategory(categoryId: number | null) {
    this.selectedCategory = categoryId;
    this.currentPage = 1;
    this.posts = categoryId
      ? this.fallbackPosts.filter(post => post.categoryId === categoryId)
      : this.fallbackPosts;

    if (!environment.production) {
      return;
    }

    this.loadPosts();
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPosts();
    }
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }
}
