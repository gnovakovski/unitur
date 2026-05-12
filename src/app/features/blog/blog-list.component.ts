import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PostService, PostFilters } from '../../core/services/post.service';
import { CategoryService } from '../../core/services/category.service';
import { Post, Category } from '../../core/models/post.model';
import { catchError, finalize, of, timeout } from 'rxjs';

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
  loaded = false;

  currentPage = 1;
  totalPages = 1;
  itemsPerPage = 9;
  blogOrigin = 'blog';
  private readonly blogRequestTimeout = 12000;

  constructor(
    private postService: PostService,
    private categoryService: CategoryService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    window.scrollTo({ top: 0, behavior: 'auto' });
    this.blogOrigin = this.route.snapshot.queryParamMap.get('origin') || 'blog';

    this.loadCategories();
    this.loadPosts();
  }

  loadCategories() {
    this.categoryService.getAllCategories().pipe(
      timeout(this.blogRequestTimeout),
      catchError(() => of([] as Category[]))
    ).subscribe({
      next: (categories) => {
        this.categories = categories.filter(c => c.type === 'blog' || c.type === 'both');
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
        totalPages: 1
      })),
      finalize(() => {
        this.loading = false;
        this.loaded = true;
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
