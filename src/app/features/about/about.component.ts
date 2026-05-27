import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AboutContentService } from '../../core/services/about-content.service';
import { AboutPageContent, DEFAULT_ABOUT_CONTENT } from '../../core/models/about-content.model';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {
  private observer!: IntersectionObserver;

  aboutContent: AboutPageContent = JSON.parse(JSON.stringify(DEFAULT_ABOUT_CONTENT.about));

  constructor(
    private elementRef: ElementRef,
    private aboutContentService: AboutContentService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    window.scrollTo({ top: 0, behavior: 'auto' });
    this.aboutContentService.content$.subscribe(content => {
      this.aboutContent = content.about;
      this.cdr.detectChanges();
    });
    this.aboutContentService.load().subscribe();
  }

  ngAfterViewInit() {
    this.setupScrollAnimations();
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
