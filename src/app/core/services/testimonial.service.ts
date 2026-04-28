import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
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

  constructor(private firebaseService: FirebaseService) {}

  getTestimonials(filters?: TestimonialFilters): Observable<PaginatedResponse<Testimonial>> {
    return from(getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('createdAt', 'desc')
    ))).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Testimonial)),
      map(testimonials => this.applyFilters(testimonials, filters))
    );
  }

  getTestimonial(id: number): Observable<Testimonial> {
    return from(getDocs(collection(this.firebaseService.firestore, this.collectionName))).pipe(
      map(snapshot => {
        const testimonial = snapshot.docs
          .map(item => this.firebaseService.normalizeDates(item.data()) as Testimonial)
          .find(item => item.id === id);

        if (!testimonial) {
          throw new Error('Depoimento não encontrado');
        }

        return testimonial;
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
      status: testimonial.status || 'pending',
      createdAt: now,
      updatedAt: now
    };

    return from(setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newTestimonial)).then(() => newTestimonial));
  }

  updateTestimonial(id: number, testimonial: Partial<Testimonial>): Observable<Testimonial> {
    const updatedTestimonial = {
      ...testimonial,
      tripId: testimonial.tripId ? Number(testimonial.tripId) : testimonial.tripId,
      rating: testimonial.rating ? Number(testimonial.rating) : testimonial.rating,
      updatedAt: new Date()
    };

    return from(updateDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(updatedTestimonial)).then(() => ({
      id,
      ...updatedTestimonial
    } as Testimonial)));
  }

  approveTestimonial(id: number): Observable<Testimonial> {
    return this.updateTestimonial(id, { status: 'approved' });
  }

  rejectTestimonial(id: number): Observable<Testimonial> {
    return this.updateTestimonial(id, { status: 'rejected' });
  }

  deleteTestimonial(id: number): Observable<void> {
    return from(deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))));
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
}
