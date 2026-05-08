import { Injectable } from '@angular/core';
import { Observable, catchError, concat, from, map, of, tap } from 'rxjs';
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
  private readonly hiddenStaticTripsKey = 'unitur_hidden_static_trips';
  private readonly localTripsKey = 'unitur_admin_trips';
  private readonly staticTrips: Trip[] = [
    {
      id: 1001,
      title: 'Terra Santa',
      slug: 'terra-santa',
      tripType: 'peregrinacao',
      destination: 'Israel',
      country: 'Israel',
      period: 'Junho 2026',
      description: 'Uma jornada espiritual pelos lugares centrais da fe crista, com acompanhamento especializado, roteiro equilibrado e suporte em todos os deslocamentos.',
      shortDescription: 'Uma jornada espiritual pelos lugares centrais da fe crista.',
      categoryId: 0,
      mainImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1600&h=900&fit=crop',
      gallery: [],
      startDate: new Date('2026-06-01T00:00:00'),
      endDate: new Date('2026-06-12T00:00:00'),
      duration: 12,
      price: 25000,
      foreignPrice: 'U$4.500,00',
      availableSpots: 8,
      showAvailableSpots: true,
      spiritualGuide: 'Pe. Joao Batista',
      coordinator: 'Ana Silva',
      included: ['Hospedagem selecionada', 'Traslados do roteiro', 'Acompanhamento da Unitur', 'Seguro viagem', 'Cafe da manha'],
      notIncluded: ['Passaporte e vistos', 'Despesas pessoais', 'Refeicoes nao mencionadas', 'Passeios opcionais'],
      itinerary: 'Embarque e acolhida | Encontro do grupo, orientacoes iniciais e embarque internacional.\nGalileia e Nazare | Visitas aos principais locais biblicos da regiao norte.\nJerusalem e Belem | Roteiro pela Cidade Antiga, Via Dolorosa e Santo Sepulcro.\nEncerramento | Celebracao final, retorno e chegada ao Brasil.',
      status: 'active',
      featured: false,
      createdAt: new Date('2026-01-01T00:00:00'),
      updatedAt: new Date('2026-01-01T00:00:00')
    },
    {
      id: 1002,
      title: 'Caminho de Santiago',
      slug: 'caminho-de-santiago',
      tripType: 'peregrinacao',
      destination: 'Espanha',
      country: 'Espanha',
      period: 'Agosto 2026',
      description: 'Uma experiencia de caminhada, contemplacao e convivencia pelo tradicional Caminho de Santiago.',
      shortDescription: 'Caminhada, contemplacao e convivencia pelo tradicional Caminho de Santiago.',
      categoryId: 0,
      mainImage: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=1600&h=900&fit=crop',
      gallery: [],
      startDate: new Date('2026-08-01T00:00:00'),
      endDate: new Date('2026-08-15T00:00:00'),
      duration: 15,
      price: 19900,
      foreignPrice: 'U$3.580,00',
      availableSpots: 12,
      showAvailableSpots: true,
      spiritualGuide: 'Pe. Carlos Mendes',
      coordinator: 'Carlos Mendes',
      included: ['Hospedagens', 'Apoio logistico', 'Traslados previstos', 'Seguro viagem', 'Orientacao do grupo'],
      notIncluded: ['Equipamentos pessoais', 'Refeicoes extras', 'Despesas de documentacao'],
      itinerary: 'Chegada a Espanha | Recepcao e preparacao para o inicio da caminhada.\nEtapas do Caminho | Percursos diarios com apoio e hospedagens planejadas.\nSantiago e retorno | Chegada a Catedral, celebracao final e retorno.',
      status: 'active',
      featured: false,
      createdAt: new Date('2026-01-02T00:00:00'),
      updatedAt: new Date('2026-01-02T00:00:00')
    },
    {
      id: 1003,
      title: 'Fatima e Lourdes',
      slug: 'fatima-e-lourdes',
      tripType: 'peregrinacao',
      destination: 'Portugal e Franca',
      country: 'Portugal e Franca',
      period: 'Setembro 2026',
      description: 'Roteiro mariano combinando espiritualidade, cultura, historia e acompanhamento cuidadoso.',
      shortDescription: 'Roteiro mariano por dois grandes santuarios europeus.',
      categoryId: 0,
      mainImage: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1600&h=900&fit=crop',
      gallery: [],
      startDate: new Date('2026-09-01T00:00:00'),
      endDate: new Date('2026-09-10T00:00:00'),
      duration: 10,
      price: 22500,
      foreignPrice: 'U$4.050,00',
      availableSpots: 15,
      showAvailableSpots: true,
      spiritualGuide: 'Pe. Andre Lima',
      coordinator: 'Marina Costa',
      included: ['Hospedagem', 'Traslados', 'Seguro viagem', 'Acompanhamento', 'Cafe da manha'],
      notIncluded: ['Despesas pessoais', 'Refeicoes extras', 'Passeios opcionais'],
      itinerary: 'Lisboa e Fatima | Chegada, visitas culturais e programacao no Santuario de Fatima.\nFranca e Lourdes | Deslocamento para Lourdes e vivencias no santuario.\nRetorno | Encerramento do roteiro e retorno ao Brasil.',
      status: 'active',
      featured: false,
      createdAt: new Date('2026-01-03T00:00:00'),
      updatedAt: new Date('2026-01-03T00:00:00')
    },
    {
      id: 1004,
      title: 'Europa Classica',
      slug: 'europa-classica',
      tripType: 'regular',
      destination: 'Italia, Franca e Portugal',
      country: 'Italia, Franca e Portugal',
      period: 'Outubro 2026',
      description: 'Circuito para conhecer destinos iconicos da Europa com conforto, organizacao e tempo para viver cada cidade.',
      shortDescription: 'Circuito cultural por destinos iconicos da Europa.',
      categoryId: 0,
      mainImage: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1600&h=900&fit=crop',
      gallery: [],
      startDate: new Date('2026-10-01T00:00:00'),
      endDate: new Date('2026-10-14T00:00:00'),
      duration: 14,
      price: 29900,
      foreignPrice: 'U$5.380,00',
      availableSpots: 10,
      showAvailableSpots: true,
      spiritualGuide: 'Equipe Unitur',
      coordinator: 'Equipe Unitur',
      included: ['Hospedagem', 'Traslados do roteiro', 'Seguro viagem', 'Guias locais em passeios selecionados'],
      notIncluded: ['Ingressos opcionais', 'Refeicoes nao indicadas', 'Despesas pessoais'],
      itinerary: 'Paris e Londres | Visitas panoramicas, pontos historicos e experiencias culturais.\nRoma e Vaticano | Pracas, basilicas, ruinas e principais cartoes-postais.\nBarcelona | Arquitetura, gastronomia e tempo livre orientado.',
      status: 'active',
      featured: false,
      createdAt: new Date('2026-01-04T00:00:00'),
      updatedAt: new Date('2026-01-04T00:00:00')
    },
    {
      id: 1005,
      title: 'Nordeste Encantador',
      slug: 'nordeste-encantador',
      tripType: 'regular',
      destination: 'Brasil',
      country: 'Brasil',
      period: 'Julho 2026',
      description: 'Roteiro nacional para descansar e conhecer paisagens marcantes do Nordeste.',
      shortDescription: 'Roteiro nacional por paisagens marcantes do Nordeste.',
      categoryId: 0,
      mainImage: 'https://images.unsplash.com/photo-1516306580123-e6e52b1b7b5f?w=1600&h=900&fit=crop',
      gallery: [],
      startDate: new Date('2026-07-01T00:00:00'),
      endDate: new Date('2026-07-08T00:00:00'),
      duration: 8,
      price: 4290,
      availableSpots: 14,
      showAvailableSpots: true,
      spiritualGuide: 'Equipe Unitur',
      coordinator: 'Equipe Unitur',
      included: ['Hospedagem', 'Seguro viagem', 'Traslados previstos', 'Suporte Unitur'],
      notIncluded: ['Passeios opcionais', 'Taxas locais', 'Despesas pessoais'],
      itinerary: 'Chegada | Recepcao, check-in e primeiras experiencias.\nPasseios | Programacao com praias, cultura local e gastronomia.\nRetorno | Check-out e retorno.',
      status: 'active',
      featured: false,
      createdAt: new Date('2026-01-05T00:00:00'),
      updatedAt: new Date('2026-01-05T00:00:00')
    },
    {
      id: 1006,
      title: 'Patagonia Completa',
      slug: 'patagonia-completa',
      tripType: 'regular',
      destination: 'Argentina e Chile',
      country: 'Argentina e Chile',
      period: 'Novembro 2026',
      description: 'Roteiro para viver paisagens intensas e cidades cheias de historia no continente sul-americano.',
      shortDescription: 'Paisagens intensas e experiencias ao ar livre na Patagonia.',
      categoryId: 0,
      mainImage: 'https://images.unsplash.com/photo-1531804159968-24716780d214?w=1600&h=900&fit=crop',
      gallery: [],
      startDate: new Date('2026-11-01T00:00:00'),
      endDate: new Date('2026-11-11T00:00:00'),
      duration: 11,
      price: 31900,
      foreignPrice: 'U$5.740,00',
      availableSpots: 6,
      showAvailableSpots: true,
      spiritualGuide: 'Equipe Unitur',
      coordinator: 'Equipe Unitur',
      included: ['Hospedagem', 'Seguro viagem', 'Traslados previstos', 'Acompanhamento'],
      notIncluded: ['Ingressos opcionais', 'Refeicoes extras', 'Despesas pessoais'],
      itinerary: 'Buenos Aires | Historia, gastronomia e vida urbana.\nPatagonia | Natureza, montanhas e experiencias ao ar livre.\nRetorno | Encerramento da programacao.',
      status: 'active',
      featured: false,
      createdAt: new Date('2026-01-06T00:00:00'),
      updatedAt: new Date('2026-01-06T00:00:00')
    }
  ];

  constructor(private firebaseService: FirebaseService) {}

  getTrips(filters?: TripFilters): Observable<PaginatedResponse<Trip>> {
    const firestoreTrips$ = from(this.firebaseService.withTimeout(getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('createdAt', 'desc')
    )), 'Tempo esgotado ao carregar viagens do Firestore.')).pipe(
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
      map(trips => this.mergeWithAdminTrips(trips)),
      map(trips => this.applyFilters(trips, filters))
    );
  }

  getTrip(id: number): Observable<Trip> {
    return from(this.firebaseService.withTimeout(
      getDocs(collection(this.firebaseService.firestore, this.collectionName)),
      'Tempo esgotado ao carregar viagem do Firestore.'
    )).pipe(
      map(snapshot => {
        const trip = snapshot.docs
          .map(item => this.firebaseService.normalizeDates(item.data()) as Trip)
          .find(item => item.id === id) || this.getLocalTrips().find(item => item.id === id);

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
      tripType: trip.tripType || 'regular',
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
      foreignPrice: trip.foreignPrice,
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
      categoryId: trip.categoryId ? Number(trip.categoryId) : trip.categoryId,
      updatedAt: new Date()
    };

    const localTrip = {
      ...(this.getLocalTrips().find(item => item.id === id) || this.staticTrips.find(item => item.id === id)),
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

  private mergeWithAdminTrips(firestoreTrips: Trip[]): Trip[] {
    const localTrips = this.getLocalTrips();
    return this.dedupeTrips([...localTrips, ...firestoreTrips])
      .sort((a, b) => this.getTime(b.createdAt) - this.getTime(a.createdAt));
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
      const rawTrips = JSON.parse(localStorage.getItem(this.localTripsKey) || '[]') as Trip[];
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
    localStorage.setItem(this.localTripsKey, JSON.stringify(nextTrips));
  }

  private removeLocalTrip(id: number) {
    const nextTrips = this.getLocalTrips().filter(trip => Number(trip.id) !== Number(id));
    localStorage.setItem(this.localTripsKey, JSON.stringify(nextTrips));
  }

  private replaceLocalTrips(trips: Trip[]) {
    const localTrips = this.getLocalTrips();
    const nextTrips = this.dedupeTrips([...localTrips, ...trips]);
    localStorage.setItem(this.localTripsKey, JSON.stringify(nextTrips));
  }

  private getVisibleStaticTrips(): Trip[] {
    const hiddenIds = this.getHiddenStaticTripIds();
    return this.staticTrips.filter(trip => !hiddenIds.includes(trip.id));
  }

  private getHiddenStaticTripIds(): number[] {
    try {
      return JSON.parse(localStorage.getItem(this.hiddenStaticTripsKey) || '[]');
    } catch {
      return [];
    }
  }

  private hideStaticTrip(id: number) {
    const hiddenIds = new Set(this.getHiddenStaticTripIds());
    hiddenIds.add(id);
    localStorage.setItem(this.hiddenStaticTripsKey, JSON.stringify([...hiddenIds]));
  }

  private unhideStaticTrip(id: number) {
    const hiddenIds = this.getHiddenStaticTripIds().filter(item => item !== id);
    localStorage.setItem(this.hiddenStaticTripsKey, JSON.stringify(hiddenIds));
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
