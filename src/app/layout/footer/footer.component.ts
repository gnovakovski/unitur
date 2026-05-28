import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { CurrencyEntry, ExchangeRateService } from '../../core/services/exchange-rate.service';
import { SiteContentService } from '../../core/services/site-content.service';
import {
  DEFAULT_CONTACT_CONTENT,
  DEFAULT_FOOTER_CONTENT,
  SiteContactContent,
  SiteFooterContent
} from '../../core/models/site-content.model';

interface FooterRateView {
  code: string;
  label: string;
  formatted: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent implements OnInit, OnDestroy {
  currentYear = new Date().getFullYear();
  exchangeRates: FooterRateView[] = [];
  contact: SiteContactContent = DEFAULT_CONTACT_CONTENT;
  footerContent: SiteFooterContent = DEFAULT_FOOTER_CONTENT;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private exchangeRateService: ExchangeRateService,
    private siteContentService: SiteContentService,
    private cdr: ChangeDetectorRef
  ) {}

  get phoneHref(): string {
    const digits = (this.contact.phone || '').replace(/\D/g, '');
    return digits ? `tel:+${digits}` : '';
  }

  ngOnInit() {
    this.siteContentService.contact$.pipe(takeUntil(this.destroy$)).subscribe(contact => {
      this.contact = contact;
      this.cdr.markForCheck();
    });
    this.siteContentService.loadContact().subscribe();

    this.siteContentService.footer$.pipe(takeUntil(this.destroy$)).subscribe(footer => {
      this.footerContent = footer;
      this.cdr.markForCheck();
    });
    this.siteContentService.loadFooter().subscribe();

    this.exchangeRateService.rates$.pipe(takeUntil(this.destroy$)).subscribe(rates => {
      this.exchangeRates = this.buildView(rates.currencies);
      this.cdr.markForCheck();
    });
    this.exchangeRateService.loadRates().subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Mostra um placeholder textual quando o logo (edc.png/iata.png) não foi adicionado em /assets ainda. */
  onLogoError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    const alt = img.alt || 'Logo';
    const placeholder = document.createElement('span');
    placeholder.className = 'certifications__placeholder';
    placeholder.textContent = alt;
    img.replaceWith(placeholder);
  }

  private buildView(currencies: CurrencyEntry[]): FooterRateView[] {
    return currencies
      .filter(c => c.rate && c.rate > 0)
      .map(c => ({
        code: c.code,
        label: c.name || c.code,
        formatted: this.formatBRL(c.rate as number)
      }));
  }

  private formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}
