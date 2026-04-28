import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { Trip } from '../models/trip.model';
import { FirebaseService } from './firebase.service';

export interface TripFilters {
  search?: string;
  categoryId?: number;
  status?: 'active' | 'inactive';
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
export class TripService {
  private readonly collectionName = 'trips';

  constructor(private firebaseService: FirebaseService) {}

  getTrips(filters?: TripFilters): Observable<PaginatedResponse<Trip>> {
    return from(getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('createdAt', 'desc')
    ))).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Trip)),
      map(trips => this.applyFilters(trips, filters))
    );
  }

  getTrip(id: number): Observable<Trip> {
    return from(getDocs(collection(this.firebaseService.firestore, this.collectionName))).pipe(
      map(snapshot => {
        const trip = snapshot.docs
          .map(item => this.firebaseService.normalizeDates(item.data()) as Trip)
          .find(item => item.id === id);

        if (!trip) {
          throw new Error('Viagem não encontrada');
        }

        return trip;
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
      destination: trip.destination || '',
      description: trip.description || '',
      shortDescription: trip.shortDescription || '',
      categoryId: Number(trip.categoryId),
      mainImage: trip.mainImage || '',
      gallery: trip.gallery || [],
      startDate: trip.startDate || now,
      endDate: trip.endDate || now,
      duration: Number(trip.duration || 0),
      price: Number(trip.price || 0),
      availableSpots: Number(trip.availableSpots || 0),
      included: trip.included || [],
      notIncluded: trip.notIncluded || [],
      itinerary: trip.itinerary,
      status: trip.status || 'active',
      featured: Boolean(trip.featured),
      createdAt: now,
      updatedAt: now
    };

    return from(setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newTrip)).then(() => newTrip));
  }

  updateTrip(id: number, trip: Partial<Trip>): Observable<Trip> {
    const updatedTrip = {
      ...trip,
      categoryId: trip.categoryId ? Number(trip.categoryId) : trip.categoryId,
      updatedAt: new Date()
    };

    return from(updateDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(updatedTrip)).then(() => ({
      id,
      ...updatedTrip
    } as Trip)));
  }

  deleteTrip(id: number): Observable<void> {
    return from(deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))));
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

  private applyFilters(trips: Trip[], filters?: TripFilters): PaginatedResponse<Trip> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    let filteredTrips = [...trips];

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filteredTrips = filteredTrips.filter(trip =>
        trip.title.toLowerCase().includes(search) ||
        trip.destination.toLowerCase().includes(search)
      );
    }

    if (filters?.categoryId) {
      filteredTrips = filteredTrips.filter(trip => trip.categoryId === Number(filters.categoryId));
    }

    if (filters?.status) {
      filteredTrips = filteredTrips.filter(trip => trip.status === filters.status);
    }

    const total = filteredTrips.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;

    return {
      data: filteredTrips.slice(start, start + limit),
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
