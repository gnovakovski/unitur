import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  from,
  map,
  of,
  shareReplay
} from 'rxjs';
import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { ForeignCurrencyCode, registerCurrencySymbol } from '../utils/currency-format';
import { ResolvedTripPrice, TripPriceFields, computeTripPrice } from '../utils/trip-pricing';
import { FirebaseService } from './firebase.service';
import { BrowserStorageService } from './browser-storage.service';

export interface ExchangeRate {
  value: number | null;
  updatedAt: Date | null;
}

export interface CurrencyEntry {
  code: string;
  name: string;
  symbol?: string;
  rate: number | null;
}

export interface ExchangeRatesContent {
  currencies: CurrencyEntry[];
  updatedAt?: Date;
}

const DEFAULT_CURRENCIES: CurrencyEntry[] = [
  { code: 'USD', name: 'Dólar Americano', symbol: 'US$', rate: null },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: null },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£', rate: null }
];

@Injectable({
  providedIn: 'root'
})
export class ExchangeRateService {
  private readonly settingsCollection = 'siteContent';
  private readonly settingsDocId = 'exchangeRates';
  private readonly localKey = 'unitur_exchange_rates';

  // Declarado antes do subject: getLocalRates() roda no inicializador.
  private readonly storage = inject(BrowserStorageService);

  private ratesSubject = new BehaviorSubject<ExchangeRatesContent>(this.getLocalRates());
  rates$ = this.ratesSubject.asObservable();

  private loadObservable$?: Observable<ExchangeRatesContent>;

  constructor(private firebaseService: FirebaseService) {
    // Sincroniza símbolos com o registry global ao carregar
    this.registerSymbols(this.ratesSubject.value.currencies);
  }

  getDollarRate(): Observable<ExchangeRate> {
    return this.getCurrencyRate('USD');
  }

  getCurrencyRate(currency: ForeignCurrencyCode): Observable<ExchangeRate> {
    return this.ensureLoaded().pipe(
      map(content => this.findRate(content, currency))
    );
  }

  /** Versão síncrona — retorna o snapshot atual do BehaviorSubject. */
  getCurrencyRateSnapshot(currency: ForeignCurrencyCode): ExchangeRate {
    return this.findRate(this.ratesSubject.value, currency);
  }

  /** Lista de moedas atualmente cadastradas (snapshot síncrono). */
  getCurrenciesSnapshot(): CurrencyEntry[] {
    return this.ratesSubject.value.currencies.slice();
  }

  /**
   * Resolve o preço exibido de uma viagem (R$ + moeda estrangeira) com a cotação
   * já carregada do Firestore. É a forma correta de ler preço de viagem em
   * qualquer tela — nunca derive o valor estrangeiro a partir do R$ gravado.
   */
  resolveTripPrice(trip: TripPriceFields): Observable<ResolvedTripPrice> {
    const currency = String(trip.foreignCurrency || '').trim();

    if (!currency) {
      return of(computeTripPrice(trip, null));
    }

    return this.getCurrencyRate(currency).pipe(
      map(({ value: rate }) => computeTripPrice(trip, rate))
    );
  }

  /**
   * Versão síncrona, usando as cotações em cache (localStorage). Serve para
   * pintar o preço já no primeiro render, sem esperar o Firestore; o valor
   * definitivo chega depois por `resolveTripPrice`.
   */
  resolveTripPriceSnapshot(trip: TripPriceFields): ResolvedTripPrice {
    const currency = String(trip.foreignCurrency || '').trim();
    const rate = currency ? this.getCurrencyRateSnapshot(currency).value : null;
    return computeTripPrice(trip, rate);
  }

  loadRates(): Observable<ExchangeRatesContent> {
    if (this.loadObservable$) return this.loadObservable$;

    const ref = doc(this.firebaseService.firestore, this.settingsCollection, this.settingsDocId);
    this.loadObservable$ = from(this.firebaseService.withTimeout(
      getDoc(ref),
      'Tempo esgotado ao carregar câmbio.'
    )).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const raw = this.firebaseService.normalizeDates(snapshot.data()) as Partial<ExchangeRatesContent> & {
            USD?: number | null;
            EUR?: number | null;
            GBP?: number | null;
          };
          const merged = this.normalize(raw);
          this.persistLocalRates(merged);
          this.registerSymbols(merged.currencies);
          this.ratesSubject.next(merged);
          return merged;
        }
        const fallback = this.getLocalRates();
        this.ratesSubject.next(fallback);
        return fallback;
      }),
      catchError(() => {
        const fallback = this.getLocalRates();
        this.ratesSubject.next(fallback);
        return of(fallback);
      }),
      shareReplay(1)
    );

    return this.loadObservable$;
  }

  saveRates(currencies: CurrencyEntry[]): Observable<ExchangeRatesContent> {
    const payload: ExchangeRatesContent = {
      currencies: this.sanitizeCurrencies(currencies),
      updatedAt: new Date()
    };

    this.persistLocalRates(payload);
    this.registerSymbols(payload.currencies);
    this.ratesSubject.next(payload);
    this.loadObservable$ = undefined;

    const ref = doc(this.firebaseService.firestore, this.settingsCollection, this.settingsDocId);
    return from(this.firebaseService.withTimeout(
      setDoc(ref, payload).then(() => payload),
      'Tempo esgotado ao salvar câmbio.'
    )).pipe(
      catchError(() => of(payload))
    );
  }

  private ensureLoaded(): Observable<ExchangeRatesContent> {
    if (this.loadObservable$) return this.loadObservable$;
    return this.loadRates();
  }

  private findRate(content: ExchangeRatesContent, currency: ForeignCurrencyCode): ExchangeRate {
    const upper = String(currency || '').toUpperCase();
    const found = content.currencies.find(c => c.code.toUpperCase() === upper);
    return {
      value: found?.rate ?? null,
      updatedAt: content.updatedAt || null
    };
  }

  /** Normaliza tanto o formato novo (array `currencies`) quanto o antigo (campos USD/EUR/GBP). */
  private normalize(raw: Partial<ExchangeRatesContent> & { USD?: number | null; EUR?: number | null; GBP?: number | null }): ExchangeRatesContent {
    if (Array.isArray(raw.currencies)) {
      return {
        currencies: this.sanitizeCurrencies(raw.currencies),
        updatedAt: raw.updatedAt
      };
    }
    // Compatibilidade com schema antigo
    const legacy: CurrencyEntry[] = DEFAULT_CURRENCIES.map(def => ({
      ...def,
      rate: this.toNumber((raw as any)[def.code])
    }));
    return { currencies: legacy, updatedAt: raw.updatedAt };
  }

  private sanitizeCurrencies(list: CurrencyEntry[] | undefined): CurrencyEntry[] {
    if (!Array.isArray(list)) return [...DEFAULT_CURRENCIES];
    const seen = new Set<string>();
    return list
      .map(item => ({
        code: String(item?.code || '').toUpperCase().trim().slice(0, 6),
        name: String(item?.name || '').trim(),
        symbol: String(item?.symbol || '').trim() || undefined,
        rate: this.toNumber(item?.rate)
      }))
      .filter(item => {
        if (!item.code) return false;
        if (seen.has(item.code)) return false;
        seen.add(item.code);
        return true;
      });
  }

  private registerSymbols(currencies: CurrencyEntry[]): void {
    currencies.forEach(c => {
      if (c.symbol) registerCurrencySymbol(c.code, c.symbol);
    });
  }

  private toNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  private getLocalRates(): ExchangeRatesContent {
    try {
      const raw = this.storage.getItem(this.localKey);
      if (!raw) return { currencies: [...DEFAULT_CURRENCIES] };
      const parsed = JSON.parse(raw);
      return this.normalize(parsed);
    } catch {
      return { currencies: [...DEFAULT_CURRENCIES] };
    }
  }

  private persistLocalRates(value: ExchangeRatesContent): void {
    this.storage.setItem(this.localKey, JSON.stringify(value));
  }
}
