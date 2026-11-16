import { Injectable } from '@angular/core';
import { Observable, catchError, concat, defer, from, map, of, switchMap, tap } from 'rxjs';
import { QueryDocumentSnapshot, collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, startAfter, where } from 'firebase/firestore/lite';
import { Trip } from '../models/trip.model';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';
import { inferTripScope } from '../utils/trip-scope';
import { runSelectQuery } from '../utils/firestore-rest';
import { environment } from '../../../environments/environment';

/**
 * Campos que as listagens públicas usam (cards da home, de /viagens e das
 * "viagens relacionadas" do blog, filtros, ordenação e URL canônica).
 *
 * Fica de fora o conteúdo da página da viagem — roteiro dia a dia, galeria,
 * hotéis, o que inclui, formas de pagamento, política de cancelamento e a
 * descrição longa —, que é ~90% do peso: a coleção inteira passa de 900 KB e
 * este índice fica em torno de 60 KB.
 */
const TRIP_INDEX_FIELDS = [
  'id', 'title', 'slug', 'status', 'scope', 'tripType', 'menuIds', 'tagId', 'categoryId',
  'destination', 'country', 'period', 'startDate', 'endDate', 'duration', 'shortDescription',
  'mainImage', 'mainImagePosition', 'mainImageFit', 'mainImageRotation',
  'price', 'foreignPrice', 'foreignCurrency', 'foreignExchangeRate',
  'availableSpots', 'showAvailableSpots', 'spiritualGuide', 'coordinator',
  'featured', 'showOnHome', 'createdAt', 'updatedAt'
] as const;

export interface TripFilters {
  search?: string;
  categoryId?: number;
  status?: 'active' | 'inactive' | 'draft';
  page?: number;
  limit?: number;
  /** Quando true, aplica paginação server-side com limit() + startAfter(). */
  adminPagination?: boolean;
  /**
   * Quando true, lê só os campos de listagem (TRIP_INDEX_FIELDS) em vez dos
   * documentos inteiros. Para as telas públicas que mostram cards. Não use em
   * telas que editam a viagem: os campos que ficam de fora vêm indefinidos.
   */
  light?: boolean;
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
export class TripService {
  private readonly collectionName = 'trips';
  private readonly localTripsKey = 'unitur_admin_trips';
  /**
   * Cache local do índice leve. Chave separada da `localTripsKey` de propósito:
   * aquela guarda viagens completas e serve de reserva ao formulário do admin;
   * misturar o índice ali faria uma viagem "voltar" sem roteiro nem hotéis.
   */
  private readonly localTripIndexKey = 'unitur_trips_index';

  // Cursor para paginação server-side nas telas de admin.
  private adminCursor: QueryDocumentSnapshot | null = null;

  /**
   * true quando a última leitura do catálogo em getTripBySlug() veio do
   * Firestore. Em erro ou timeout fica false, e findActiveReplacement() se
   * recusa a afirmar que uma viagem não existe.
   */
  private catalogFresh = false;
  /** Catálogo da última leitura bem-sucedida em getTripBySlug(). */
  private catalog: Trip[] = [];
  private lastFilterHash = '';

  constructor(
    private firebaseService: FirebaseService,
    private storage: BrowserStorageService
  ) {}

  /** Reseta o cursor de paginação (chamar quando filtros mudam ou ao recarregar). */
  resetPagination(): void {
    this.adminCursor = null;
    this.lastFilterHash = '';
  }

  private hashFilters(f: TripFilters): string {
    const { page: _p, ...rest } = f as Record<string, unknown>;
    return JSON.stringify(rest);
  }
  getTrips(filters?: TripFilters): Observable<PaginatedResponse<Trip>> {
    // Quando adminPagination=true, usa limit() + startAfter() server-side.
    // Para chamadas públicas (home, viagens) mantém o comportamento original
    // (full fetch + sort client-side) pois evitamos orderBy() — documentos sem
    // `createdAt` seriam silenciosamente excluídos pelo Firestore.
    if (filters?.adminPagination) {
      return this.getTripsAdmin(filters);
    }

    const pageSize = filters?.limit ?? 100;
    const constraints: Parameters<typeof query>[1][] = [limit(pageSize)];

    // defer: a consulta só dispara se alguém assinar (no modo leve ela é apenas
    // o plano B; sem isto os ~900 KB seriam baixados sempre).
    const fullTrips$ = defer(() => from(this.firebaseService.withTimeout(getDocs(
      query(collection(this.firebaseService.firestore, this.collectionName), ...constraints)
    ), 'Tempo esgotado ao carregar viagens do Firestore.'))).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Trip)),
      tap(trips => {
        if (trips.length > 0) {
          this.replaceLocalTrips(trips);
        }
      })
    );

    // Listagens públicas: índice leve. Se ele falhar, cai na leitura completa
    // (comportamento anterior), então a listagem nunca fica vazia por causa dele.
    const firestoreTrips$ = (filters?.light
      ? this.fetchTripIndex(pageSize).pipe(catchError(() => fullTrips$))
      : fullTrips$
    ).pipe(catchError(() => of([] as Trip[])));

    return concat(
      of(filters?.light ? this.getLocalTripIndex() : this.getLocalTrips()),
      firestoreTrips$
    ).pipe(
      map(trips => this.sortTrips(trips)),
      map(trips => {
        const filtered = this.applyClientFilters(trips, filters);
        const page = filters?.page ?? 1;
        const ps = filters?.limit ?? 100;
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / ps));
        const start = (page - 1) * ps;
        const pageData = filtered.slice(start, start + ps);
        return {
          data: pageData,
          total,
          page,
          limit: ps,
          totalPages,
          hasNextPage: pageData.length === ps && start + ps < total
        } as PaginatedResponse<Trip>;
      })
    );
  }

  private getTripsAdmin(filters: TripFilters): Observable<PaginatedResponse<Trip>> {
    const pageSize = filters.limit ?? 10;
    const filterHash = this.hashFilters(filters);

    if (filterHash !== this.lastFilterHash) {
      this.adminCursor = null;
    }
    this.lastFilterHash = filterHash;

    const constraints: Parameters<typeof query>[1][] = [limit(pageSize + 1)];
    if (this.adminCursor) {
      constraints.push(startAfter(this.adminCursor));
    }

    const firestoreQuery = query(
      collection(this.firebaseService.firestore, this.collectionName),
      ...constraints
    );

    return from(this.firebaseService.withTimeout(
      getDocs(firestoreQuery),
      'Tempo esgotado ao carregar viagens do Firestore.'
    )).pipe(
      map(snapshot => {
        const docs = snapshot.docs;
        const hasNextPage = docs.length > pageSize;
        const pageDocs = hasNextPage ? docs.slice(0, pageSize) : docs;

        this.adminCursor = pageDocs.length > 0
          ? (pageDocs[pageDocs.length - 1] as QueryDocumentSnapshot)
          : null;

        const trips = pageDocs.map(d => this.firebaseService.normalizeDates(d.data()) as Trip);

        if (trips.length > 0) {
          const cached = this.getLocalTrips();
          const merged = this.sortTrips([...cached, ...trips]);
          this.storage.setItem(this.localTripsKey, JSON.stringify(merged));
        }

        const filtered = this.applyClientFilters(trips, filters);
        return {
          data: filtered.slice(0, pageSize),
          total: filtered.length,
          page: filters.page ?? 1,
          limit: pageSize,
          totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
          hasNextPage
        } as PaginatedResponse<Trip>;
      }),
      catchError(() => {
        const local = this.applyClientFilters(this.sortTrips(this.getLocalTrips()), filters);
        return of({
          data: local.slice(0, pageSize),
          total: local.length,
          page: filters.page ?? 1,
          limit: pageSize,
          totalPages: Math.max(1, Math.ceil(local.length / pageSize)),
          hasNextPage: false
        } as PaginatedResponse<Trip>);
      })
    );
  }

  getTrip(id: number): Observable<Trip> {
    const ref = doc(this.firebaseService.firestore, this.collectionName, String(id));
    return from(this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar viagem do Firestore.'
    )).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const trip = this.firebaseService.normalizeDates(snapshot.data()) as Trip;
          this.upsertLocalTrip(trip);
          return trip;
        }
        const local = this.getLocalTrips().find(t => t.id === id);
        if (local) return local;
        throw new Error('Viagem não encontrada');
      }),
      catchError(() => {
        const local = this.getLocalTrips().find(t => t.id === id);
        if (!local) throw new Error('Viagem não encontrada');
        return of(local);
      })
    );
  }

  /**
   * Antes cada visita a uma viagem lia a coleção inteira (~900 KB). Agora busca
   * só o documento pelo slug (1 leitura). O catálogo — e só o índice leve dele —
   * é lido apenas quando o slug não bate com uma viagem publicada: para achar
   * slugs legados (gerados do título, ou o id) e para findActiveReplacement()
   * saber se há uma viagem equivalente.
   */
  getTripBySlug(slug: string): Observable<Trip | null> {
    const normalized = String(slug || '').trim().toLowerCase();

    if (!normalized) {
      return of(null);
    }

    this.catalogFresh = false;

    return this.fetchTripBySlug(normalized).pipe(
      switchMap(trip => {
        if (trip && trip.status !== 'inactive' && trip.status !== 'draft') {
          return of(trip);
        }

        return this.loadCatalog().pipe(
          switchMap(catalog => {
            // Viagem encerrada ou rascunho: devolve mesmo assim; quem chama
            // decide o que fazer, já com o catálogo disponível.
            if (trip) return of(trip);

            const match = catalog.find(item => this.matchesSlug(item, normalized));
            if (!match) return of(null);

            // Slug legado: o índice não tem roteiro, hotéis etc. — busca a viagem completa.
            return this.getTrip(Number(match.id)).pipe(catchError(() => of(null)));
          })
        );
      }),
      catchError(() => {
        this.catalogFresh = false;
        const trip = this.getLocalTrips().find(item => this.matchesSlug(item, normalized));
        return of(trip || null);
      })
    );
  }

  /** Viagem com exatamente este slug (1 leitura), ou null. Erros sobem para quem chama. */
  private fetchTripBySlug(slug: string): Observable<Trip | null> {
    return from(this.firebaseService.withTimeout(
      getDocs(query(
        collection(this.firebaseService.firestore, this.collectionName),
        where('slug', '==', slug),
        limit(1)
      )),
      'Tempo esgotado ao carregar viagem do Firestore.'
    )).pipe(
      map(snapshot => snapshot.empty ? null : this.firebaseService.normalizeDates(snapshot.docs[0].data()) as Trip)
    );
  }

  /** Índice leve de todas as viagens, guardado como catálogo da última leitura. */
  private loadCatalog(): Observable<Trip[]> {
    return this.fetchTripIndex().pipe(
      tap(trips => {
        this.catalog = trips;
        this.catalogFresh = trips.length > 0;
      })
    );
  }

  /** Lê o índice leve (TRIP_INDEX_FIELDS) pela API REST. Erros sobem para quem chama. */
  private fetchTripIndex(max = 500): Observable<Trip[]> {
    return from(this.firebaseService.withTimeout(
      runSelectQuery(environment.firebase.projectId, this.collectionName, TRIP_INDEX_FIELDS, { limit: max }),
      'Tempo esgotado ao carregar viagens do Firestore.'
    )).pipe(
      map(rows => rows.map(([, data]) => data as unknown as Trip)),
      tap(trips => {
        if (trips.length > 0) {
          this.storage.setItem(this.localTripIndexKey, JSON.stringify(trips));
        }
      })
    );
  }

  /**
   * Para um endereço de viagem que não está publicada (roteiro antigo do
   * WordPress ou viagem encerrada/rascunho): devolve a viagem publicada
   * equivalente, se houver, ou null.
   *
   * "Equivalente" = mesmo slug sem o código numérico que o WordPress colocava
   * no fim. Ex.: "gramado-e-canela-2664" → "gramado-e-canela".
   *
   * Use depois de getTripBySlug(). Devolve undefined se o catálogo não pôde ser
   * lido agora (erro ou timeout), porque aí não dá para afirmar que a viagem
   * não existe.
   */
  findActiveReplacement(slug: string): Trip | null | undefined {
    if (!this.catalogFresh) return undefined;
    const target = legacyBaseSlug(slug);
    if (!target) return null;
    return this.catalog.find(trip =>
      trip.status !== 'inactive' &&
      trip.status !== 'draft' &&
      !!trip.slug &&
      trip.slug.toLowerCase() !== String(slug).toLowerCase() &&
      legacyBaseSlug(trip.slug) === target
    ) || null;
  }

  /** requireRemote impede confirmar anexos no site apenas com um cache local. */
  createTrip(trip: Partial<Trip>, requireRemote = false): Observable<Trip> {
    const id = Date.now();
    const now = new Date();
    const newTrip: Trip = {
      id,
      title: trip.title || '',
      slug: trip.slug || this.generateSlug(trip.title || ''),
      tripType: trip.tripType || 'regular',
      scope: trip.scope || inferTripScope(trip),
      tagId: trip.tagId ?? null,
      destination: trip.destination || '',
      country: trip.country || trip.destination || '',
      period: trip.period || '',
      description: trip.description || '',
      shortDescription: trip.shortDescription || '',
      categoryId: Number(trip.categoryId),
      mainImage: trip.mainImage || '',
      gallery: trip.gallery || [],
      startDate: trip.startDate || now,
      endDate: trip.endDate || now,
      duration: Number(trip.duration || 0),
      price: Number(trip.price || 0),
      priceTagline: trip.priceTagline || '',
      whatsappMessage: trip.whatsappMessage || '',
      foreignPrice: trip.foreignPrice,
      foreignCurrency: trip.foreignCurrency || '',
      foreignExchangeRate: trip.foreignExchangeRate,
      availableSpots: Number(trip.availableSpots || 0),
      showAvailableSpots: trip.showAvailableSpots !== false,
      spiritualGuide: trip.spiritualGuide || '',
      coordinator: trip.coordinator || '',
      operator: trip.operator || 'Unitur',
      experienceImages: trip.experienceImages || trip.gallery || [],
      hotels: trip.hotels || [],
      paymentMethods: trip.paymentMethods || [],
      cancellationPolicy: trip.cancellationPolicy || '',
      included: trip.included || [],
      notIncluded: trip.notIncluded || [],
      itinerary: trip.itinerary,
      itineraryPdfUrl: trip.itineraryPdfUrl || '',
      itineraryPdfName: trip.itineraryPdfName || '',
      status: trip.status || 'active',
      featured: Boolean(trip.featured),
      showOnHome: trip.showOnHome !== false,
      metaTitle: trip.metaTitle || '',
      metaDescription: trip.metaDescription || '',
      ogImage: trip.ogImage || '',
      createdAt: now,
      updatedAt: now
    };

    if (!requireRemote) this.upsertLocalTrip(newTrip);

    return from(this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newTrip)).then(() => newTrip),
      'Tempo esgotado ao salvar viagem no Firestore.'
    )).pipe(
      tap(() => { if (requireRemote) this.upsertLocalTrip(newTrip); }),
      catchError(err => {
        if (requireRemote) throw err;
        console.warn('Viagem salva localmente, mas nao foi possivel persistir no Firestore.', err);
        return of(newTrip);
      })
    );
  }

  updateTrip(id: number, trip: Partial<Trip>, requireRemote = false): Observable<Trip> {
    const updatedTrip = {
      ...trip,
      slug: trip.slug || (trip.title ? this.generateSlug(trip.title) : trip.slug),
      categoryId: trip.categoryId !== undefined ? Number(trip.categoryId) : trip.categoryId,
      updatedAt: new Date()
    };

    const localTrip = {
      ...(this.getLocalTrips().find(item => item.id === id)),
      id,
      ...updatedTrip
    } as Trip;

    if (!requireRemote) this.upsertLocalTrip(localTrip);

    return from(this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined({ id, ...updatedTrip }), { merge: true }).then(() => ({
        id,
        ...updatedTrip
      } as Trip)),
      'Tempo esgotado ao atualizar viagem no Firestore.'
    )).pipe(
      tap(() => { if (requireRemote) this.upsertLocalTrip(localTrip); }),
      catchError(err => {
        if (requireRemote) throw err;
        console.warn('Viagem atualizada localmente, mas nao foi possivel persistir no Firestore.', err);
        return of(localTrip);
      })
    );
  }

  deleteTrip(id: number): Observable<void> {
    this.removeLocalTrip(id);

    return from(this.firebaseService.withTimeout(
      deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))),
      'Tempo esgotado ao excluir viagem no Firestore.'
    )).pipe(
      catchError(err => {
        console.warn('Viagem removida localmente, mas nao foi possivel excluir no Firestore.', err);
        return of(undefined);
      })
    );
  }

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private matchesSlug(trip: Trip, slug: string): boolean {
    if (!slug) return false;
    if (trip.slug && trip.slug.toLowerCase() === slug) return true;
    if (this.generateSlug(trip.title || '') === slug) return true;
    if (String(trip.id) === slug) return true;
    return false;
  }

  private applyClientFilters(trips: Trip[], filters?: TripFilters): Trip[] {
    let filtered = [...trips];

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(trip =>
        trip.title.toLowerCase().includes(search) ||
        trip.destination.toLowerCase().includes(search)
      );
    }

    if (filters?.categoryId) {
      filtered = filtered.filter(trip => trip.categoryId === Number(filters.categoryId));
    }

    if (filters?.status) {
      filtered = filtered.filter(trip => (trip.status || 'active') === filters.status);
    }

    return filtered;
  }

  private sortTrips(trips: Trip[]): Trip[] {
    const now = Date.now();
    return this.dedupeTrips(trips).sort((a, b) => {
      const dateA = this.getTime(a.startDate) || this.getTime(a.createdAt);
      const dateB = this.getTime(b.startDate) || this.getTime(b.createdAt);
      // Upcoming trips first (closest to today), past trips after
      const aIsPast = dateA < now;
      const bIsPast = dateB < now;
      if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
      return aIsPast
        ? dateB - dateA   // both past: most recent first
        : dateA - dateB;  // both upcoming: soonest first
    });
  }

  private dedupeTrips(trips: Trip[]): Trip[] {
    return [...trips].reduce((result, trip) => {
      const existingIndex = result.findIndex(item => Number(item.id) === Number(trip.id));
      if (existingIndex >= 0) {
        result[existingIndex] = {
          ...result[existingIndex],
          ...trip
        };
        return result;
      }

      result.push(trip);
      return result;
    }, [] as Trip[]);
  }

  /**
   * Índice leve em cache, para a listagem aparecer na hora nas visitas seguintes.
   * Sem ele (1ª visita depois desta versão), usa o cache antigo de viagens completas.
   */
  private getLocalTripIndex(): Trip[] {
    const index = this.readLocalTrips(this.localTripIndexKey);
    return index.length > 0 ? index : this.getLocalTrips();
  }

  private getLocalTrips(): Trip[] {
    return this.readLocalTrips(this.localTripsKey);
  }

  private readLocalTrips(key: string): Trip[] {
    try {
      const rawTrips = JSON.parse(this.storage.getItem(key) || '[]') as Trip[];
      return rawTrips.map(trip => ({
        ...trip,
        startDate: trip.startDate ? new Date(trip.startDate) : new Date(),
        endDate: trip.endDate ? new Date(trip.endDate) : new Date(),
        createdAt: trip.createdAt ? new Date(trip.createdAt) : new Date(),
        updatedAt: trip.updatedAt ? new Date(trip.updatedAt) : new Date()
      }));
    } catch {
      return [];
    }
  }

  private upsertLocalTrip(trip: Trip) {
    const trips = this.getLocalTrips();
    const nextTrips = this.dedupeTrips([...trips, trip]);
    this.storage.setItem(this.localTripsKey, JSON.stringify(nextTrips));
  }

  private removeLocalTrip(id: number) {
    const nextTrips = this.getLocalTrips().filter(trip => Number(trip.id) !== Number(id));
    this.storage.setItem(this.localTripsKey, JSON.stringify(nextTrips));
  }

  private replaceLocalTrips(trips: Trip[]) {
    // Substitui o cache local pelo que veio do Firestore (source of truth).
    // Isso evita que viagens deletadas no Firestore voltem como zombies do cache.
    this.storage.setItem(this.localTripsKey, JSON.stringify(trips));
  }

  private getTime(date?: Date): number {
    if (!date) {
      return 0;
    }

    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  private cleanUndefined<T extends object>(data: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }
}

/**
 * Slug sem o código numérico do WordPress e sem hífens soltos no fim:
 * "peregrinacao-da-arquidiocese-de-porto-alegre-2625-11" →
 * "peregrinacao-da-arquidiocese-de-porto-alegre"; "minas-gerais-nos-passos-da-fe-" →
 * "minas-gerais-nos-passos-da-fe".
 */
export function legacyBaseSlug(slug: string | null | undefined): string {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/(?:-\d+)+-*$/, '')
    .replace(/-+$/, '');
}

/**
 * true quando o slug termina no código numérico que o WordPress antigo colocava
 * nos roteiros ("gramado-e-canela-2664", "...-2625-11"): sinal de endereço de
 * um roteiro antigo, e não de um endereço que nunca existiu.
 */
export function hasLegacyTripCode(slug: string | null | undefined): boolean {
  return /(?:-\d+)+-*$/.test(String(slug || '').trim());
}
