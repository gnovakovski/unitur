import { Injectable } from '@angular/core';
import { Observable, catchError, from, map, of, shareReplay } from 'rxjs';
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore/lite';
import { DEFAULT_TAG_COLOR, TripTag } from '../models/tag.model';
import { FirebaseService } from './firebase.service';

@Injectable({
  providedIn: 'root'
})
export class TagService {
  private readonly collectionName = 'tags';
  /**
   * As tags são poucas e lidas por várias telas públicas (home, listagem e
   * detalhe), então o resultado é compartilhado para não repetir a leitura no
   * Firestore a cada navegação. `getAllTags(true)` refaz o get.
   */
  private tags$?: Observable<TripTag[]>;

  constructor(private firebaseService: FirebaseService) {}

  getAllTags(forceReload = false): Observable<TripTag[]> {
    if (forceReload || !this.tags$) {
      this.tags$ = from(this.firebaseService.withTimeout(getDocs(query(
        collection(this.firebaseService.firestore, this.collectionName),
        orderBy('label', 'asc')
      )), 'Tempo esgotado ao carregar as tags do Firestore.')).pipe(
        map(snapshot => snapshot.docs.map(item => this.firebaseService.normalizeDates(item.data()) as TripTag)),
        catchError(err => {
          console.warn('Nao foi possivel carregar as tags do Firestore.', err);
          // Limpa o cache para a próxima chamada tentar de novo.
          this.tags$ = undefined;
          return of([] as TripTag[]);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }

    return this.tags$;
  }

  createTag(tag: Partial<TripTag>): Observable<TripTag> {
    const id = Date.now();
    const now = new Date();
    const newTag: TripTag = {
      id,
      label: (tag.label || '').trim(),
      color: tag.color || DEFAULT_TAG_COLOR,
      createdAt: now,
      updatedAt: now
    };

    return from(this.firebaseService.withTimeout(
      setDoc(doc(this.firebaseService.firestore, this.collectionName, String(id)), this.cleanUndefined(newTag)).then(() => newTag),
      'Tempo esgotado ao salvar a tag no Firestore.'
    )).pipe(
      map(saved => {
        this.tags$ = undefined;
        return saved;
      })
    );
  }

  private cleanUndefined<T extends object>(data: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }
}
