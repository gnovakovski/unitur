import { Injectable } from '@angular/core';
import { Observable, catchError, concat, from, map, of, tap } from 'rxjs';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { Testimonial } from '../models/testimonial.model';
import { FirebaseService } from './firebase.service';

export interface TestimonialFilters {
  search?: string;
  status?: 'pending' | 'approved' | 'rejected';
  rating?: number;
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
export class TestimonialService {
  private readonly collectionName = 'testimonials';
  private readonly localTestimonialsKey = 'unitur_admin_testimonials';

  constructor(private firebaseService: FirebaseService) {}

  getTestimonials(filters?: TestimonialFilters): Observable<PaginatedResponse<Testimonial>> {
    const firestoreTestimonials$ = from(this.firebaseService.withTimeout(getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('createdAt', 'desc')
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

  getTestimonial(id: number): Observable<Testimonial> {
    return from(this.firebaseService.withTimeout(
      getDocs(collection(this.firebaseService.firestore, this.collectionName)),
      'Tempo esgotado ao carregar depoimento do Firestore.'
    )).pipe(
      map(snapshot => {
        const testimonial = snapshot.docs
          .map(item => this.firebaseService.normalizeDates(item.data()) as Testimonial)
          .find(item => Number(item.id) === Number(id)) ||
          this.getLocalTestimonials().find(item => Number(item.id) === Number(id));

        if (!testimonial) {
          throw new Error('Depoimento nao encontrado');
        }

        return testimonial;
      }),
      catchError(() => {
        const localTestimonial = this.getLocalTestimonials().find(item => Number(item.id) === Number(id));
        if (!localTestimonial) {
          throw new Error('Depoimento nao encontrado');
        }

        return of(localTestimonial);
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
    const limit = filters?.limit || 10;
    let filteredTestimonials = [...testimonials];

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filteredTestimonials = filteredTestimonials.filter(testimonial =>
        testimonial.clientName.toLowerCase().includes(search) ||
        testimonial.text.toLowerCase().includes(search)
      );
    }

    if (filters?.status) {
      filteredTestimonials = filteredTestimonials.filter(testimonial => testimonial.status === filters.status);
    }

    if (filters?.rating) {
      filteredTestimonials = filteredTestimonials.filter(testimonial => testimonial.rating === Number(filters.rating));
    }

    const total = filteredTestimonials.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;

    return {
      data: filteredTestimonials.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages
    };
  }

  private cleanUndefined<T extends object>(data: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }

  private getLocalTestimonials(): Testimonial[] {
    try {
      const rawTestimonials = JSON.parse(localStorage.getItem(this.localTestimonialsKey) || '[]') as Testimonial[];
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
    localStorage.setItem(this.localTestimonialsKey, JSON.stringify(nextTestimonials));
  }

  private replaceLocalTestimonials(testimonials: Testimonial[]) {
    const nextTestimonials = this.dedupeTestimonials([...this.getLocalTestimonials(), ...testimonials]);
    localStorage.setItem(this.localTestimonialsKey, JSON.stringify(nextTestimonials));
  }

  private removeLocalTestimonial(id: number) {
    const nextTestimonials = this.getLocalTestimonials().filter(testimonial => Number(testimonial.id) !== Number(id));
    localStorage.setItem(this.localTestimonialsKey, JSON.stringify(nextTestimonials));
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
