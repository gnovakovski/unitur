import { Injectable } from '@angular/core';
import { Observable, catchError, from, map, of, shareReplay } from 'rxjs';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore/lite';
import { Category } from '../models/post.model';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';

export interface CategoryFilters {
  search?: string;
  type?: 'blog' | 'trip' | 'both';
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly collectionName = 'categories';
  private readonly cacheKey = 'unitur_categories_cache';
  private categories$: Observable<Category[]> | null = null;

  constructor(
    private firebaseService: FirebaseService,
    private storage: BrowserStorageService
  ) {}

  getAllCategories(): Observable<Category[]> {
    if (!this.categories$) {
      const cached = this.getLocalCategories();

      const firestore$ = from(this.firebaseService.withTimeout(getDocs(query(
        collection(this.firebaseService.firestore, this.collectionName),
        orderBy('name', 'asc')
      )), 'Tempo esgotado ao carregar categorias do Firestore.')).pipe(
        map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Category)),
        map(categories => {
          this.storage.setItem(this.cacheKey, JSON.stringify(categories));
          return categories;
        }),
        catchError(() => {
          this.categories$ = null;
          return of(cached);
        })
      );

      // Warm-start: emit cached value immediately, then Firestore result
      const source$ = cached.length > 0
        ? new Observable<Category[]>(subscriber => {
            subscriber.next(cached);
            firestore$.subscribe({
              next: v => subscriber.next(v),
              error: e => subscriber.error(e),
              complete: () => subscriber.complete()
            });
          })
        : firestore$;

      this.categories$ = source$.pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }

    return this.categories$;
  }

  getCategories(filters?: CategoryFilters): Observable<PaginatedResponse<Category>> {
    return this.getAllCategories().pipe(
      map(categories => this.applyFilters(categories, filters))
    );
  }

  getCategory(id: number): Observable<Category> {
    return this.getAllCategories().pipe(
      map(categories => {
        const category = categories.find(item => item.id === id);

        if (!category) {
          throw new Error('Categoria não encontrada');
        }

        return category;
      })
    );
  }

  createCategory(category: Partial<Category>): Observable<Category> {
    const id = Date.now();
    const now = new Date();
    const newCategory: Category = {
      id,
      name: category.name || '',
      slug: category.slug || this.generateSlug(category.name || ''),
      description: category.description,
      type: category.type || 'blog',
      color: category.color,
      icon: category.icon,
      createdAt: now,
      updatedAt: now
    };

    return from(this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newCategory)).then(() => newCategory),
      'Tempo esgotado ao salvar categoria no Firestore.'
    )).pipe(
      map(saved => {
        this.invalidateCache();
        return saved;
      })
    );
  }

  updateCategory(id: number, category: Partial<Category>): Observable<Category> {
    const updatedCategory = {
      ...category,
      updatedAt: new Date()
    };

    return from(this.firebaseService.withTimeout(
      updateDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(updatedCategory)).then(() => ({
        id,
        ...updatedCategory
      } as Category)),
      'Tempo esgotado ao atualizar categoria no Firestore.'
    )).pipe(
      map(saved => {
        this.invalidateCache();
        return saved;
      })
    );
  }

  deleteCategory(id: number): Observable<void> {
    return from(this.firebaseService.withTimeout(
      deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))),
      'Tempo esgotado ao excluir categoria no Firestore.'
    )).pipe(
      map(() => {
        this.invalidateCache();
      })
    );
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private invalidateCache(): void {
    this.categories$ = null;
    this.storage.removeItem(this.cacheKey);
  }

  private getLocalCategories(): Category[] {
    try {
      const raw = this.storage.getItem(this.cacheKey);
      if (!raw) return [];
      return (JSON.parse(raw) as Category[]).map(c => this.firebaseService.normalizeDates(c));
    } catch {
      return [];
    }
  }

  private applyFilters(categories: Category[], filters?: CategoryFilters): PaginatedResponse<Category> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    let filteredCategories = [...categories];

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filteredCategories = filteredCategories.filter(category =>
        category.name.toLowerCase().includes(search) ||
        category.description?.toLowerCase().includes(search)
      );
    }

    if (filters?.type) {
      filteredCategories = filteredCategories.filter(category => category.type === filters.type);
    }

    const total = filteredCategories.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const pageData = filteredCategories.slice(start, start + limit);

    return {
      data: pageData,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: pageData.length === limit && start + limit < total
    };
  }

  private cleanUndefined<T extends object>(data: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }
}
