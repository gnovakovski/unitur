import { Injectable } from '@angular/core';
import { Observable, catchError, concat, from, map, of, tap } from 'rxjs';
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
  private readonly localPostsKey = 'unitur_admin_posts';

  constructor(private firebaseService: FirebaseService) {}

  getPosts(filters?: PostFilters): Observable<PaginatedResponse<Post>> {
    const request = getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('createdAt', 'desc')
    ));

    const firestorePosts$ = from(this.firebaseService.withTimeout(request, 'Tempo esgotado ao carregar posts do Firestore.')).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Post)),
      tap(posts => {
        if (posts.length > 0) {
          this.replaceLocalPosts(posts);
        }
      }),
      catchError(() => of([] as Post[]))
    );

    return concat(
      of(this.getLocalPosts()),
      firestorePosts$
    ).pipe(
      map(posts => this.dedupePosts([...this.getLocalPosts(), ...posts])),
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
          .find(post => post.id === id) || this.getLocalPosts().find(post => post.id === id);

        if (!item) {
          throw new Error('Post não encontrado');
        }

        return item;
      })
    ).pipe(
      catchError(() => {
        const localPost = this.getLocalPosts().find(post => post.id === id);
        if (!localPost) {
          throw new Error('Post não encontrado');
        }

        return of(localPost);
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
      contentImages: post.contentImages || [],
      categoryId: Number(post.categoryId),
      tags: post.tags || [],
      relatedTrips: post.relatedTrips || [],
      status: post.status || 'draft',
      publishedAt: post.status === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
      author: post.author || { id: 1, name: 'Administrador' }
    };

    this.upsertLocalPost(newPost);

    void this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newPost)),
      'Tempo esgotado ao salvar post no Firestore.'
    ).catch(err => console.warn('Post salvo localmente, mas nao foi possivel persistir no Firestore.', err));

    return of(newPost);
  }

  updatePost(id: number, post: Partial<Post>): Observable<Post> {
    const updatedPost = {
      ...post,
      categoryId: post.categoryId ? Number(post.categoryId) : post.categoryId,
      updatedAt: new Date()
    };

    const localPost = {
      ...(this.getLocalPosts().find(item => item.id === id) || {}),
      id,
      ...updatedPost
    } as Post;

    this.upsertLocalPost(localPost);

    void this.firebaseService.withTimeout(
      updateDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(updatedPost)),
      'Tempo esgotado ao atualizar post no Firestore.'
    ).catch(err => console.warn('Post atualizado localmente, mas nao foi possivel persistir no Firestore.', err));

    return of(localPost);
  }

  deletePost(id: number): Observable<void> {
    this.removeLocalPost(id);

    void this.firebaseService.withTimeout(
      deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))),
      'Tempo esgotado ao excluir post no Firestore.'
    ).catch(err => console.warn('Post removido localmente, mas nao foi possivel excluir no Firestore.', err));

    return of(undefined);
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

  private getLocalPosts(): Post[] {
    try {
      const rawPosts = JSON.parse(localStorage.getItem(this.localPostsKey) || '[]') as Post[];
      return rawPosts.map(post => ({
        ...post,
        publishedAt: post.publishedAt ? new Date(post.publishedAt) : undefined,
        createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
        updatedAt: post.updatedAt ? new Date(post.updatedAt) : new Date()
      }));
    } catch {
      return [];
    }
  }

  private upsertLocalPost(post: Post) {
    const posts = this.getLocalPosts();
    const nextPosts = this.dedupePosts([...posts, post]);
    localStorage.setItem(this.localPostsKey, JSON.stringify(nextPosts));
  }

  private replaceLocalPosts(posts: Post[]) {
    const nextPosts = this.dedupePosts([...this.getLocalPosts(), ...posts]);
    localStorage.setItem(this.localPostsKey, JSON.stringify(nextPosts));
  }

  private removeLocalPost(id: number) {
    const nextPosts = this.getLocalPosts().filter(post => Number(post.id) !== Number(id));
    localStorage.setItem(this.localPostsKey, JSON.stringify(nextPosts));
  }

  private dedupePosts(posts: Post[]): Post[] {
    return [...posts].reduce((result, post) => {
      const existingIndex = result.findIndex(item => Number(item.id) === Number(post.id));
      if (existingIndex >= 0) {
        result[existingIndex] = {
          ...result[existingIndex],
          ...post
        };
        return result;
      }

      result.push(post);
      return result;
    }, [] as Post[]).sort((a, b) => this.getTime(b.createdAt) - this.getTime(a.createdAt));
  }

  private getTime(date?: Date): number {
    if (!date) {
      return 0;
    }

    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

}
