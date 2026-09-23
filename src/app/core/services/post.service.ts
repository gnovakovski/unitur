import { Injectable } from '@angular/core';
import { Observable, catchError, concat, from, map, of, shareReplay, tap } from 'rxjs';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc } from 'firebase/firestore';
import { Post } from '../models/post.model';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';

export interface PostFilters {
  search?: string;
  categoryId?: number;
  status?: 'draft' | 'published';
  page?: number;
  limit?: number;
  sortBy?: 'publishedAt' | 'createdAt' | 'updatedAt' | 'title';
  sortDirection?: 'asc' | 'desc';
  /**
   * Quando true, pagina a coleção memoizada no fluxo administrativo. Isso permite
   * busca e ordenação globais sem depender da ordem arbitrária do Firestore.
   */
  adminPagination?: boolean;
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
export class PostService {
  private readonly collectionName = 'posts';
  private readonly localPostsKey = 'unitur_admin_posts';
  /**
   * Teto de documentos lidos na listagem pública. Precisa ser maior que a coleção
   * inteira (hoje ~353 posts), senão o blog trunca e perde as páginas do fim.
   * Se for atingido, o serviço avisa no console em vez de truncar em silêncio.
   */
  private readonly publicFetchLimit = 2000;

  /**
   * Leitura da coleção memoizada por sessão. Sem isso, cada troca de página do
   * blog (e cada filtro de categoria) releria os ~353 documentos no Firestore.
   * Invalidada quando há escrita ou quando um recarregamento explícito é pedido.
   */
  private allPosts$?: Observable<Post[]>;

  constructor(
    private firebaseService: FirebaseService,
    private storage: BrowserStorageService
  ) {}

  /** Força a próxima listagem a reler o Firestore. */
  resetPagination(): void {
    this.invalidateCache();
  }

  /** Descarta a leitura memoizada da coleção — a próxima listagem relê o Firestore. */
  private invalidateCache(): void {
    this.allPosts$ = undefined;
  }

  getPosts(filters?: PostFilters): Observable<PaginatedResponse<Post>> {
    // O admin e o blog usam a mesma coleção memoizada, mas mantêm fluxos
    // separados para que cada tela controle sua paginação.
    if (!filters?.adminPagination) {
      return this.getPostsPublic(filters);
    }

    return this.getPostsAdmin(filters);
  }

  /**
   * Listagem pública (blog, home, relacionados): filtra e pagina no cliente sobre
   * a coleção inteira, para `total` e `totalPages` refletirem TODOS os posts
   * publicados — e não apenas os documentos da página atual, que era o bug em que
   * o blog mostrava 9 posts e nenhuma paginação.
   */
  private getPostsPublic(filters?: PostFilters): Observable<PaginatedResponse<Post>> {
    const pageSize = filters?.limit ?? 10;
    const page = Math.max(1, Number(filters?.page) || 1);

    return concat(
      of(this.getLocalPosts()),
      this.loadAllPosts().pipe(catchError(() => of(this.getLocalPosts())))
    ).pipe(
      map(posts => {
        const filtered = this.applyClientFilters(posts, filters);
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const start = (page - 1) * pageSize;

        return {
          data: filtered.slice(start, start + pageSize),
          total,
          page,
          limit: pageSize,
          totalPages,
          hasNextPage: page < totalPages
        } as PaginatedResponse<Post>;
      })
    );
  }

  /**
   * Sem orderBy() na query, de propósito: o Firestore excluiria silenciosamente
   * documentos sem `createdAt` (vários posts vieram da importação do WordPress).
   * A ordenação por data, mais recentes primeiro, é feita no cliente por dedupePosts().
   */
  private loadAllPosts(): Observable<Post[]> {
    if (this.allPosts$) return this.allPosts$;

    this.allPosts$ = from(this.firebaseService.withTimeout(
      getDocs(query(
        collection(this.firebaseService.firestore, this.collectionName),
        limit(this.publicFetchLimit)
      )),
      'Tempo esgotado ao carregar posts do Firestore.'
    )).pipe(
      map(snapshot => {
        if (snapshot.size >= this.publicFetchLimit) {
          console.warn(
            `[PostService] Teto de ${this.publicFetchLimit} posts lidos atingido — ` +
            'a listagem do blog pode estar truncada. Aumente publicFetchLimit ou ' +
            'migre a listagem para paginação server-side.'
          );
        }
        return snapshot.docs.map(item => this.mapFirestorePost(item.id, item.data()));
      }),
      tap(posts => {
        if (posts.length > 0) {
          this.replaceLocalPosts(posts);
        }
      }),
      shareReplay(1)
    );

    return this.allPosts$;
  }

  private getPostsAdmin(filters?: PostFilters): Observable<PaginatedResponse<Post>> {
    const pageSize = filters?.limit ?? 10;
    const page = Math.max(1, Number(filters?.page) || 1);

    // A gestão precisa enxergar o conjunto completo para ordenar de forma
    // determinística por data/título. A leitura é memoizada por sessão, então
    // filtros, ordenação e paginação não geram novas leituras no Firestore.
    return this.loadAllPosts().pipe(
      map(posts => {
        const filtered = this.applyClientFilters(posts, filters);
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * pageSize;

        return {
          data: filtered.slice(start, start + pageSize),
          total,
          page: safePage,
          limit: pageSize,
          totalPages,
          hasNextPage: safePage < totalPages
        } as PaginatedResponse<Post>;
      })
    );
  }

  getPost(id: number): Observable<Post> {
    const ref = doc(this.firebaseService.firestore, this.collectionName, String(id));
    return from(this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar post do Firestore.'
    )).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const post = this.mapFirestorePost(snapshot.id, snapshot.data());
          this.upsertLocalPost(post);
          return post;
        }
        // Documento não existe no Firestore — tenta cache local.
        const local = this.getLocalPosts().find(p => Number(p.id) === Number(id));
        if (local) return local;
        throw new Error('Post não encontrado');
      }),
      catchError(() => {
        const local = this.getLocalPosts().find(p => Number(p.id) === Number(id));
        if (!local) throw new Error('Post não encontrado');
        return of(local);
      })
    );
  }

  getPostBySlug(slug: string): Observable<Post> {
    const normalized = String(slug || '').trim().toLowerCase();

    return from(this.firebaseService.withTimeout(
      getDocs(collection(this.firebaseService.firestore, this.collectionName)),
      'Tempo esgotado ao carregar post do Firestore.'
    )).pipe(
      map(snapshot => {
        const posts = snapshot.docs.map(item => this.mapFirestorePost(item.id, item.data()));
        const candidates = this.dedupePosts([...posts, ...this.getLocalPosts()]);
        const post = candidates.find(item => this.matchesSlug(item, normalized));

        if (!post) {
          throw new Error('Post não encontrado');
        }

        return post;
      }),
      catchError(() => {
        const post = this.getLocalPosts().find(item => this.matchesSlug(item, normalized));
        if (!post) {
          throw new Error('Post não encontrado');
        }
        return of(post);
      })
    );
  }

  private matchesSlug(post: Post, slug: string): boolean {
    if (!slug) return false;
    if (post.slug && post.slug.toLowerCase() === slug) return true;
    if (this.generateSlug(post.title || '') === slug) return true;
    if (String(post.id) === slug) return true;
    return false;
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
      metaTitle: post.metaTitle || '',
      metaDescription: post.metaDescription || '',
      ogImage: post.ogImage || '',
      publishedAt: post.status === 'published' ? (post.publishedAt || now) : undefined,
      createdAt: now,
      updatedAt: now,
      author: post.author || { id: 1, name: 'Administrador' }
    };

    return from(this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newPost)).then(() => newPost),
      'Tempo esgotado ao salvar post no Firestore.'
    )).pipe(tap(saved => {
      this.upsertLocalPost(saved);
      this.invalidateCache();
    }));
  }

  updatePost(id: number, post: Partial<Post>): Observable<Post> {
    const existing = this.getLocalPosts().find(item => Number(item.id) === Number(id));
    const publishedAt = post.status === 'published'
      ? (post.publishedAt || existing?.publishedAt || new Date())
      : (post.publishedAt || existing?.publishedAt);
    const updatedPost = {
      ...post,
      categoryId: post.categoryId ? Number(post.categoryId) : post.categoryId,
      publishedAt,
      updatedAt: new Date()
    };

    const localPost = {
      ...(existing || {}),
      id,
      ...updatedPost
    } as Post;

    return from(this.firebaseService.withTimeout(
      setDoc(
        doc(this.firebaseService.firestore, this.collectionName, String(id)),
        this.cleanUndefined({ id, ...updatedPost }),
        { merge: true }
      ).then(() => localPost),
      'Tempo esgotado ao atualizar post no Firestore.'
    )).pipe(tap(saved => {
      this.upsertLocalPost(saved);
      this.invalidateCache();
    }));
  }

  deletePost(id: number): Observable<void> {
    return from(this.firebaseService.withTimeout(
      deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))),
      'Tempo esgotado ao excluir post no Firestore.'
    )).pipe(tap(() => {
      this.removeLocalPost(id);
      this.invalidateCache();
    }));
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

  private applyClientFilters(posts: Post[], filters?: PostFilters): Post[] {
    let filtered = this.dedupePosts([...posts]);

    if (filters?.search) {
      const search = this.normalizeSearch(filters.search);
      filtered = filtered.filter(post =>
        this.normalizeSearch(post.title).includes(search) ||
        this.normalizeSearch(post.excerpt).includes(search)
      );
    }

    if (filters?.categoryId) {
      filtered = filtered.filter(post => post.categoryId === Number(filters.categoryId));
    }

    if (filters?.status) {
      filtered = filtered.filter(post => (post.status || 'published') === filters.status);
    }

    return this.sortPosts(filtered, filters?.sortBy, filters?.sortDirection);
  }

  private normalizeSearch(value?: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private cleanUndefined<T extends object>(data: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }

  private getLocalPosts(): Post[] {
    try {
      const rawPosts = JSON.parse(this.storage.getItem(this.localPostsKey) || '[]') as Post[];
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
    this.storage.setItem(this.localPostsKey, JSON.stringify(nextPosts));
  }

  private replaceLocalPosts(posts: Post[]) {
    // Source of truth = Firestore. Cache local é substituído para evitar zombies.
    this.storage.setItem(this.localPostsKey, JSON.stringify(posts));
  }

  private removeLocalPost(id: number) {
    const nextPosts = this.getLocalPosts().filter(post => Number(post.id) !== Number(id));
    this.storage.setItem(this.localPostsKey, JSON.stringify(nextPosts));
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
    }, [] as Post[]);
  }

  private mapFirestorePost(documentId: string, data: Record<string, unknown>): Post {
    const normalized = this.firebaseService.normalizeDates(data) as unknown as Post;
    const numericDocumentId = Number(documentId);
    return {
      ...normalized,
      id: Number.isFinite(Number(normalized.id))
        ? Number(normalized.id)
        : numericDocumentId
    };
  }

  private sortPosts(
    posts: Post[],
    sortBy: PostFilters['sortBy'] = 'publishedAt',
    direction: PostFilters['sortDirection'] = 'desc'
  ): Post[] {
    const factor = direction === 'asc' ? 1 : -1;
    return [...posts].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }) * factor;
      }

      const field = sortBy || 'publishedAt';
      const dateA = this.getTime(a[field]) || this.getTime(a.createdAt);
      const dateB = this.getTime(b[field]) || this.getTime(b.createdAt);
      const difference = (dateA - dateB) * factor;
      return difference || a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
    });
  }

  private getTime(date?: Date): number {
    if (!date) {
      return 0;
    }

    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

}
