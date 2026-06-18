import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ChangeDetectorRef, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AboutContentService } from '../../core/services/about-content.service';
import { AboutPageContent, DEFAULT_ABOUT_CONTENT } from '../../core/models/about-content.model';
import { safeScrollToTop } from '../../core/utils/browser';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {
  private observer!: IntersectionObserver;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  aboutContent: AboutPageContent = JSON.parse(JSON.stringify(DEFAULT_ABOUT_CONTENT.about));

  constructor(
    private elementRef: ElementRef,
    private aboutContentService: AboutContentService,
    private cdr: ChangeDetectorRef,
    private seo: SeoService
  ) {}

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
