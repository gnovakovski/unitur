import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { Banner } from '../models/banner.model';
import { FirebaseService } from './firebase.service';

@Injectable({
  providedIn: 'root'
})
export class BannerService {
  private readonly collectionName = 'banners';

  constructor(private firebaseService: FirebaseService) {}

  getBanners(): Observable<Banner[]> {
    return from(getDocs(query(
      collection(this.firebaseService.firestore, this.collectionName),
      orderBy('order', 'asc')
    ))).pipe(
      map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as Banner))
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
    const newBanner: Banner = {
      id,
      title: banner.title || '',
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl || '',
      link: banner.link,
      buttonText: banner.buttonText,
      order: Number(banner.order || 0),
      status: banner.status || 'active',
      createdAt: now,
      updatedAt: now
    };

    return from(setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newBanner)).then(() => newBanner));
  }

  updateBanner(id: number, banner: Partial<Banner>): Observable<Banner> {
    const updatedBanner = {
      ...banner,
      order: banner.order !== undefined ? Number(banner.order) : banner.order,
      updatedAt: new Date()
    };

    return from(updateDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(updatedBanner)).then(() => ({
      id,
      ...updatedBanner
    } as Banner)));
  }

  deleteBanner(id: number): Observable<void> {
    return from(deleteDoc(doc(this.firebaseService.firestore, this.collectionName, String(id))));
  }

  reorderBanners(bannerIds: number[]): Observable<void> {
    return from(Promise.all(
      bannerIds.map((id, index) => updateDoc(
        doc(this.firebaseService.firestore, this.collectionName, String(id)),
        { order: index, updatedAt: new Date() }
      ))
    ).then(() => undefined));
  }

  private cleanUndefined<T extends object>(data: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }
}
