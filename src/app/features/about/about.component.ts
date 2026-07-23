import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ChangeDetectorRef, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AboutContentService } from '../../core/services/about-content.service';
import { AboutPageContent, DEFAULT_ABOUT_CONTENT } from '../../core/models/about-content.model';
import { safeScrollToTop } from '../../core/utils/browser';
import { SeoService } from '../../core/services/seo.service';
import { SiteContentService } from '../../core/services/site-content.service';
import { normalizeWhatsAppNumber } from '../../core/models/site-content.model';
import { buildWhatsappLink } from '../../core/utils/whatsapp-message';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {
  private observer!: IntersectionObserver;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  aboutContent: AboutPageContent = JSON.parse(JSON.stringify(DEFAULT_ABOUT_CONTENT.about));

  /** Número de WhatsApp padrão do site (usado quando o botão não tem link). */
  private whatsappNumber = '';

  constructor(
    private elementRef: ElementRef,
    private aboutContentService: AboutContentService,
    private cdr: ChangeDetectorRef,
    private seo: SeoService,
    private siteContentService: SiteContentService
  ) {}

  /** Link do WhatsApp padrão (mesmo do botão "Reservar agora"). */
  private get whatsappLink(): string {
    return buildWhatsappLink(
      this.whatsappNumber,
      'Olá! Gostaria de mais informações sobre as viagens da Unitur.'
    );
  }

  /** Destino do botão "Fale Conosco": link cadastrado ou WhatsApp padrão. */
  get ctaPrimaryLink(): string {
    return (this.aboutContent.ctaPrimaryLink || '').trim() || this.whatsappLink;
  }

  /** Destino do botão "Ver Pacotes": link cadastrado ou "/viagens". */
  get ctaSecondaryLink(): string {
    return (this.aboutContent.ctaSecondaryLink || '').trim() || '/viagens';
  }

  /** Um link é externo quando não começa com "/" (rota interna do Angular). */
  isExternalLink(link: string): boolean {
    return !!link && !link.startsWith('/');
  }

  ngOnInit() {
    safeScrollToTop();
    this.seo.setMeta({
      title: 'Sobre a Unitur',
      description: 'Conheça a Unitur: mais de 25 anos organizando peregrinações e viagens em grupo pelo Brasil e pelo mundo, com acompanhamento em todas as etapas.',
      canonicalPath: '/sobre/sobre-a-unitur/',
      type: 'website'
    });
    this.aboutContentService.content$.subscribe(content => {
      this.aboutContent = content.about;
      this.cdr.detectChanges();
    });
    this.aboutContentService.load().subscribe();

    // Número de WhatsApp do site, para o fallback do botão "Fale Conosco".
    this.siteContentService.contact$.subscribe(contact => {
      this.whatsappNumber = normalizeWhatsAppNumber(contact?.whatsapp);
      this.cdr.detectChanges();
    });
    this.siteContentService.loadContact().subscribe();
  }

  ngAfterViewInit() {
    // IntersectionObserver não existe no SSR.
    if (this.isBrowser) {
      this.setupScrollAnimations();
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupScrollAnimations() {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, options);

    // Observar todos os elementos com classe scroll-animate
    const elements = this.elementRef.nativeElement.querySelectorAll('.scroll-animate');
    elements.forEach((el: Element) => {
      this.observer.observe(el);
    });
  }
}
