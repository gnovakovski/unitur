import { Injectable } from '@angular/core';
import { Observable, catchError, concat, from, map, of, shareReplay, switchMap, take, tap, timeout } from 'rxjs';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { Category, Post } from '../models/post.model';
import { DEFAULT_POST_AUTHOR } from '../utils/post-author';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';
import { CategoryService } from './category.service';

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
  /**
   * 'full' (blog público) procura também em tags, categoria e no texto do post,
   * exigindo todas as palavras digitadas. 'basic' (padrão, admin) olha só
   * título e resumo.
   */
  searchScope?: 'basic' | 'full';
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

  /** Texto normalizado usado pela busca do blog, memoizado por post. */
  private readonly searchIndex = new Map<number, { title: string; content: string; text: string }>();

  constructor(
    private firebaseService: FirebaseService,
    private storage: BrowserStorageService,
    private categoryService: CategoryService
  ) {}

  /** Força a próxima listagem a reler o Firestore. */
  resetPagination(): void {
    this.invalidateCache();
  }

  /** Descarta a leitura memoizada da coleção — a próxima listagem relê o Firestore. */
  private invalidateCache(): void {
    this.allPosts$ = undefined;
    this.searchIndex.clear();
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
      map(posts => this.paginate(this.applyClientFilters(posts, filters), page, pageSize, false)),
      switchMap(response => this.withResolvedCategories(response))
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
      map(posts => this.paginate(this.applyClientFilters(posts, filters), page, pageSize, true)),
      switchMap(response => this.withResolvedCategories(response))
    );
  }

  private paginate(items: Post[], page: number, pageSize: number, clampPage: boolean): PaginatedResponse<Post> {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = clampPage ? Math.min(page, totalPages) : page;
    const start = (currentPage - 1) * pageSize;

    return {
      data: items.slice(start, start + pageSize),
      total,
      page: currentPage,
      limit: pageSize,
      totalPages,
      hasNextPage: currentPage < totalPages
    };
  }

  private withResolvedCategories(response: PaginatedResponse<Post>): Observable<PaginatedResponse<Post>> {
    return this.resolveCategories(response.data).pipe(map(data => ({ ...response, data })));
  }

  /**
   * Completa `post.category` a partir do `categoryId`. Só os posts migrados do
   * WordPress têm a cópia embutida da categoria; os criados no admin antes desta
   * correção não tinham, e por isso a categoria sumia das telas. Só consulta as
   * categorias quando algum post precisa (sem cópia, ou cópia divergente).
   */
  private resolveCategories(posts: Post[]): Observable<Post[]> {
    if (!posts.some(post => this.needsCategoryLookup(post))) {
      return of(posts);
    }

    return this.categoryService.getAllCategories().pipe(
      take(1),
      timeout(8000),
      map(categories => {
        const byId = new Map<number, Category>(categories.map(category => [Number(category.id), category]));
        return posts.map(post => {
          if (!this.needsCategoryLookup(post)) return post;
          const category = byId.get(Number(post.categoryId));
          return category ? { ...post, category } : post;
        });
      }),
      catchError(() => of(posts))
    );
  }

  private needsCategoryLookup(post: Post): boolean {
    return Boolean(post.categoryId) && (!post.category || Number(post.category.id) !== Number(post.categoryId));
  }

  /** Quantidade de posts publicados por categoria (para o filtro do blog). */
  getPublishedCategoryCounts(): Observable<Map<number, number>> {
    return this.loadAllPosts().pipe(
      map(posts => {
        const counts = new Map<number, number>();
        for (const post of this.dedupePosts(posts)) {
          if ((post.status || 'published') !== 'published' || !post.categoryId) continue;
          const id = Number(post.categoryId);
          counts.set(id, (counts.get(id) || 0) + 1);
        }
        return counts;
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

  /**
   * Antes cada visita a um post lia a coleção inteira (~356 documentos). Agora:
   * se a coleção já foi carregada na sessão, reaproveita; senão busca só o
   * documento pelo slug (1 leitura) e só cai na leitura completa quando o slug
   * não bate exatamente (slugs legados gerados a partir do título ou do id).
   */
  getPostBySlug(slug: string): Observable<Post> {
    const normalized = String(slug || '').trim().toLowerCase();
    const fromCollection$ = () => this.loadAllPosts().pipe(
      map(posts => this.findBySlug(posts, normalized) ?? this.findBySlug(this.getLocalPosts(), normalized))
    );
    const source$ = this.allPosts$
      ? fromCollection$()
      : this.fetchPostBySlug(normalized).pipe(switchMap(post => post ? of(post) : fromCollection$()));

    return source$.pipe(
      map(post => {
        if (!post) {
          throw new Error('Post não encontrado');
        }
        return post;
      }),
      catchError(() => {
        const post = this.findBySlug(this.getLocalPosts(), normalized);
        if (!post) {
          throw new Error('Post não encontrado');
        }
        return of(post);
      }),
      switchMap(post => this.resolveCategories([post]).pipe(map(([resolved]) => resolved)))
    );
  }

  /**
   * Últimos posts publicados, para vitrines como a home. Lê só alguns documentos
   * via `orderBy('publishedAt')` (índice automático de campo único, sem índice
   * composto) em vez da coleção inteira — que hoje passa de 4 MB com o HTML dos
   * posts. A margem extra cobre rascunhos, filtrados no cliente. Se a consulta
   * falhar, cai na listagem completa (comportamento antigo).
   */
  getLatestPosts(count = 3): Observable<Post[]> {
    if (this.allPosts$) {
      return this.getPostsPublic({ status: 'published', limit: count }).pipe(map(response => response.data));
    }

    return from(this.firebaseService.withTimeout(
      getDocs(query(
        collection(this.firebaseService.firestore, this.collectionName),
        orderBy('publishedAt', 'desc'),
        limit(count + 5)
      )),
      'Tempo esgotado ao carregar os últimos posts do Firestore.'
    )).pipe(
      map(snapshot => this.applyClientFilters(
        snapshot.docs.map(item => this.mapFirestorePost(item.id, item.data())),
        { status: 'published' }
      ).slice(0, count)),
      switchMap(posts => this.resolveCategories(posts)),
      catchError(() => this.getPostsPublic({ status: 'published', limit: count }).pipe(map(response => response.data)))
    );
  }

  /** Posts publicados da mesma categoria, sem reler a coleção inteira. */
  getRelatedPosts(post: Post, count = 3): Observable<Post[]> {
    const pick = (posts: Post[]) => this.applyClientFilters(posts, { categoryId: post.categoryId, status: 'published' })
      .filter(item => Number(item.id) !== Number(post.id))
      .slice(0, count);

    if (this.allPosts$) {
      return this.allPosts$.pipe(map(pick), catchError(() => of([])));
    }
    if (!post.categoryId) {
      return of([]);
    }

    return from(this.firebaseService.withTimeout(
      getDocs(query(
        collection(this.firebaseService.firestore, this.collectionName),
        where('categoryId', '==', Number(post.categoryId)),
        limit(count * 4)
      )),
      'Tempo esgotado ao carregar posts relacionados do Firestore.'
    )).pipe(
      map(snapshot => pick(snapshot.docs.map(item => this.mapFirestorePost(item.id, item.data())))),
      catchError(() => of([]))
    );
  }

  private fetchPostBySlug(slug: string): Observable<Post | null> {
    if (!slug) return of(null);

    return from(this.firebaseService.withTimeout(
      getDocs(query(
        collection(this.firebaseService.firestore, this.collectionName),
        where('slug', '==', slug),
        limit(1)
      )),
      'Tempo esgotado ao carregar post do Firestore.'
    )).pipe(
      map(snapshot => snapshot.empty ? null : this.mapFirestorePost(snapshot.docs[0].id, snapshot.docs[0].data())),
      catchError(() => of(null))
    );
  }

  private findBySlug(posts: Post[], slug: string): Post | undefined {
    return this.dedupePosts(posts).find(item => this.matchesSlug(item, slug));
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
      category: post.category,
      tags: post.tags || [],
      relatedTrips: post.relatedTrips || [],
      status: post.status || 'draft',
      metaTitle: post.metaTitle || '',
      metaDescription: post.metaDescription || '',
      ogImage: post.ogImage || '',
      publishedAt: post.status === 'published' ? (post.publishedAt || now) : undefined,
      createdAt: now,
      updatedAt: now,
      author: post.author || { id: 1, name: DEFAULT_POST_AUTHOR }
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

    const terms = this.normalizeSearch(filters?.search).split(/\s+/).filter(Boolean);
    const fullSearch = filters?.searchScope === 'full' && terms.length > 0;

    if (fullSearch) {
      filtered = filtered.filter(post => {
        const text = this.searchableText(post);
        return terms.every(term => text.includes(term));
      });
    } else if (filters?.search) {
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

    const sorted = this.sortPosts(filtered, filters?.sortBy, filters?.sortDirection);
    if (!fullSearch) return sorted;

    // Na busca, posts com os termos no título vêm primeiro (mantendo a ordem por data).
    const inTitle = (post: Post) => terms.every(term => this.normalizeSearch(post.title).includes(term));
    return [...sorted.filter(inTitle), ...sorted.filter(post => !inTitle(post))];
  }

  private searchableText(post: Post): string {
    const id = Number(post.id);
    const title = post.title || '';
    const content = post.content || '';
    const cached = this.searchIndex.get(id);
    if (cached && cached.title === title && cached.content === content) {
      return cached.text;
    }

    const plainContent = content
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ');
    const text = this.normalizeSearch([
      title,
      post.excerpt,
      (post.tags || []).join(' '),
      post.category?.name,
      (post.sourceCategories || []).join(' '),
      plainContent
    ].join(' ')).replace(/\s+/g, ' ');

    this.searchIndex.set(id, { title, content, text });
    return text;
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
