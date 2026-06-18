import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, timeout } from 'rxjs';
import { PostService } from '../../core/services/post.service';
import { TripService } from '../../core/services/trip.service';
import { Post } from '../../core/models/post.model';
import { Trip } from '../../core/models/trip.model';
import { safeScrollToTop } from '../../core/utils/browser';
import { SeoService } from '../../core/services/seo.service';
import { postSeo } from '../../core/utils/seo-fallback';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blog-detail.component.html',
  styleUrl: './blog-detail.component.scss'
})
export class BlogDetailComponent implements OnInit {
  post: Post | null = null;
  relatedPosts: Post[] = [];
  relatedTrips: Trip[] = [];
  loading = true;
  error: string | null = null;
  origin: 'home' | 'footer' | 'blog' = 'blog';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private tripService: TripService,
    private seo: SeoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
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

      this.post = post;
      this.applyPostSeo(post);
      this.loadRelatedPosts(post);
      this.loadRelatedTrips(post);
      this.cdr.markForCheck();
    });
  }

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
      author: { '@type': 'Person', name: post.author?.name || 'Unitur' },
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
    this.postService.getPosts({
      categoryId: post.categoryId,
      limit: 4,
      status: 'published'
    }).pipe(
      catchError(() => of({ data: [] as Post[], total: 0, page: 1, limit: 4, totalPages: 1 }))
    ).subscribe(response => {
      this.relatedPosts = response.data.filter(p => p.id !== post.id).slice(0, 3);
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
      catchError(() => of({ data: [] as Trip[], total: 0, page: 1, limit: 100, totalPages: 1 }))
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
