import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import {
  DEFAULT_CONTACT_CONTENT,
  DEFAULT_FOOTER_CONTENT,
  DEFAULT_HEADER_CONTENT,
  DEFAULT_HOME_CONTENT,
  HeaderLink,
  SiteContactContent,
  SiteFooterContent,
  SiteHeaderContent,
  SiteHomeContent
} from '../models/site-content.model';

@Injectable({
  providedIn: 'root'
})
export class SiteContentService {
  private readonly collectionName = 'siteContent';
  private readonly headerDocId = 'header';
  private readonly contactDocId = 'contact';
  private readonly homeDocId = 'home';
  private readonly footerDocId = 'footer';
  private readonly headerLocalKey = 'unitur_header_content';
  private readonly contactLocalKey = 'unitur_contact_content';
  private readonly homeLocalKey = 'unitur_home_content';
  private readonly footerLocalKey = 'unitur_footer_content';

  private headerSubject = new BehaviorSubject<SiteHeaderContent>(this.getLocalHeader());
  header$ = this.headerSubject.asObservable();

  private contactSubject = new BehaviorSubject<SiteContactContent>(this.getLocalContact());
  contact$ = this.contactSubject.asObservable();

  private homeSubject = new BehaviorSubject<SiteHomeContent>(this.getLocalHome());
  home$ = this.homeSubject.asObservable();

  private footerSubject = new BehaviorSubject<SiteFooterContent>(this.getLocalFooter());
  footer$ = this.footerSubject.asObservable();

  private headerLoad$?: Observable<SiteHeaderContent>;
  private contactLoad$?: Observable<SiteContactContent>;
  private homeLoad$?: Observable<SiteHomeContent>;
  private footerLoad$?: Observable<SiteFooterContent>;

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

  loadHome(): Observable<SiteHomeContent> {
    if (this.homeLoad$) return this.homeLoad$;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.homeDocId);
    this.homeLoad$ = from(this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar conteúdo da home.'
    )).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const data = this.firebaseService.normalizeDates(snapshot.data()) as SiteHomeContent;
          const merged = { ...DEFAULT_HOME_CONTENT, ...data };
          this.persistLocalHome(merged);
          this.homeSubject.next(merged);
          return merged;
        }
        const fallback = this.getLocalHome();
        this.homeSubject.next(fallback);
        return fallback;
      }),
      catchError(() => {
        const fallback = this.getLocalHome();
        this.homeSubject.next(fallback);
        return of(fallback);
      }),
      shareReplay(1)
    );

    return this.homeLoad$;
  }

  saveHome(content: SiteHomeContent): Observable<SiteHomeContent> {
    const payload: SiteHomeContent = {
      ...DEFAULT_HOME_CONTENT,
      ...content,
      updatedAt: new Date()
    };

    this.persistLocalHome(payload);
    this.homeSubject.next(payload);
    this.homeLoad$ = undefined;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.homeDocId);
    return from(this.firebaseService.withTimeout(
      setDoc(ref, payload).then(() => payload),
      'Tempo esgotado ao salvar conteúdo da home.'
    )).pipe(
      catchError(() => of(payload))
    );
  }

  loadFooter(): Observable<SiteFooterContent> {
    if (this.footerLoad$) return this.footerLoad$;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.footerDocId);
    this.footerLoad$ = from(this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar rodapé.'
    )).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const data = this.firebaseService.normalizeDates(snapshot.data()) as SiteFooterContent;
          const merged = { ...DEFAULT_FOOTER_CONTENT, ...data };
          this.persistLocalFooter(merged);
          this.footerSubject.next(merged);
          return merged;
        }
        const fallback = this.getLocalFooter();
        this.footerSubject.next(fallback);
        return fallback;
      }),
      catchError(() => {
        const fallback = this.getLocalFooter();
        this.footerSubject.next(fallback);
        return of(fallback);
      }),
      shareReplay(1)
    );

    return this.footerLoad$;
  }

  saveFooter(content: SiteFooterContent): Observable<SiteFooterContent> {
    const payload: SiteFooterContent = {
      ...DEFAULT_FOOTER_CONTENT,
      ...content,
      updatedAt: new Date()
    };

    this.persistLocalFooter(payload);
    this.footerSubject.next(payload);
    this.footerLoad$ = undefined;

    const ref = doc(this.firebaseService.firestore, this.collectionName, this.footerDocId);
    return from(this.firebaseService.withTimeout(
      setDoc(ref, payload).then(() => payload),
      'Tempo esgotado ao salvar rodapé.'
    )).pipe(
      catchError(() => of(payload))
    );
  }

  /** Cria os documentos com os defaults caso ainda não existam. Idempotente. */
  async migrateDefaultsIfMissing(): Promise<void> {
    const headerRef = doc(this.firebaseService.firestore, this.collectionName, this.headerDocId);
    const contactRef = doc(this.firebaseService.firestore, this.collectionName, this.contactDocId);
    const homeRef = doc(this.firebaseService.firestore, this.collectionName, this.homeDocId);
    const footerRef = doc(this.firebaseService.firestore, this.collectionName, this.footerDocId);

    try {
      const [headerSnap, contactSnap, homeSnap, footerSnap] = await Promise.all([
        getDoc(headerRef),
        getDoc(contactRef),
        getDoc(homeRef),
        getDoc(footerRef)
      ]);

      if (!headerSnap.exists()) {
        await setDoc(headerRef, { ...DEFAULT_HEADER_CONTENT, updatedAt: new Date() });
      }

      if (!contactSnap.exists()) {
        await setDoc(contactRef, { ...DEFAULT_CONTACT_CONTENT, updatedAt: new Date() });
      }

      if (!homeSnap.exists()) {
        await setDoc(homeRef, { ...DEFAULT_HOME_CONTENT, updatedAt: new Date() });
      }

      if (!footerSnap.exists()) {
        await setDoc(footerRef, { ...DEFAULT_FOOTER_CONTENT, updatedAt: new Date() });
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
        route: this.sanitizeRoute(link.route || def.route),
        order: typeof link.order === 'number' ? link.order : def.order,
        visible: link.visible !== false
      });
    }

    for (const def of DEFAULT_HEADER_CONTENT.links) {
      if (!byId.has(def.id)) byId.set(def.id, { ...def });
    }

    return [...byId.values()].sort((a, b) => a.order - b.order);
  }

  /** Garante "/segmento-1/segmento-2" com cada segmento em slug-case ASCII. */
  sanitizeRoute(route: string): string {
    const trimmed = (route || '').trim();
    if (!trimmed) return '/';
    const parts = trimmed
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .split('/')
      .map(p => this.slugify(p))
      .filter(Boolean);
    return parts.length ? '/' + parts.join('/') : '/';
  }

  private slugify(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
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

  private getLocalHome(): SiteHomeContent {
    try {
      const raw = localStorage.getItem(this.homeLocalKey);
      if (!raw) return DEFAULT_HOME_CONTENT;
      return { ...DEFAULT_HOME_CONTENT, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_HOME_CONTENT;
    }
  }

  private persistLocalHome(value: SiteHomeContent): void {
    try { localStorage.setItem(this.homeLocalKey, JSON.stringify(value)); } catch {}
  }

  private getLocalFooter(): SiteFooterContent {
    try {
      const raw = localStorage.getItem(this.footerLocalKey);
      if (!raw) return DEFAULT_FOOTER_CONTENT;
      return { ...DEFAULT_FOOTER_CONTENT, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_FOOTER_CONTENT;
    }
  }

  private persistLocalFooter(value: SiteFooterContent): void {
    try { localStorage.setItem(this.footerLocalKey, JSON.stringify(value)); } catch {}
  }
}
