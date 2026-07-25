import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PostService, PostFilters } from '../../core/services/post.service';
import { CategoryService } from '../../core/services/category.service';
import { Post, Category } from '../../core/models/post.model';
import { catchError, finalize, of, timeout } from 'rxjs';
import { safeScrollToTop } from '../../core/utils/browser';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './blog-list.component.html',
  styleUrl: './blog-list.component.scss'
})
export class BlogListComponent implements OnInit {
  posts: Post[] = [];
  categories: Category[] = [];
  selectedCategory: number | null = null;
  categorySearch = '';
  categorySelectOpen = false;
  loading = false;
  loaded = false;

  currentPage = 1;
  totalPages = 1;
  itemsPerPage = 9;
  blogOrigin = 'blog';
  /** Slug da categoria quando acessado por /blog/categoria/:cat (paridade WP). */
  categorySlug: string | null = null;
  private readonly blogRequestTimeout = 12000;

  constructor(
    private postService: PostService,
    private categoryService: CategoryService,
    private route: ActivatedRoute,
    private seo: SeoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    safeScrollToTop();
    this.blogOrigin = this.route.snapshot.queryParamMap.get('origin') || 'blog';

    // Paridade com o WordPress: /blog/page/:page e /blog/categoria/:cat
    const pageParam = Number(this.route.snapshot.paramMap.get('page'));
    if (Number.isFinite(pageParam) && pageParam > 0) {
      this.currentPage = pageParam;
    }
    this.categorySlug = this.route.snapshot.paramMap.get('cat');

    this.applySeo();
    this.loadCategories();
    this.loadPosts();
  }

  /** Define meta/canonical conforme página e categoria atuais. */
  private applySeo() {
    let canonicalPath = '/blog/';
    let title = 'Blog Unitur | Dicas de Viagem, Destinos e Peregrinações';
    let description = 'Conteúdo sobre destinos, peregrinações, santuários e dicas de viagem. Acompanhe o blog da Unitur e inspire-se para a sua próxima jornada.';

    if (this.categorySlug) {
      canonicalPath = `/blog/categoria/${this.categorySlug}/`;
      const nome = this.categorySlug.replace(/-/g, ' ');
      title = `${nome} | Blog Unitur`;
      description = `Artigos do blog da Unitur sobre ${nome}.`;
    } else if (this.currentPage > 1) {
      // Páginas 2+ recebem canonical próprio (evita conteúdo duplicado com /blog/).
      canonicalPath = `/blog/page/${this.currentPage}/`;
    }

    this.seo.setMeta({ title, description, canonicalPath, type: 'website' });
  }

  loadCategories() {
    this.categoryService.getAllCategories().pipe(
      timeout(this.blogRequestTimeout),
      catchError(() => of([] as Category[]))
    ).subscribe({
      next: (categories) => {
        this.categories = categories.filter(c => c.type === 'blog' || c.type === 'both');
        // Resolve o slug da URL (/blog/categoria/:cat) para o categoryId do filtro.
        if (this.categorySlug) {
          const match = this.categories.find(c => c.slug === this.categorySlug);
          if (match && this.selectedCategory !== match.id) {
            this.selectedCategory = match.id;
            this.loadPosts();
          }
        }
        this.cdr.markForCheck();
      }
    });
  }

  loadPosts() {
    this.loading = true;

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
      catchError(() => of({
        data: [] as Post[],
        total: 0,
        page: this.currentPage,
        limit: this.itemsPerPage,
        totalPages: 1,
        hasNextPage: false
      })),
      finalize(() => {
        this.loading = false;
        this.loaded = true;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        this.posts = response.data;
        this.totalPages = response.totalPages;
        if (this.currentPage > 1 || this.selectedCategory) {
          safeScrollToTop('smooth');
        }
      }
    });
  }

  filterByCategory(categoryId: number | null) {
    this.selectedCategory = categoryId;
    this.categorySearch = '';
    this.categorySelectOpen = false;
    this.currentPage = 1;
    this.loadPosts();
  }

  get selectedCategoryName(): string {
    return this.categories.find(category => category.id === this.selectedCategory)?.name || 'Todos os países';
  }

  get filteredCategories(): Category[] {
    const search = this.categorySearch.trim().toLocaleLowerCase('pt-BR');
    if (!search) {
      return this.categories;
    }

    return this.categories.filter(category =>
      category.name.toLocaleLowerCase('pt-BR').includes(search)
    );
  }

  toggleCategorySelect(event: Event) {
    event.stopPropagation();
    this.categorySelectOpen = !this.categorySelectOpen;
    if (!this.categorySelectOpen) {
      this.categorySearch = '';
    }
  }

  @HostListener('document:click')
  closeCategorySelect() {
    if (this.categorySelectOpen) {
      this.categorySelectOpen = false;
      this.categorySearch = '';
    }
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
