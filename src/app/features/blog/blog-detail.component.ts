import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, timeout } from 'rxjs';
import { PostService } from '../../core/services/post.service';
import { TripService } from '../../core/services/trip.service';
import { Post } from '../../core/models/post.model';
import { Trip } from '../../core/models/trip.model';
import { safeScrollToTop } from '../../core/utils/browser';
import { SeoService } from '../../core/services/seo.service';
import { postSeo } from '../../core/utils/seo-fallback';
import { renderPostHtml } from '../../core/utils/post-content';
import { isInstitutionalAuthor, postAuthorName } from '../../core/utils/post-author';

interface LightboxImage {
  src: string;
  alt: string;
  caption: string;
}

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blog-detail.component.html',
  styleUrl: './blog-detail.component.scss'
})
export class BlogDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  /**
   * Quando informado, a página exibe este post (vindo do formulário do admin)
   * em vez de buscar pela URL: é a pré-visualização antes de publicar.
   */
  @Input() previewPost: Post | null = null;

  post: Post | null = null;
  renderedContent: SafeHtml = '';
  relatedPosts: Post[] = [];
  relatedTrips: Trip[] = [];
  loading = true;
  error: string | null = null;
  origin: 'home' | 'footer' | 'blog' = 'blog';

  lightboxImages: LightboxImage[] = [];
  lightboxIndex = 0;
  lightboxOpen = false;

  readonly authorName = postAuthorName;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private tripService: TripService,
    private seo: SeoService,
    private sanitizer: DomSanitizer,
    private host: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {}

  get preview(): boolean {
    return this.previewPost !== null;
  }

  ngOnInit() {
    if (this.previewPost) {
      this.showPost(this.previewPost);
      this.loading = false;
      return;
    }

    safeScrollToTop();
    const origin = this.route.snapshot.queryParamMap.get('origin');
    this.origin = origin === 'home' || origin === 'footer' ? origin : 'blog';

    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.loadPost(slug);
      }
    });
  }

  loadPost(slug: string) {
    this.loading = true;
    this.error = null;
    this.post = null;
    this.relatedPosts = [];
    this.relatedTrips = [];

    this.postService.getPostBySlug(slug).pipe(
      timeout(12000),
      catchError(() => of(null))
    ).subscribe(post => {
      this.loading = false;

      if (!post) {
        this.error = 'Post não encontrado';
        this.applyNotFoundSeo();
        this.cdr.markForCheck();
        return;
      }

      // Posts sem status explícito são tratados como 'published' (compat com docs antigos).
      // Apenas rejeita explicitamente se status === 'draft'.
      if (post.status === 'draft') {
        this.error = 'Post não encontrado';
        this.applyNotFoundSeo();
        this.cdr.markForCheck();
        return;
      }

      this.showPost(post);
      this.applyPostSeo(post);
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit() {
    if (this.preview) {
      // Na pré-visualização os links não podem tirar o usuário do formulário.
      this.host.nativeElement.addEventListener('click', this.blockPreviewNavigation, true);
    }
  }

  ngOnDestroy() {
    this.host.nativeElement.removeEventListener('click', this.blockPreviewNavigation, true);
  }

  private showPost(post: Post) {
    this.post = post;
    this.renderedContent = renderPostHtml(post.content, this.sanitizer);
    this.loadRelatedPosts(post);
    this.loadRelatedTrips(post);
  }

  private readonly blockPreviewNavigation = (event: MouseEvent) => {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (!anchor) return;
    // Imagens de galeria abrem o lightbox; links externos seguem para nova aba.
    if (anchor.closest('.post-gallery, .gallery') || anchor.target === '_blank') return;
    event.preventDefault();
    event.stopPropagation();
  };

  /** Define meta tags, canonical e JSON-LD (BlogPosting + Breadcrumb) do post. */
  private applyPostSeo(post: Post): void {
    const { title, description, image } = postSeo(post);
    const canonicalPath = `/blog/${post.slug}/`;
    const published = post.publishedAt || post.createdAt;

    this.seo.setMeta({ title, description, image, canonicalPath, type: 'article' });

    this.seo.setJsonLd('article', {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description,
      image: image ? this.seo.absoluteUrl(image) : undefined,
      url: this.seo.absoluteUrl(canonicalPath),
      datePublished: published ? new Date(published).toISOString() : undefined,
      dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
      author: {
        '@type': isInstitutionalAuthor(postAuthorName(post)) ? 'Organization' : 'Person',
        name: postAuthorName(post)
      },
      publisher: {
        '@type': 'Organization',
        name: 'Unitur Agência de Viagens e Turismo',
        logo: { '@type': 'ImageObject', url: this.seo.absoluteUrl('/logo.jpeg') }
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': this.seo.absoluteUrl(canonicalPath) }
    });

    this.seo.setJsonLd('breadcrumb', this.seo.breadcrumbSchema([
      { name: 'Início', path: '/' },
      { name: 'Blog', path: '/blog/' },
      { name: title, path: canonicalPath }
    ]));
  }

  private applyNotFoundSeo(): void {
    this.seo.setMeta({
      title: 'Post não encontrado',
      description: 'O artigo que você procura não está disponível.',
      noindex: true
    });
  }

  loadRelatedPosts(post: Post) {
    this.postService.getRelatedPosts(post, 3).pipe(
      catchError(() => of([] as Post[]))
    ).subscribe(posts => {
      this.relatedPosts = posts;
      this.cdr.markForCheck();
    });
  }

  loadRelatedTrips(post: Post) {
    const ids = (post.relatedTrips || []).slice(0, 3).map(id => Number(id));
    if (!ids.length) {
      this.relatedTrips = [];
      return;
    }

    this.tripService.getTrips({ status: 'active', limit: 100 }).pipe(
      catchError(() => of({ data: [] as Trip[], total: 0, page: 1, limit: 100, totalPages: 1, hasNextPage: false }))
    ).subscribe(response => {
      this.relatedTrips = response.data.filter(trip => ids.includes(Number(trip.id))).slice(0, 3);
      this.cdr.markForCheck();
    });
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  /**
   * Abre o lightbox ao clicar numa imagem de galeria — tanto a nova galeria do
   * editor (.post-gallery) quanto as galerias herdadas do WordPress (.gallery),
   * cujos links apontavam para páginas de anexo que não existem mais.
   */
  onPostBodyClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    const gallery = target?.closest<HTMLElement>('.post-gallery, .gallery');
    const item = target?.tagName === 'IMG' ? target : target?.closest('figure, .gallery-item');
    if (!gallery || !item) return;

    const clicked = item.tagName === 'IMG' ? item as HTMLImageElement : item.querySelector('img');
    if (!clicked) return;

    event.preventDefault();
    const images = Array.from(gallery.querySelectorAll('img'));
    this.lightboxImages = images.map(image => ({
      src: image.currentSrc || image.src,
      alt: image.alt || '',
      caption: this.captionFor(image)
    }));
    this.lightboxIndex = Math.max(0, images.indexOf(clicked));
    this.lightboxOpen = true;
  }

  closeLightbox() {
    this.lightboxOpen = false;
  }

  lightboxPrev() {
    const total = this.lightboxImages.length;
    this.lightboxIndex = (this.lightboxIndex - 1 + total) % total;
  }

  lightboxNext() {
    this.lightboxIndex = (this.lightboxIndex + 1) % this.lightboxImages.length;
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (!this.lightboxOpen) return;
    if (event.key === 'Escape') this.closeLightbox();
    if (event.key === 'ArrowLeft') this.lightboxPrev();
    if (event.key === 'ArrowRight') this.lightboxNext();
  }

  private captionFor(image: HTMLImageElement): string {
    const caption = image.closest('figure')?.querySelector('figcaption')
      ?? image.closest('.gallery-item')?.querySelector('.gallery-caption');
    return caption?.textContent?.trim() || '';
  }

  shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  }

  shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(this.post?.title || '');
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  }

  shareOnWhatsApp() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(this.post?.title || '');
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
  }

  copyPostLink() {
    navigator.clipboard?.writeText(window.location.href);
  }

  goBackToHomeBlog(event: Event) {
    event.preventDefault();

    if (this.origin === 'footer' || this.origin === 'blog') {
      this.router.navigate(['/blog'], {
        queryParams: this.origin === 'footer' ? { origin: 'footer' } : undefined
      });
      return;
    }

    this.router.navigate(['/']).then(() => {
      window.setTimeout(() => {
        document.getElementById('blog-unitur')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    });
  }
}
