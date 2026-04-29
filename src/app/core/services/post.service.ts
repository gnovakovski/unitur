import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { Post } from '../models/post.model';
import { FirebaseService } from './firebase.service';

export interface PostFilters {
  search?: string;
  categoryId?: number;
  status?: 'draft' | 'published';
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
export class PostService {
  private readonly collectionName = 'posts';

  constructor(private firebaseService: FirebaseService) {}

  getPosts(filters?: PostFilters): Observable<PaginatedResponse<Post>> {
    const request = getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('createdAt', 'desc')
    ));

    return from(this.firebaseService.withTimeout(request, 'Tempo esgotado ao carregar posts do Firestore.')).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Post)),
      map(posts => this.applyFilters(posts, filters))
    );
  }

  getPost(id: number): Observable<Post> {
    return from(this.firebaseService.withTimeout(
      getDocs(collection(this.firebaseService.firestore, this.collectionName)),
      'Tempo esgotado ao carregar post do Firestore.'
    )).pipe(
      map(snapshot => {
        const item = snapshot.docs
          .map(docSnap => this.firebaseService.normalizeDates(docSnap.data()) as Post)
          .find(post => post.id === id);

        if (!item) {
          throw new Error('Post não encontrado');
        }

        return item;
      })
    );
  }

  createPost(post: Partial<Post>): Observable<Post> {
    const id = Date.now();
    const now = new Date();
    const newPost: Post = {
      id,
      title: post.title || '',
      slug: post.slug || this.generateSlug(post.title || ''),
      content: post.content || '',
      excerpt: post.excerpt || '',
      featuredImage: post.featuredImage,
      categoryId: Number(post.categoryId),
      tags: post.tags || [],
      relatedTrips: post.relatedTrips || [],
      status: post.status || 'draft',
      publishedAt: post.status === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
      author: post.author || { id: 1, name: 'Administrador' }
    };

    return from(this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newPost)).then(() => newPost),
      'Tempo esgotado ao salvar post no Firestore.'
    ));
  }

  updatePost(id: number, post: Partial<Post>): Observable<Post> {
    const updatedPost = {
      ...post,
      categoryId: post.categoryId ? Number(post.categoryId) : post.categoryId,
      updatedAt: new Date()
    };

    return from(this.firebaseService.withTimeout(
      updateDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(updatedPost)).then(() => ({
        id,
        ...updatedPost
      } as Post)),
      'Tempo esgotado ao atualizar post no Firestore.'
    ));
  }

  deletePost(id: number): Observable<void> {
    return from(this.firebaseService.withTimeout(
      deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))),
      'Tempo esgotado ao excluir post no Firestore.'
    ));
  }

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private applyFilters(posts: Post[], filters?: PostFilters): PaginatedResponse<Post> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    let filteredPosts = [...posts];

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filteredPosts = filteredPosts.filter(post =>
        post.title.toLowerCase().includes(search) ||
        post.excerpt.toLowerCase().includes(search)
      );
    }

    if (filters?.categoryId) {
      filteredPosts = filteredPosts.filter(post => post.categoryId === Number(filters.categoryId));
    }

    if (filters?.status) {
      filteredPosts = filteredPosts.filter(post => post.status === filters.status);
    }

    const total = filteredPosts.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;

    return {
      data: filteredPosts.slice(start, start + limit),
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
