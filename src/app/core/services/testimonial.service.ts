import { Injectable } from '@angular/core';
import { Observable, catchError, concat, from, map, of, tap } from 'rxjs';
import { QueryDocumentSnapshot, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, startAfter } from 'firebase/firestore/lite';
import { Testimonial } from '../models/testimonial.model';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';

export interface TestimonialFilters {
  search?: string;
  status?: 'pending' | 'approved' | 'rejected';
  rating?: number;
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
export class TestimonialService {
  private readonly collectionName = 'testimonials';
  private readonly localTestimonialsKey = 'unitur_admin_testimonials';

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

  private hashFilters(f: TestimonialFilters): string {
    const { page: _p, ...rest } = f as Record<string, unknown>;
    return JSON.stringify(rest);
  }
  getTestimonials(filters?: TestimonialFilters): Observable<PaginatedResponse<Testimonial>> {
    if (filters?.adminPagination) {
      return this.getTestimonialsAdmin(filters);
    }

    // Chamadas públicas (home): full fetch com limit client-side.
    const pageSize = filters?.limit ?? 10;
    const firestoreTestimonials$ = from(this.firebaseService.withTimeout(getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    )), 'Tempo esgotado ao carregar depoimentos do Firestore.')).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Testimonial)),
      tap(testimonials => {
        if (testimonials.length > 0) {
          this.replaceLocalTestimonials(testimonials);
        }
      }),
      catchError(() => of([] as Testimonial[]))
    );

    return concat(
      of(this.getLocalTestimonials()),
      firestoreTestimonials$
    ).pipe(
      map(testimonials => this.dedupeTestimonials([...this.getLocalTestimonials(), ...testimonials])),
      map(testimonials => this.applyFilters(testimonials, filters))
    );
  }

  private getTestimonialsAdmin(filters: TestimonialFilters): Observable<PaginatedResponse<Testimonial>> {
    const pageSize = filters.limit ?? 10;
    const filterHash = this.hashFilters(filters);

    if (filterHash !== this.lastFilterHash) {
      this.adminCursor = null;
    }
    this.lastFilterHash = filterHash;

    const constraints: Parameters<typeof query>[1][] = [
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1)
    ];
    if (this.adminCursor) {
      constraints.push(startAfter(this.adminCursor));
    }

    const firestoreQuery = query(
      collection(this.firebaseService.firestore, this.collectionName),
      ...constraints
    );

    return from(this.firebaseService.withTimeout(
      getDocs(firestoreQuery),
      'Tempo esgotado ao carregar depoimentos do Firestore.'
    )).pipe(
      map(snapshot => {
        const docs = snapshot.docs;
        const hasNextPage = docs.length > pageSize;
        const pageDocs = hasNextPage ? docs.slice(0, pageSize) : docs;

        this.adminCursor = pageDocs.length > 0
          ? (pageDocs[pageDocs.length - 1] as QueryDocumentSnapshot)
          : null;

        const testimonials = pageDocs.map(d => this.firebaseService.normalizeDates(d.data()) as Testimonial);

        if (testimonials.length > 0) {
          const cached = this.getLocalTestimonials();
          const merged = this.dedupeTestimonials([...cached, ...testimonials]);
          this.storage.setItem(this.localTestimonialsKey, JSON.stringify(merged));
        }

        const filtered = this.applyClientFilters(testimonials, filters);
        return {
          data: filtered.slice(0, pageSize),
          total: filtered.length,
          page: filters.page ?? 1,
          limit: pageSize,
          totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
          hasNextPage
        } as PaginatedResponse<Testimonial>;
      }),
      catchError(() => {
        const local = this.applyClientFilters(this.getLocalTestimonials(), filters);
        return of({
          data: local.slice(0, pageSize),
          total: local.length,
          page: filters.page ?? 1,
          limit: pageSize,
          totalPages: Math.max(1, Math.ceil(local.length / pageSize)),
          hasNextPage: false
        } as PaginatedResponse<Testimonial>);
      })
    );
  }

  getTestimonial(id: number): Observable<Testimonial> {
    const ref = doc(this.firebaseService.firestore, this.collectionName, String(id));
    return from(this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar depoimento do Firestore.'
    )).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const testimonial = this.firebaseService.normalizeDates(snapshot.data()) as Testimonial;
          this.upsertLocalTestimonial(testimonial);
          return testimonial;
        }
        const local = this.getLocalTestimonials().find(t => Number(t.id) === Number(id));
        if (local) return local;
        throw new Error('Depoimento nao encontrado');
      }),
      catchError(() => {
        const local = this.getLocalTestimonials().find(t => Number(t.id) === Number(id));
        if (!local) throw new Error('Depoimento nao encontrado');
        return of(local);
      })
    );
  }

  createTestimonial(testimonial: Partial<Testimonial>): Observable<Testimonial> {
    const id = Date.now();
    const now = new Date();
    const newTestimonial: Testimonial = {
      id,
      clientName: testimonial.clientName || '',
      clientEmail: testimonial.clientEmail,
      clientPhoto: testimonial.clientPhoto,
      tripId: testimonial.tripId ? Number(testimonial.tripId) : undefined,
      text: testimonial.text || '',
      rating: Number(testimonial.rating || 5),
      tripDate: testimonial.tripDate,
      status: testimonial.status || 'approved',
      createdAt: now,
      updatedAt: now
    };

    this.upsertLocalTestimonial(newTestimonial);

    void this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newTestimonial)),
      'Tempo esgotado ao salvar depoimento no Firestore.'
    ).catch(err => console.warn('Depoimento salvo localmente, mas nao foi possivel persistir no Firestore.', err));

    return of(newTestimonial);
  }

  updateTestimonial(id: number, testimonial: Partial<Testimonial>): Observable<Testimonial> {
    const updatedTestimonial = {
      ...testimonial,
      tripId: testimonial.tripId ? Number(testimonial.tripId) : testimonial.tripId,
      rating: testimonial.rating ? Number(testimonial.rating) : testimonial.rating,
      updatedAt: new Date()
    };

    const localTestimonial = {
      ...(this.getLocalTestimonials().find(item => Number(item.id) === Number(id)) || {}),
      id,
      ...updatedTestimonial
    } as Testimonial;

    this.upsertLocalTestimonial(localTestimonial);

    void this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined({ id, ...updatedTestimonial }), { merge: true }),
      'Tempo esgotado ao atualizar depoimento no Firestore.'
    ).catch(err => console.warn('Depoimento atualizado localmente, mas nao foi possivel persistir no Firestore.', err));

    return of(localTestimonial);
  }

  approveTestimonial(id: number): Observable<Testimonial> {
    return this.updateTestimonial(id, { status: 'approved' });
  }

  rejectTestimonial(id: number): Observable<Testimonial> {
    return this.updateTestimonial(id, { status: 'rejected' });
  }

  deleteTestimonial(id: number): Observable<void> {
    this.removeLocalTestimonial(id);

    void this.firebaseService.withTimeout(
      deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))),
      'Tempo esgotado ao excluir depoimento no Firestore.'
    ).catch(err => console.warn('Depoimento removido localmente, mas nao foi possivel excluir no Firestore.', err));

    return of(undefined);
  }

  private applyFilters(testimonials: Testimonial[], filters?: TestimonialFilters): PaginatedResponse<Testimonial> {
    const page = filters?.page || 1;
    const lim = filters?.limit || 10;
    const filtered = this.applyClientFilters(testimonials, filters);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / lim));
    const start = (page - 1) * lim;
    const pageData = filtered.slice(start, start + lim);
    return {
      data: pageData,
      total,
      page,
      limit: lim,
      totalPages,
      hasNextPage: pageData.length === lim && start + lim < total
    };
  }

  private applyClientFilters(testimonials: Testimonial[], filters?: TestimonialFilters): Testimonial[] {
    let filtered = [...testimonials];

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.clientName.toLowerCase().includes(search) ||
        t.text.toLowerCase().includes(search)
      );
    }

    if (filters?.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    if (filters?.rating) {
      filtered = filtered.filter(t => t.rating === Number(filters.rating));
    }

    return filtered;
  }

  private cleanUndefined<T extends object>(data: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }

  private getLocalTestimonials(): Testimonial[] {
    try {
      const rawTestimonials = JSON.parse(this.storage.getItem(this.localTestimonialsKey) || '[]') as Testimonial[];
      return rawTestimonials.map(testimonial => ({
        ...testimonial,
        tripDate: testimonial.tripDate ? new Date(testimonial.tripDate) : undefined,
        createdAt: testimonial.createdAt ? new Date(testimonial.createdAt) : new Date(),
        updatedAt: testimonial.updatedAt ? new Date(testimonial.updatedAt) : new Date()
      }));
    } catch {
      return [];
    }
  }

  private upsertLocalTestimonial(testimonial: Testimonial) {
    const testimonials = this.getLocalTestimonials();
    const nextTestimonials = this.dedupeTestimonials([...testimonials, testimonial]);
    this.storage.setItem(this.localTestimonialsKey, JSON.stringify(nextTestimonials));
  }

  private replaceLocalTestimonials(testimonials: Testimonial[]) {
    const nextTestimonials = this.dedupeTestimonials([...this.getLocalTestimonials(), ...testimonials]);
    this.storage.setItem(this.localTestimonialsKey, JSON.stringify(nextTestimonials));
  }

  private removeLocalTestimonial(id: number) {
    const nextTestimonials = this.getLocalTestimonials().filter(testimonial => Number(testimonial.id) !== Number(id));
    this.storage.setItem(this.localTestimonialsKey, JSON.stringify(nextTestimonials));
  }

  private dedupeTestimonials(testimonials: Testimonial[]): Testimonial[] {
    return [...testimonials].reduce((result, testimonial) => {
      const existingIndex = result.findIndex(item => Number(item.id) === Number(testimonial.id));
      if (existingIndex >= 0) {
        result[existingIndex] = {
          ...result[existingIndex],
          ...testimonial
        };
        return result;
      }

      result.push(testimonial);
      return result;
    }, [] as Testimonial[]).sort((a, b) => this.getTime(b.createdAt) - this.getTime(a.createdAt));
  }

  private getTime(date?: Date): number {
    if (!date) {
      return 0;
    }

    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
}
