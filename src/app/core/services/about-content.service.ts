import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';
import {
  DEFAULT_ABOUT_CONTENT,
  SiteAboutContent
} from '../models/about-content.model';

@Injectable({
  providedIn: 'root'
})
export class AboutContentService {
  private readonly collectionName = 'siteContent';
  private readonly docId = 'about';
  private readonly localKey = 'unitur_about_content';

  // Declarado antes do subject: getLocal() roda no inicializador.
  private readonly storage = inject(BrowserStorageService);

  private contentSubject = new BehaviorSubject<SiteAboutContent>(this.getLocal());
  content$ = this.contentSubject.asObservable();

  // Cache do observable de leitura — evita múltiplos getDoc para o mesmo doc.
  private load$: Observable<SiteAboutContent> | null = null;

  constructor(private firebaseService: FirebaseService) {}

  load(): Observable<SiteAboutContent> {
    if (this.load$) return this.load$;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.docId);

    this.load$ = from(this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar conteúdo institucional.'
    )).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const data = this.firebaseService.normalizeDates(snapshot.data()) as SiteAboutContent;
          const merged = this.mergeWithDefaults(data);
          this.persistLocal(merged);
          this.contentSubject.next(merged);
          return merged;
        }
        const fallback = this.getLocal();
        this.contentSubject.next(fallback);
        return fallback;
      }),
      catchError(() => {
        this.load$ = null;
        const fallback = this.getLocal();
        this.contentSubject.next(fallback);
        return of(fallback);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.load$;
  }

  save(content: SiteAboutContent): Observable<SiteAboutContent> {
    const payload: SiteAboutContent = {
      ...content,
      updatedAt: new Date()
    };

    this.persistLocal(payload);
    this.contentSubject.next(payload);
    // Invalida o cache para que o próximo load() busque dados atualizados.
    this.load$ = null;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.docId);

    return from(this.firebaseService.withTimeout(
      setDoc(ref, payload).then(() => payload),
      'Tempo esgotado ao salvar conteúdo institucional.'
    )).pipe(
      tap(saved => {
        this.persistLocal(saved);
        this.contentSubject.next(saved);
      }),
      catchError(() => of(payload))
    );
  }

  private getLocal(): SiteAboutContent {
    try {
      const raw = this.storage.getItem(this.localKey);
      if (!raw) return DEFAULT_ABOUT_CONTENT;
      const parsed = JSON.parse(raw) as SiteAboutContent;
      return this.mergeWithDefaults(parsed);
    } catch {
      return DEFAULT_ABOUT_CONTENT;
    }
  }

  private persistLocal(value: SiteAboutContent): void {
    this.storage.setItem(this.localKey, JSON.stringify(value));
  }

  private mergeWithDefaults(value: Partial<SiteAboutContent>): SiteAboutContent {
    return {
      home: {
        ...DEFAULT_ABOUT_CONTENT.home,
        ...(value.home || {}),
        paragraphs: value.home?.paragraphs?.length
          ? value.home.paragraphs
          : DEFAULT_ABOUT_CONTENT.home.paragraphs,
        stats: value.home?.stats?.length
          ? value.home.stats
          : DEFAULT_ABOUT_CONTENT.home.stats
      },
      about: {
        ...DEFAULT_ABOUT_CONTENT.about,
        ...(value.about || {}),
        missionCards: value.about?.missionCards?.length
          ? value.about.missionCards
          : DEFAULT_ABOUT_CONTENT.about.missionCards,
        stats: value.about?.stats?.length
          ? value.about.stats
          : DEFAULT_ABOUT_CONTENT.about.stats,
        storyParagraphs: value.about?.storyParagraphs?.length
          ? value.about.storyParagraphs
          : DEFAULT_ABOUT_CONTENT.about.storyParagraphs,
        timeline: value.about?.timeline?.length
          ? value.about.timeline
          : DEFAULT_ABOUT_CONTENT.about.timeline,
        values: value.about?.values?.length
          ? value.about.values
          : DEFAULT_ABOUT_CONTENT.about.values
      },
      updatedAt: value.updatedAt
    };
  }
}
