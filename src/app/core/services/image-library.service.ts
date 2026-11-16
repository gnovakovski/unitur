import { Injectable } from '@angular/core';
import { Observable, catchError, defer, firstValueFrom, from, map, shareReplay, tap, throwError } from 'rxjs';
import { collection, getDocs } from 'firebase/firestore/lite';
import { environment } from '../../../environments/environment';
import { runSelectQuery } from '../utils/firestore-rest';
import { FirebaseService } from './firebase.service';

/** Onde a foto foi usada: galeria da viagem, foto de hotel ou imagem principal (capa). */
export type LibraryImageKind = 'gallery' | 'hotel' | 'cover';

/** Uma foto do banco de imagens. */
export interface LibraryImage {
  /** Endereço da foto no Storage — é ele que a viagem guarda; nada é copiado. */
  url: string;
  /** Usos em que a foto já apareceu (uma mesma foto pode ser galeria numa viagem e capa em outra). */
  kinds: LibraryImageKind[];
  /** Nome do hotel, quando a foto foi cadastrada como hotel ('' nos demais casos). */
  hotelName: string;
  /** Viagens que usam a foto, da mais recente para a mais antiga. */
  trips: string[];
  /** Texto para a busca: viagens, países e hotel, em minúsculas e sem acentos. */
  searchText: string;
}

/** Campos de uma viagem que o banco de imagens lê. */
export interface LibraryTripSource {
  id?: number | string;
  title?: string;
  country?: string;
  destination?: string;
  mainImage?: string;
  experienceImages?: unknown;
  gallery?: unknown;
  hotels?: unknown;
  updatedAt?: Date | string | null;
}

const TRIP_FIELDS = [
  'id', 'title', 'country', 'destination', 'mainImage', 'experienceImages', 'gallery', 'hotels', 'updatedAt'
] as const;

/** Por quanto tempo a lista montada vale antes de reler as viagens. */
const CACHE_MS = 60_000;

/**
 * Banco de imagens do painel.
 *
 * Não é um cadastro à parte: é a lista de todas as fotos que já foram enviadas
 * em alguma viagem (galeria, hotéis e imagem principal), sem repetição. Assim
 * toda foto enviada entra no banco sozinha, e as viagens que já existiam
 * formam o acervo inicial sem ninguém precisar reenviar nada.
 *
 * Escolher uma foto do banco só grava o endereço dela na outra viagem — o
 * arquivo no Storage é o mesmo. Remover a foto de uma viagem não apaga o
 * arquivo (o painel nunca apaga arquivos do Storage), então as demais viagens
 * continuam mostrando a foto normalmente.
 */
@Injectable({ providedIn: 'root' })
export class ImageLibraryService {
  private images$?: Observable<LibraryImage[]>;
  private loadedAt = 0;

  constructor(private firebaseService: FirebaseService) {}

  /** Fotos do banco. Relê as viagens se a última leitura tem mais de um minuto. */
  getImages(forceReload = false): Observable<LibraryImage[]> {
    const fresh = Date.now() - this.loadedAt < CACHE_MS;
    if (this.images$ && fresh && !forceReload) {
      return this.images$;
    }

    this.loadedAt = Date.now();
    this.images$ = this.loadTrips().pipe(
      map(trips => buildImageLibrary(trips)),
      catchError(error => {
        // Não guarda a falha: a próxima abertura tenta de novo.
        this.images$ = undefined;
        this.loadedAt = 0;
        return throwError(() => error);
      }),
      shareReplay(1)
    );

    return this.images$;
  }

  /**
   * Lê de todas as viagens só os campos de imagem (bem mais leve que os
   * documentos inteiros, com roteiro e textos). Se essa leitura falhar, cai na
   * leitura completa pelo SDK, que vai autenticada com o login do painel.
   */
  private loadTrips(): Observable<LibraryTripSource[]> {
    const light$ = defer(() => from(
      runSelectQuery(environment.firebase.projectId, 'trips', TRIP_FIELDS, { limit: 1000 })
    )).pipe(map(rows => rows.map(([, data]) => data as LibraryTripSource)));

    const full$ = defer(() => from(getDocs(collection(this.firebaseService.firestore, 'trips')))).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as LibraryTripSource))
    );

    return defer(() => from(this.firebaseService.withTimeout(
      firstValueFrom(light$.pipe(catchError(() => full$))),
      'Tempo esgotado ao carregar o banco de imagens.',
      20000
    ))).pipe(tap({ error: err => console.warn('Não foi possível carregar o banco de imagens.', err) }));
  }
}

/** Minúsculas e sem acentos, para a busca casar "sao paulo" com "São Paulo". */
export function normalizeLibrarySearch(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function time(value: LibraryTripSource['updatedAt']): number {
  if (!value) return 0;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Monta o banco a partir das viagens: cada foto aparece uma vez, com as viagens
 * que a usam. As fotos das viagens mexidas mais recentemente vêm primeiro.
 */
export function buildImageLibrary(trips: LibraryTripSource[]): LibraryImage[] {
  interface Entry {
    url: string;
    kinds: Set<LibraryImageKind>;
    hotelName: string;
    trips: string[];
    places: Set<string>;
  }

  const byUrl = new Map<string, Entry>();

  const add = (rawUrl: unknown, kind: LibraryImageKind, trip: LibraryTripSource, hotelName = '') => {
    if (!isImageUrl(rawUrl)) return;
    const url = rawUrl.trim();
    let entry = byUrl.get(url);
    if (!entry) {
      entry = { url, kinds: new Set(), hotelName: '', trips: [], places: new Set() };
      byUrl.set(url, entry);
    }
    entry.kinds.add(kind);
    if (!entry.hotelName && hotelName.trim()) entry.hotelName = hotelName.trim();

    const title = String(trip.title || '').trim();
    if (title && !entry.trips.includes(title)) entry.trips.push(title);
    const place = String(trip.country || trip.destination || '').trim();
    if (place) entry.places.add(place);
  };

  const ordered = [...(trips || [])].sort((a, b) => time(b.updatedAt) - time(a.updatedAt));

  for (const trip of ordered) {
    // Mesma regra da página da viagem: `experienceImages`, ou `gallery` nas antigas.
    const experience = Array.isArray(trip.experienceImages) && trip.experienceImages.length
      ? trip.experienceImages
      : Array.isArray(trip.gallery) ? trip.gallery : [];
    for (const image of experience) add(image, 'gallery', trip);

    add(trip.mainImage, 'cover', trip);

    for (const hotel of Array.isArray(trip.hotels) ? trip.hotels : []) {
      const item = (hotel || {}) as { name?: unknown; image?: unknown };
      add(item.image, 'hotel', trip, typeof item.name === 'string' ? item.name : '');
    }
  }

  return [...byUrl.values()].map(entry => ({
    url: entry.url,
    kinds: [...entry.kinds],
    hotelName: entry.hotelName,
    trips: entry.trips,
    searchText: normalizeLibrarySearch([entry.hotelName, ...entry.trips, ...entry.places].join(' '))
  }));
}
