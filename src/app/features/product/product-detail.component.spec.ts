import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDetailComponent } from './product-detail.component';
import { TripService } from '../../core/services/trip.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { SeoService } from '../../core/services/seo.service';
import { SiteContentService } from '../../core/services/site-content.service';
import { TagService } from '../../core/services/tag.service';

describe('ProductDetailComponent download do roteiro (PDF anexado ou gerado)', () => {
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

  const downloadButton = (page: HTMLElement) =>
    Array.from(page.querySelectorAll('.trip-actions button')).find(button => button.textContent?.includes('Baixar roteiro'));

  it('disponibiliza exatamente o arquivo anexado pela equipe', () => {
    const page = render('https://storage.example/roteiro-original.pdf');
    const link = page.querySelector('.trip-actions a') as HTMLAnchorElement;
    expect(link.textContent).toContain('Baixar roteiro');
    expect(link.href).toBe('https://storage.example/roteiro-original.pdf');
    expect(link.download).toBe('roteiro-original.pdf');
    // Com anexo, não oferece também o PDF gerado: um único "Baixar roteiro".
    expect(downloadButton(page)).toBeUndefined();
  });

  it('sem PDF cadastrado, gera o PDF do roteiro completo', () => {
    const generate = vi.spyOn(ProductDetailComponent.prototype, 'downloadPdf').mockResolvedValue();
    const page = render('');
    expect(page.querySelector('.trip-actions a')).toBeNull();
    expect(page.textContent).toContain('Compartilhar roteiro');

    const button = downloadButton(page) as HTMLButtonElement;
    expect(button).toBeDefined();
    button.click();
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
