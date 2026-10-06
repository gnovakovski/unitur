import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PostService, PostFilters } from '../../core/services/post.service';
import { CategoryService } from '../../core/services/category.service';
import { Post, Category } from '../../core/models/post.model';
import { Subject, Subscription, catchError, combineLatest, debounceTime, distinctUntilChanged, finalize, map, of, timeout } from 'rxjs';
import { safeScrollToTop } from '../../core/utils/browser';
import { SeoService } from '../../core/services/seo.service';
import { postAuthorName } from '../../core/utils/post-author';

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

  /** Busca por palavra-chave (título, resumo, tags, categoria e texto do post). */
  searchTerm = '';
  totalResults = 0;
  private categoryCounts = new Map<number, number>();
  private readonly search$ = new Subject<string>();
  private postsSubscription?: Subscription;
  private readonly destroyRef = inject(DestroyRef);

  readonly authorName = postAuthorName;

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

    this.search$.pipe(
      debounceTime(350),
      map(term => term.trim()),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadPosts(false);
    });
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
    combineLatest([
      this.categoryService.getAllCategories().pipe(
        timeout(this.blogRequestTimeout),
        catchError(() => of([] as Category[]))
      ),
      this.postService.getPublishedCategoryCounts().pipe(
        catchError(() => of(new Map<number, number>()))
      )
    ]).subscribe({
      next: ([categories, counts]) => {
        const blogCategories = categories.filter(c => c.type === 'blog' || c.type === 'both');
        // Resolve o slug da URL (/blog/categoria/:cat) para o categoryId do filtro.
        if (this.categorySlug) {
          const match = blogCategories.find(c => c.slug === this.categorySlug);
          if (match && this.selectedCategory !== match.id) {
            this.selectedCategory = match.id;
            this.loadPosts();
          }
        }
        // Só lista categorias com posts publicados (sem contagem, mostra todas).
        this.categoryCounts = counts;
        this.categories = counts.size === 0
          ? blogCategories
          : blogCategories.filter(c => counts.has(Number(c.id)) || c.id === this.selectedCategory);
        this.cdr.markForCheck();
      }
    });
  }

  categoryCount(category: Category): number {
    return this.categoryCounts.get(Number(category.id)) || 0;
  }

  onSearchInput(term: string) {
    this.searchTerm = term;
    this.search$.next(term);
  }

  clearSearch() {
    this.onSearchInput('');
  }

  get activeSearch(): string {
    return this.searchTerm.trim();
  }

  loadPosts(scrollToTop = true) {
    this.postsSubscription?.unsubscribe();
    this.loading = true;

    const filters: PostFilters = {
      status: 'published',
      page: this.currentPage,
      limit: this.itemsPerPage
    };

    if (this.selectedCategory) {
      filters.categoryId = this.selectedCategory;
    }

    if (this.activeSearch) {
      filters.search = this.activeSearch;
      filters.searchScope = 'full';
    }

    this.postsSubscription = this.postService.getPosts(filters).pipe(
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
        this.totalResults = response.total;
        if (scrollToTop && (this.currentPage > 1 || this.selectedCategory)) {
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
    return this.categories.find(category => category.id === this.selectedCategory)?.name || 'Todos os destinos e temas';
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
