import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap, timeout } from 'rxjs';
import { ForeignCurrencyCode } from '../utils/currency-format';

export interface ExchangeRate {
  value: number | null;
  updatedAt: Date | null;
}

interface AwesomeApiCurrency {
  bid?: string;
  ask?: string;
  create_date?: string;
}

type AwesomeApiResponse = Record<string, AwesomeApiCurrency | undefined>;

@Injectable({
  providedIn: 'root'
})
export class ExchangeRateService {
  private readonly baseUrl = 'https://economia.awesomeapi.com.br/json/last';
  private readonly cacheTtlMs = 30 * 60 * 1000;
  private readonly fallbackRates: Record<ForeignCurrencyCode, number> = {
    USD: 5.6,
    EUR: 6.1,
    GBP: 7.1
  };
  private readonly pairs: Record<ForeignCurrencyCode, string> = {
    USD: 'USD-BRL',
    EUR: 'EUR-BRL',
    GBP: 'GBP-BRL'
  };

  private readonly cache = new Map<ForeignCurrencyCode, { rate: ExchangeRate; expiresAt: number }>();
  private readonly inflight = new Map<ForeignCurrencyCode, Observable<ExchangeRate>>();
  private http: HttpClient;

  constructor(httpBackend: HttpBackend) {
    this.http = new HttpClient(httpBackend);
  }

  getDollarRate(): Observable<ExchangeRate> {
    return this.getCurrencyRate('USD');
  }

  getCurrencyRate(currency: ForeignCurrencyCode): Observable<ExchangeRate> {
    const cached = this.cache.get(currency);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.rate);
    }

    const existing = this.inflight.get(currency);
    if (existing) {
      return existing;
    }

    const pair = this.pairs[currency];
    const request = this.http.get<AwesomeApiResponse>(`${this.baseUrl}/${pair}`).pipe(
      timeout(8000),
      map(response => {
        const quote = response[pair.replace('-', '')];
        const rawValue = quote?.ask || quote?.bid;
        const value = rawValue ? Number(rawValue) : null;

        if (!value || Number.isNaN(value)) {
          return this.getFallbackRate(currency);
        }

        return {
          value,
          updatedAt: quote?.create_date ? new Date(quote.create_date) : new Date()
        };
      }),
      catchError(() => of(this.getFallbackRate(currency))),
      shareReplay(1),
      tap(rate => {
        this.cache.set(currency, { rate, expiresAt: Date.now() + this.cacheTtlMs });
        this.inflight.delete(currency);
      })
    );

    this.inflight.set(currency, request);
    return request;
  }

  convertFromBRL(brlValue: number, currency: ForeignCurrencyCode): Observable<{ value: number | null; rate: number | null }> {
    return this.getCurrencyRate(currency).pipe(
      map(({ value: rate }) => {
        if (!rate || rate <= 0 || !brlValue || brlValue <= 0) {
          return { value: null, rate: null };
        }
        return { value: brlValue / rate, rate };
      })
    );
  }

  private getFallbackRate(currency: ForeignCurrencyCode): ExchangeRate {
    return {
      value: this.fallbackRates[currency],
      updatedAt: null
    };
  }
}
