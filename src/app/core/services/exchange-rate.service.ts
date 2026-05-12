import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';
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
  private readonly fallbackRates: Record<ForeignCurrencyCode, number> = {
    USD: 5.6,
    EUR: 6.1,
    GBP: 7.1
  };
  private readonly pairs: Record<ForeignCurrencyCode, string> = {
    USD: 'USD-BRLT',
    EUR: 'EUR-BRLT',
    GBP: 'GBP-BRL'
  };

  private http: HttpClient;

  constructor(httpBackend: HttpBackend) {
    this.http = new HttpClient(httpBackend);
  }

  getDollarRate(): Observable<ExchangeRate> {
    return this.getCurrencyRate('USD');
  }

  getCurrencyRate(currency: ForeignCurrencyCode): Observable<ExchangeRate> {
    const pair = this.pairs[currency];

    return this.http.get<AwesomeApiResponse>(`${this.baseUrl}/${pair}`).pipe(
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
      catchError(() => of(this.getFallbackRate(currency)))
    );
  }

  private getFallbackRate(currency: ForeignCurrencyCode): ExchangeRate {
    return {
      value: this.fallbackRates[currency],
      updatedAt: null
    };
  }
}
