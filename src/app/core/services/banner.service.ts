import { Injectable } from '@angular/core';
import { Observable, catchError, from, map, of, shareReplay } from 'rxjs';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore/lite';
import { Banner } from '../models/banner.model';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';

@Injectable({
  providedIn: 'root'
})
export class BannerService {
  private readonly collectionName = 'banners';
  private readonly cacheKey = 'unitur_banners_cache';
  private banners$: Observable<Banner[]> | null = null;

  constructor(
    private firebaseService: FirebaseService,
    private storage: BrowserStorageService
  ) {}

  getBanners(): Observable<Banner[]> {
    if (!this.banners$) {
      const cached = this.getLocalBanners();

      const firestore$ = from(this.firebaseService.withTimeout(getDocs(query(
        collection(this.firebaseService.firestore, this.collectionName),
        orderBy('order', 'asc')
      )), 'Tempo esgotado ao carregar banners do Firestore.')).pipe(
        map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Banner)),
        map(banners => {
          this.storage.setItem(this.cacheKey, JSON.stringify(banners));
          return banners;
        }),
        catchError(() => {
          this.banners$ = null;
          return of(cached);
        })
      );

      // Warm-start: emit cached value immediately, then Firestore result
      const source$ = cached.length > 0
        ? new Observable<Banner[]>(subscriber => {
            subscriber.next(cached);
            firestore$.subscribe({
              next: v => subscriber.next(v),
              error: e => subscriber.error(e),
              complete: () => subscriber.complete()
            });
          })
        : firestore$;

      this.banners$ = source$.pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }

    return this.banners$;
  }

  /** Banners visíveis no site público — somente ativos, ordenados por `order`. */
  getActiveBanners(): Observable<Banner[]> {
    return this.getBanners().pipe(
      map(banners => banners.filter(b => b.status === 'active'))
    );
  }

  getBanner(id: number): Observable<Banner> {
    return this.getBanners().pipe(
      map(banners => {
        const banner = banners.find(item => item.id === id);

        if (!banner) {
          throw new Error('Banner não encontrado');
        }

        return banner;
      })
    );
  }

  createBanner(banner: Partial<Banner>): Observable<Banner> {
    const id = Date.now();
    const now = new Date();
    const order = banner.order !== undefined && banner.order !== null
      ? Number(banner.order)
      : id;

    const newBanner: Banner = {
      id,
      imageUrl: banner.imageUrl || '',
      imageUrlMobile: banner.imageUrlMobile,
      link: banner.link,
      buttonText: banner.buttonText,
      order,
      status: banner.status || 'active',
      createdAt: now,
      updatedAt: now
    };

    return from(this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newBanner)).then(() => newBanner),
      'Tempo esgotado ao salvar banner no Firestore.'
    )).pipe(
      map(saved => {
        this.invalidateCache();
        return saved;
      })
    );
  }

  updateBanner(id: number, banner: Partial<Banner>): Observable<Banner> {
    const updatedBanner = {
      ...banner,
      order: banner.order !== undefined ? Number(banner.order) : banner.order,
      updatedAt: new Date()
    };

    return from(this.firebaseService.withTimeout(
      updateDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(updatedBanner)).then(() => ({
        id,
        ...updatedBanner
      } as Banner)),
      'Tempo esgotado ao atualizar banner no Firestore.'
    )).pipe(
      map(saved => {
        this.invalidateCache();
        return saved;
      })
    );
  }

  deleteBanner(id: number): Observable<void> {
    return from(this.firebaseService.withTimeout(
      deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))),
      'Tempo esgotado ao excluir banner no Firestore.'
    )).pipe(
      map(() => {
        this.invalidateCache();
      })
    );
  }

  reorderBanners(bannerIds: number[]): Observable<void> {
    return from(Promise.all(
      bannerIds.map((id, index) => updateDoc(
        doc(this.firebaseService.firestore, this.collectionName, String(id)),
        { order: index, updatedAt: new Date() }
      ))
    ).then(() => undefined)).pipe(
      map(() => {
        this.invalidateCache();
      })
    );
  }

  private invalidateCache(): void {
    this.banners$ = null;
    this.storage.removeItem(this.cacheKey);
  }

  private getLocalBanners(): Banner[] {
    try {
      const raw = this.storage.getItem(this.cacheKey);
      if (!raw) return [];
      return (JSON.parse(raw) as Banner[]).map(b => this.firebaseService.normalizeDates(b));
    } catch {
      return [];
    }
  }

  private cleanUndefined<T extends object>(data: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }
}
