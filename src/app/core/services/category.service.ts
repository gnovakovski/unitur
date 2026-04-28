import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { Category } from '../models/post.model';
import { FirebaseService } from './firebase.service';

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
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly collectionName = 'categories';

  constructor(private firebaseService: FirebaseService) {}

  getCategories(filters?: CategoryFilters): Observable<PaginatedResponse<Category>> {
    return from(getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('createdAt', 'desc')
    ))).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Category)),
      map(categories => this.applyFilters(categories, filters))
    );
  }

  getAllCategories(): Observable<Category[]> {
    return from(getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('name', 'asc')
    ))).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Category))
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

    return from(setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newCategory)).then(() => newCategory));
  }

  updateCategory(id: number, category: Partial<Category>): Observable<Category> {
    const updatedCategory = {
      ...category,
      updatedAt: new Date()
    };

    return from(updateDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(updatedCategory)).then(() => ({
      id,
      ...updatedCategory
    } as Category)));
  }

  deleteCategory(id: number): Observable<void> {
    return from(deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))));
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

    return {
      data: filteredCategories.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages
    };
  }

  private cleanUndefined<T extends object>(data: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }
}
