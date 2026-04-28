import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { PostService, PostFilters } from '../../../core/services/post.service';
import { CategoryService } from '../../../core/services/category.service';
import { Post, Category } from '../../../core/models/post.model';
import { debounceTime, distinctUntilChanged } from 'rxjs';

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
    private postService: PostService,
    private categoryService: CategoryService,
    private fb: FormBuilder
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
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories.filter(c => c.type === 'blog' || c.type === 'both');
      },
      error: (err) => console.error('Erro ao carregar categorias', err)
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

    this.postService.getPosts(filters).subscribe({
      next: (response) => {
        this.posts = response.data;
        this.totalItems = response.total;
        this.totalPages = response.totalPages;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erro ao carregar posts';
        this.loading = false;
        console.error(err);
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
}
