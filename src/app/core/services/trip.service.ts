import { Injectable } from '@angular/core';
import { Observable, catchError, concat, from, map, of, tap } from 'rxjs';
import { QueryDocumentSnapshot, collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, startAfter } from 'firebase/firestore';
import { Trip } from '../models/trip.model';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';
import { inferTripScope } from '../utils/trip-scope';

export interface TripFilters {
  search?: string;
  categoryId?: number;
  status?: 'active' | 'inactive' | 'draft';
  page?: number;
  limit?: number;
  /** Quando true, aplica paginação server-side com limit() + startAfter(). */
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
export class TripService {
  private readonly collectionName = 'trips';
  private readonly localTripsKey = 'unitur_admin_trips';

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

    const firestoreTrips$ = from(this.firebaseService.withTimeout(getDocs(
      query(collection(this.firebaseService.firestore, this.collectionName), ...constraints)
    ), 'Tempo esgotado ao carregar viagens do Firestore.')).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Trip)),
      tap(trips => {
        if (trips.length > 0) {
          this.replaceLocalTrips(trips);
        }
      }),
      catchError(() => of([] as Trip[]))
    );

    return concat(
      of(this.getLocalTrips()),
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

  getTripBySlug(slug: string): Observable<Trip | null> {
    const normalized = String(slug || '').trim().toLowerCase();

    if (!normalized) {
      return of(null);
    }

    // Tenta primeiro o cache local (rápido) — se achar, retorna.
    // Em paralelo, busca no Firestore e atualiza o cache.
    return from(this.firebaseService.withTimeout(
      getDocs(collection(this.firebaseService.firestore, this.collectionName)),
      'Tempo esgotado ao carregar viagem do Firestore.'
    )).pipe(
      map(snapshot => {
        const trips = snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Trip);
        if (trips.length > 0) {
          this.replaceLocalTrips(trips);
        }
        const candidates = this.dedupeTrips([...trips, ...this.getLocalTrips()]);
        return candidates.find(item => this.matchesSlug(item, normalized)) || null;
      }),
      catchError(() => {
        const trip = this.getLocalTrips().find(item => this.matchesSlug(item, normalized));
        return of(trip || null);
      })
    );
  }

  createTrip(trip: Partial<Trip>): Observable<Trip> {
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
      status: trip.status || 'active',
      featured: Boolean(trip.featured),
      showOnHome: trip.showOnHome !== false,
      metaTitle: trip.metaTitle || '',
      metaDescription: trip.metaDescription || '',
      ogImage: trip.ogImage || '',
      createdAt: now,
      updatedAt: now
    };

    this.upsertLocalTrip(newTrip);

    return from(this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newTrip)).then(() => newTrip),
      'Tempo esgotado ao salvar viagem no Firestore.'
    )).pipe(
      catchError(err => {
        console.warn('Viagem salva localmente, mas nao foi possivel persistir no Firestore.', err);
        return of(newTrip);
      })
    );
  }

  updateTrip(id: number, trip: Partial<Trip>): Observable<Trip> {
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

    this.upsertLocalTrip(localTrip);

    return from(this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined({ id, ...updatedTrip }), { merge: true }).then(() => ({
        id,
        ...updatedTrip
      } as Trip)),
      'Tempo esgotado ao atualizar viagem no Firestore.'
    )).pipe(
      catchError(err => {
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
    return this.dedupeTrips(trips).sort((a, b) => this.getTime(b.createdAt) - this.getTime(a.createdAt));
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

  private getLocalTrips(): Trip[] {
    try {
      const rawTrips = JSON.parse(this.storage.getItem(this.localTripsKey) || '[]') as Trip[];
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
