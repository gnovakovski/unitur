import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import {
  DEFAULT_CONTACT_CONTENT,
  DEFAULT_HEADER_CONTENT,
  HeaderLink,
  SiteContactContent,
  SiteHeaderContent
} from '../models/site-content.model';

@Injectable({
  providedIn: 'root'
})
export class SiteContentService {
  private readonly collectionName = 'siteContent';
  private readonly headerDocId = 'header';
  private readonly contactDocId = 'contact';
  private readonly headerLocalKey = 'unitur_header_content';
  private readonly contactLocalKey = 'unitur_contact_content';

  private headerSubject = new BehaviorSubject<SiteHeaderContent>(this.getLocalHeader());
  header$ = this.headerSubject.asObservable();

  private contactSubject = new BehaviorSubject<SiteContactContent>(this.getLocalContact());
  contact$ = this.contactSubject.asObservable();

  private headerLoad$?: Observable<SiteHeaderContent>;
  private contactLoad$?: Observable<SiteContactContent>;

  constructor(private firebaseService: FirebaseService) {}

  loadHeader(): Observable<SiteHeaderContent> {
    if (this.headerLoad$) return this.headerLoad$;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.headerDocId);
    this.headerLoad$ = from(this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar cabeçalho.'
    )).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const data = this.firebaseService.normalizeDates(snapshot.data()) as SiteHeaderContent;
          const merged = this.normalizeHeader(data);
          this.persistLocalHeader(merged);
          this.headerSubject.next(merged);
          return merged;
        }
        const fallback = this.getLocalHeader();
        this.headerSubject.next(fallback);
        return fallback;
      }),
      catchError(() => {
        const fallback = this.getLocalHeader();
        this.headerSubject.next(fallback);
        return of(fallback);
      }),
      shareReplay(1)
    );

    return this.headerLoad$;
  }

  saveHeader(content: SiteHeaderContent): Observable<SiteHeaderContent> {
    const payload: SiteHeaderContent = {
      ...content,
      links: this.normalizeLinks(content.links),
      updatedAt: new Date()
    };

    this.persistLocalHeader(payload);
    this.headerSubject.next(payload);
    this.headerLoad$ = undefined;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.headerDocId);
    return from(this.firebaseService.withTimeout(
      setDoc(ref, payload).then(() => payload),
      'Tempo esgotado ao salvar cabeçalho.'
    )).pipe(
      catchError(() => of(payload))
    );
  }

  loadContact(): Observable<SiteContactContent> {
    if (this.contactLoad$) return this.contactLoad$;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.contactDocId);
    this.contactLoad$ = from(this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar dados de contato.'
    )).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const data = this.firebaseService.normalizeDates(snapshot.data()) as SiteContactContent;
          const merged = { ...DEFAULT_CONTACT_CONTENT, ...data };
          this.persistLocalContact(merged);
          this.contactSubject.next(merged);
          return merged;
        }
        const fallback = this.getLocalContact();
        this.contactSubject.next(fallback);
        return fallback;
      }),
      catchError(() => {
        const fallback = this.getLocalContact();
        this.contactSubject.next(fallback);
        return of(fallback);
      }),
      shareReplay(1)
    );

    return this.contactLoad$;
  }

  saveContact(content: SiteContactContent): Observable<SiteContactContent> {
    const payload: SiteContactContent = {
      ...DEFAULT_CONTACT_CONTENT,
      ...content,
      updatedAt: new Date()
    };

    this.persistLocalContact(payload);
    this.contactSubject.next(payload);
    this.contactLoad$ = undefined;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.contactDocId);
    return from(this.firebaseService.withTimeout(
      setDoc(ref, payload).then(() => payload),
      'Tempo esgotado ao salvar dados de contato.'
    )).pipe(
      catchError(() => of(payload))
    );
  }

  /** Cria os documentos com os defaults caso ainda não existam. Idempotente. */
  async migrateDefaultsIfMissing(): Promise<void> {
    const headerRef = doc(this.firebaseService.firestore, this.collectionName, this.headerDocId);
    const contactRef = doc(this.firebaseService.firestore, this.collectionName, this.contactDocId);

    try {
      const [headerSnap, contactSnap] = await Promise.all([
        getDoc(headerRef),
        getDoc(contactRef)
      ]);

      if (!headerSnap.exists()) {
        await setDoc(headerRef, { ...DEFAULT_HEADER_CONTENT, updatedAt: new Date() });
      }

      if (!contactSnap.exists()) {
        await setDoc(contactRef, { ...DEFAULT_CONTACT_CONTENT, updatedAt: new Date() });
      }
    } catch {
      // Falha silenciosa — usuário continua com fallback local
    }
  }

  getVisibleHeaderLinks(): HeaderLink[] {
    return this.normalizeLinks(this.headerSubject.value.links).filter(link => link.visible);
  }

  getCurrentHeaderLinks(): HeaderLink[] {
    return this.normalizeLinks(this.headerSubject.value.links);
  }

  private normalizeHeader(value: Partial<SiteHeaderContent>): SiteHeaderContent {
    const links = this.normalizeLinks(value.links || DEFAULT_HEADER_CONTENT.links);
    return { links, updatedAt: value.updatedAt };
  }

  private normalizeLinks(links: HeaderLink[]): HeaderLink[] {
    const validIds = new Set(DEFAULT_HEADER_CONTENT.links.map(l => l.id));
    const byId = new Map<string, HeaderLink>();

    for (const link of links) {
      if (!validIds.has(link.id)) continue;
      const def = DEFAULT_HEADER_CONTENT.links.find(l => l.id === link.id)!;
      byId.set(link.id, {
        id: link.id,
        label: link.label || def.label,
        route: def.route,
        order: typeof link.order === 'number' ? link.order : def.order,
        visible: link.visible !== false
      });
    }

    for (const def of DEFAULT_HEADER_CONTENT.links) {
      if (!byId.has(def.id)) byId.set(def.id, { ...def });
    }

    return [...byId.values()].sort((a, b) => a.order - b.order);
  }

  private getLocalHeader(): SiteHeaderContent {
    try {
      const raw = localStorage.getItem(this.headerLocalKey);
      if (!raw) return DEFAULT_HEADER_CONTENT;
      return this.normalizeHeader(JSON.parse(raw));
    } catch {
      return DEFAULT_HEADER_CONTENT;
    }
  }

  private persistLocalHeader(value: SiteHeaderContent): void {
    try { localStorage.setItem(this.headerLocalKey, JSON.stringify(value)); } catch {}
  }

  private getLocalContact(): SiteContactContent {
    try {
      const raw = localStorage.getItem(this.contactLocalKey);
      if (!raw) return DEFAULT_CONTACT_CONTENT;
      return { ...DEFAULT_CONTACT_CONTENT, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_CONTACT_CONTENT;
    }
  }

  private persistLocalContact(value: SiteContactContent): void {
    try { localStorage.setItem(this.contactLocalKey, JSON.stringify(value)); } catch {}
  }
}
