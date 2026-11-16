import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDetailComponent } from './product-detail.component';
import { TripService } from '../../core/services/trip.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { SeoService } from '../../core/services/seo.service';
import { SiteContentService } from '../../core/services/site-content.service';
import { TagService } from '../../core/services/tag.service';

describe('ProductDetailComponent download do PDF anexado', () => {
  beforeEach(() => {
    vi.spyOn(ProductDetailComponent.prototype, 'ngOnInit').mockImplementation(() => {});
    TestBed.configureTestingModule({ imports: [ProductDetailComponent], providers: [provideRouter([]),
      ...[TripService, ExchangeRateService, SeoService, SiteContentService, TagService].map(provide => ({ provide, useValue: {} }))
    ] });
  });
  afterEach(() => vi.restoreAllMocks());

  function render(url: string) {
    const fixture = TestBed.createComponent(ProductDetailComponent);
    fixture.componentInstance.trip = {
      slug: 'viagem', title: 'Viagem teste', menuIds: [], destination: 'Brasil', date: '22/11/2026', duration: '1 dia',
      price: 'R$ 150,00', spots: '', showSpots: false, guide: '', coordinator: '', image: '/foto.jpg', summary: 'Descrição',
      highlights: [], itinerary: [], included: [], notIncluded: [], itineraryPdfUrl: url, itineraryPdfName: 'roteiro-original.pdf'
    };
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('disponibiliza exatamente o arquivo anexado pela equipe', () => {
    const page = render('https://storage.example/roteiro-original.pdf');
    const link = page.querySelector('.trip-actions a') as HTMLAnchorElement;
    expect(link.textContent).toContain('Baixar roteiro');
    expect(link.href).toBe('https://storage.example/roteiro-original.pdf');
    expect(link.download).toBe('roteiro-original.pdf');
  });

  it('não oferece download quando não há PDF cadastrado', () => {
    const page = render('');
    expect(page.querySelector('.trip-actions a')).toBeNull();
    expect(page.textContent).not.toContain('Baixar roteiro');
    expect(page.textContent).toContain('Compartilhar roteiro');
  });
});
