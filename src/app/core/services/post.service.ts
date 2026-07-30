import { Injectable } from '@angular/core';
import { Observable, catchError, concat, from, map, of, shareReplay, tap } from 'rxjs';
import { DocumentSnapshot, QueryDocumentSnapshot, collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, startAfter, updateDoc } from 'firebase/firestore';
import { Post } from '../models/post.model';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';

export interface PostFilters {
  search?: string;
  categoryId?: number;
  status?: 'draft' | 'published';
  page?: number;
  limit?: number;
  /**
   * Quando true, aplica paginação server-side com limit() + startAfter() —
   * comportamento das telas de admin, que só andam para frente e voltam ao topo.
   * Nas telas públicas (blog) fica false: lá o `limit` é o tamanho da página, e
   * usá-lo como janela de leitura truncaria a listagem numa página só.
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
   * Invalidada por resetPagination() e por qualquer escrita.
   */
  private allPosts$?: Observable<Post[]>;

  // Cursor para paginação server-side nas telas de admin.
  private adminCursor: QueryDocumentSnapshot | null = null;
  private lastFilterHash = '';

  constructor(
    private firebaseService: FirebaseService,
    private storage: BrowserStorageService
  ) {}

  /** Reseta o cursor de paginação (chamar quando filtros mudam ou ao recarregar). */
  resetPagination(): void {
    this.adminCursor = null;
    this.lastFilterHash = '';
    this.invalidateCache();
  }

  /** Descarta a leitura memoizada da coleção — a próxima listagem relê o Firestore. */
  private invalidateCache(): void {
    this.allPosts$ = undefined;
  }

  private hashFilters(f: PostFilters): string {
    const { page: _p, ...rest } = f as Record<string, unknown>;
    return JSON.stringify(rest);
  }
  getPosts(filters?: PostFilters): Observable<PaginatedResponse<Post>> {
    // Cursor server-side só no admin. Para o blog, `limit` é o tamanho da página
    // (9) e não a janela de leitura — ver getPostsPublic().
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
      this.loadAllPosts()
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
        return snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Post);
      }),
      tap(posts => {
        if (posts.length > 0) {
          this.replaceLocalPosts(posts);
        }
      }),
      catchError(() => of([] as Post[])),
      shareReplay(1)
    );

    return this.allPosts$;
  }

  private getPostsAdmin(filters?: PostFilters): Observable<PaginatedResponse<Post>> {
    const pageSize = filters?.limit ?? 10;
    const filterHash = this.hashFilters(filters ?? {});

    // Detecta mudança de filtro e reseta cursor automaticamente.
    if (filterHash !== this.lastFilterHash) {
      this.adminCursor = null;
    }
    this.lastFilterHash = filterHash;

    // Monta a query com limit server-side + cursor quando disponível.
    const constraints: Parameters<typeof query>[1][] = [limit(pageSize + 1)]; // +1 para detectar hasNextPage
    if (this.adminCursor) {
      constraints.push(startAfter(this.adminCursor));
    }

    const firestoreQuery = query(
      collection(this.firebaseService.firestore, this.collectionName),
      ...constraints
    );

    const firestorePosts$ = from(this.firebaseService.withTimeout(
      getDocs(firestoreQuery),
      'Tempo esgotado ao carregar posts do Firestore.'
    )).pipe(
      map(snapshot => {
        const docs = snapshot.docs;
        const hasNextPage = docs.length > pageSize;
        const pageDocs = hasNextPage ? docs.slice(0, pageSize) : docs;

        // Salva o último doc desta página como cursor para a próxima.
        this.adminCursor = pageDocs.length > 0
          ? (pageDocs[pageDocs.length - 1] as QueryDocumentSnapshot)
          : null;

        const posts = pageDocs.map(d => this.firebaseService.normalizeDates(d.data()) as Post);

        // Atualiza cache local com os posts desta página.
        if (posts.length > 0) {
          const cached = this.getLocalPosts();
          const merged = this.dedupePosts([...cached, ...posts]);
          this.storage.setItem(this.localPostsKey, JSON.stringify(merged));
        }

        return { posts, hasNextPage };
      }),
      catchError(() => of({ posts: [] as Post[], hasNextPage: false }))
    );

    return concat(
      of({ posts: this.getLocalPosts(), hasNextPage: false }),
      firestorePosts$
    ).pipe(
      map(({ posts, hasNextPage }) => {
        const filtered = this.applyClientFilters(posts, filters);
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        return {
          data: filtered.slice(0, pageSize),
          total,
          page: filters?.page ?? 1,
          limit: pageSize,
          totalPages,
          hasNextPage
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
          const post = this.firebaseService.normalizeDates(snapshot.data()) as Post;
          this.upsertLocalPost(post);
          return post;
        }
        // Documento não existe no Firestore — tenta cache local.
        const local = this.getLocalPosts().find(p => p.id === id);
        if (local) return local;
        throw new Error('Post não encontrado');
      }),
      catchError(() => {
        const local = this.getLocalPosts().find(p => p.id === id);
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
        const posts = snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Post);
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
      publishedAt: post.status === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
      author: post.author || { id: 1, name: 'Administrador' }
    };

    this.upsertLocalPost(newPost);
    this.invalidateCache();

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
    this.invalidateCache();

    void this.firebaseService.withTimeout(
      updateDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(updatedPost)),
      'Tempo esgotado ao atualizar post no Firestore.'
    ).catch(err => console.warn('Post atualizado localmente, mas nao foi possivel persistir no Firestore.', err));

    return of(localPost);
  }

  deletePost(id: number): Observable<void> {
    this.removeLocalPost(id);
    this.invalidateCache();

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

  private applyClientFilters(posts: Post[], filters?: PostFilters): Post[] {
    let filtered = this.dedupePosts([...posts]);

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(search) ||
        post.excerpt.toLowerCase().includes(search)
      );
    }

    if (filters?.categoryId) {
      filtered = filtered.filter(post => post.categoryId === Number(filters.categoryId));
    }

    if (filters?.status) {
      filtered = filtered.filter(post => (post.status || 'published') === filters.status);
    }

    return filtered;
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
