import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, Subject, takeUntil, timer, switchMap } from 'rxjs';
import { ExchangeRate, ExchangeRateService } from '../../core/services/exchange-rate.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent implements OnInit, OnDestroy {
  currentYear = new Date().getFullYear();
  dollarRate: ExchangeRate = { value: null, updatedAt: null };
  euroRate: ExchangeRate = { value: null, updatedAt: null };

  private readonly destroy$ = new Subject<void>();

  constructor(
    private exchangeRateService: ExchangeRateService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    timer(0, 30 * 60 * 1000).pipe(
      switchMap(() => forkJoin({
        dollar: this.exchangeRateService.getCurrencyRate('USD'),
        euro: this.exchangeRateService.getCurrencyRate('EUR')
      })),
      takeUntil(this.destroy$)
    ).subscribe(rates => {
      // setTimeout dentro da zone garante que a atribuição cai em uma nova
      // tarefa do event loop, depois do ciclo de change detection atual,
      // evitando NG0100 quando o observable responde rápido demais.
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.ngZone.run(() => {
            this.dollarRate = rates.dollar;
            this.euroRate = rates.euro;
            this.cdr.markForCheck();
          });
        }, 0);
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  formatExchangeRate(rate: ExchangeRate) {
    if (!rate.value) {
      return 'Carregando...';
    }

    return rate.value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}
