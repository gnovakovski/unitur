import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { PostService, PostFilters } from '../../../core/services/post.service';
import { CategoryService } from '../../../core/services/category.service';
import { AuthService } from '../../../core/services/auth.service';
import { Post, Category } from '../../../core/models/post.model';
import { catchError, debounceTime, distinctUntilChanged, finalize, from, of, switchMap, timeout } from 'rxjs';

@Component({
  selector: 'app-posts-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './posts-list.component.html',
  styleUrl: './posts-list.component.scss'
})
export class PostsListComponent implements OnInit {
  posts: Post[] = [];
  categories: Category[] = [];
  loading = false;
  error: string | null = null;
  
  // Paginação
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 10;
  
  // Filtros
  filterForm: FormGroup;
  
  // Modal de exclusão
  deleteModalOpen = false;
  postToDelete: Post | null = null;
  deleting = false;

  constructor(
    private authService: AuthService,
    private postService: PostService,
    private categoryService: CategoryService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      categoryId: [''],
      status: ['']
    });
  }

  ngOnInit() {
    this.loadCategories();
    this.loadPosts();
    this.setupFilters();
  }

  setupFilters() {
    this.filterForm.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.currentPage = 1;
        this.loadPosts();
      });
  }

  loadCategories() {
    from(this.authService.waitForAuthenticatedUser()).pipe(
      switchMap(isAuthenticated => {
        if (!isAuthenticated) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        return this.categoryService.getAllCategories();
      }),
      timeout(12000),
      catchError((err) => {
        console.error('Erro ao carregar categorias', err);
        this.error = 'Erro ao carregar categorias. Verifique login e regras do Firestore.';
        return of([]);
      })
    ).subscribe({
      next: (categories) => {
        this.categories = categories.filter(c => c.type === 'blog' || c.type === 'both');
        this.cdr.detectChanges();
      }
    });
  }

  loadPosts() {
    this.loading = true;
    this.error = null;

    const filters: PostFilters = {
      page: this.currentPage,
      limit: this.itemsPerPage,
      ...this.filterForm.value
    };

    // Remove valores vazios
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof PostFilters] === '') {
        delete filters[key as keyof PostFilters];
      }
    });

    from(this.authService.waitForAuthenticatedUser()).pipe(
      switchMap(isAuthenticated => {
        if (!isAuthenticated) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        return this.postService.getPosts(filters);
      }),
      timeout(12000),
      catchError((err) => {
        console.error('Erro ao carregar posts', err);
        this.error = err?.message?.includes('Tempo esgotado')
          ? 'Tempo esgotado ao carregar posts. Verifique conexão, login e regras do Firestore.'
          : 'Erro ao carregar posts. Verifique login e regras do Firestore.';
        return of({
          data: [],
          total: 0,
          page: this.currentPage,
          limit: this.itemsPerPage,
          totalPages: 1
        });
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        this.posts = response.data;
        this.totalItems = response.total;
        this.totalPages = response.totalPages;
        this.cdr.detectChanges();
      }
    });
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPosts();
    }
  }

  clearFilters() {
    this.filterForm.reset();
    this.currentPage = 1;
    this.loadPosts();
  }

  openDeleteModal(post: Post) {
    this.postToDelete = post;
    this.deleteModalOpen = true;
  }

  closeDeleteModal() {
    this.deleteModalOpen = false;
    this.postToDelete = null;
  }

  confirmDelete() {
    if (!this.postToDelete) return;

    this.deleting = true;
    this.postService.deletePost(this.postToDelete.id).subscribe({
      next: () => {
        this.deleting = false;
        this.closeDeleteModal();
        this.loadPosts();
      },
      error: (err) => {
        this.deleting = false;
        alert('Erro ao excluir post');
        console.error(err);
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    return status === 'published' ? 'badge-success' : 'badge-warning';
  }

  getStatusLabel(status: string): string {
    return status === 'published' ? 'Publicado' : 'Rascunho';
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  getPostImage(post: Post): string {
    return post.featuredImage || post.contentImages?.[0] || '';
  }

  onPostImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    const container = img.parentElement;
    img.remove();
    if (container && !container.querySelector('.no-image')) {
      const fallback = document.createElement('div');
      fallback.className = 'no-image';
      fallback.textContent = 'IMG';
      container.appendChild(fallback);
    }
  }
}
