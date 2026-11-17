import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY, of, Subject } from 'rxjs';
import { Post } from '../models/post.model';
import { Trip } from '../models/trip.model';
import { TripService } from './trip.service';
import { PostService } from './post.service';
import { ExchangeRateService } from './exchange-rate.service';
import { SiteContentService } from './site-content.service';
import { TagService } from './tag.service';
import { ViagemFormComponent } from '../../features/admin/viagens/viagem-form.component';
import { PostFormComponent } from '../../features/admin/posts/post-form.component';
import { ProductDetailComponent } from '../../features/product/product-detail.component';
import { BlogDetailComponent } from '../../features/blog/blog-detail.component';

// Fluxo admin -> persistência simulada -> componente público e SeoService reais.
// Nenhuma escrita no Storage/Firestore de produção.
describe('Imagem anexada no admin refletida no site público', () => {
  const cover = 'https://images.example.test/capa.jpg';
  const sharing = 'https://images.example.test/compartilhamento.jpg';
  let trip: Trip | undefined;
  let post: Post | undefined;
  let params: Subject<ParamMap>;
  const cdr = { markForCheck: vi.fn() };
  const navigation = { navigate: vi.fn() };
  const uploads = { uploadToEntity: vi.fn() };
  const trips = {
    createTrip: vi.fn(), updateTrip: vi.fn(), getTrip: vi.fn(), getTripBySlug: vi.fn()
  };
  const posts = {
    createPost: vi.fn(), updatePost: vi.fn(), getPost: vi.fn(), getPostBySlug: vi.fn(), getRelatedPosts: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    trip = undefined;
    post = undefined;
    params = new Subject<ParamMap>();
    uploads.uploadToEntity.mockReturnValue(of({ url: sharing }));
    trips.createTrip.mockImplementation(data => {
      trip = { ...data, id: 123, slug: 'gramado-e-canela', createdAt: new Date(), updatedAt: new Date() };
      return of(trip);
    });
    trips.updateTrip.mockImplementation((_id, data) => { trip = { ...trip!, ...data }; return of(trip); });
    trips.getTrip.mockImplementation(() => of(trip));
    trips.getTripBySlug.mockImplementation(() => of(trip));
    posts.createPost.mockImplementation(data => {
      post = { ...data, id: 456, createdAt: new Date(), updatedAt: new Date() };
      return of(post);
    });
    posts.updatePost.mockImplementation((_id, data) => { post = { ...post!, ...data }; return of(post); });
    posts.getPost.mockImplementation(() => of(post));
    posts.getPostBySlug.mockImplementation(() => of(post));
    posts.getRelatedPosts.mockReturnValue(of([]));
    const price = { brl: 150, foreignAmount: null, foreignCurrency: null, rate: null };
    TestBed.configureTestingModule({ imports: [ProductDetailComponent, BlogDetailComponent], providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: TripService, useValue: trips }, { provide: PostService, useValue: posts },
      { provide: ExchangeRateService, useValue: { resolveTripPriceSnapshot: () => price, resolveTripPrice: () => of(price) } },
      { provide: SiteContentService, useValue: { contact$: EMPTY, loadContact: () => of({}), loadHeader: () => of({}), getCurrentHeaderLinks: () => [] } },
      { provide: TagService, useValue: { getAllTags: () => of([]) } }
    ] });
  });

  afterEach(() => {
    params.complete();
    document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"], script[id^="ld-"]').forEach(node => node.remove());
    vi.restoreAllMocks();
  });

  function tripAdmin() {
    const admin = new ViagemFormComponent(new FormBuilder(), trips as never, uploads as never, {} as never,
      navigation as never, {} as never, cdr as never, {} as never, {} as never);
    if (trip) {
      admin.isEditMode = true;
      admin.tripId = trip.id;
      admin.loadTrip(trip.id);
    } else {
      admin.tripForm.patchValue({ title: 'Gramado e Canela', menuIds: ['curadoria'], country: 'Brasil', period: 'Novembro',
        startDate: '2026-11-22', price: 150, shortDescription: 'Um dia na Serra Gaúcha', description: 'Passeio de Gramado e Canela.',
        mainImage: cover });
      admin.selectedMenuIds.add('curadoria');
    }
    return admin;
  }

  function postAdmin() {
    const admin = new PostFormComponent(new FormBuilder(), posts as never, {} as never, trips as never,
      uploads as never, navigation as never, {} as never, cdr as never);
    if (post) {
      admin.isEditMode = true;
      admin.postId = post.id;
      admin.loadPost(post.id);
    } else {
      admin.postForm.patchValue({ title: 'Conheça Gramado', slug: 'conheca-gramado', excerpt: 'Viagens pela Serra Gaúcha',
        content: 'Conheça as atrações de Gramado e Canela em um passeio pela Serra Gaúcha.', categoryId: 1,
        status: 'published', featuredImage: cover });
    }
    return admin;
  }

  function expectSharingImage(expected: string, schema: string) {
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(expected);
    expect(document.head.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(expected);
    expect(JSON.parse(document.getElementById(`ld-${schema}`)!.textContent!).image).toBe(expected);
    expect(document.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
  }

  it('viagem: upload salvo chega ao Open Graph, Twitter e JSON-LD da página pública', async () => {
    const admin = tripAdmin();
    const file = new File(['imagem de teste'], 'compartilhamento.jpg', { type: 'image/jpeg' });
    admin.tripForm.patchValue({ ogImage: file });
    await admin.saveTrip();
    expect(uploads.uploadToEntity).toHaveBeenCalledWith(file, 'viagens', 123);
    const page = TestBed.createComponent(ProductDetailComponent);
    page.detectChanges();
    params.next(convertToParamMap({ slug: 'gramado-e-canela' }));
    page.detectChanges();
    expectSharingImage(sharing, 'product');
    expect(page.nativeElement.querySelector('h1').textContent).toContain('Gramado e Canela');
    expect(page.nativeElement.querySelector('.product-hero img').getAttribute('src')).toBe(cover);
  });

  it('viagem: remover e salvar atualiza a prévia pública para a imagem principal', async () => {
    const admin = tripAdmin();
    admin.tripForm.patchValue({ ogImage: new File(['imagem'], 'compartilhamento.jpg', { type: 'image/jpeg' }) });
    await admin.saveTrip();
    const page = TestBed.createComponent(ProductDetailComponent);
    page.detectChanges();
    params.next(convertToParamMap({ slug: 'gramado-e-canela' }));
    expectSharingImage(sharing, 'product');
    const edit = tripAdmin();
    edit.tripForm.patchValue({ ogImage: null });
    await edit.saveTrip();
    params.next(convertToParamMap({ slug: 'gramado-e-canela' }));
    page.detectChanges();
    expectSharingImage(cover, 'product');
  });

  it('post: upload salvo chega à página pública e a remoção restaura a imagem destacada', async () => {
    const admin = postAdmin();
    const file = new File(['imagem'], 'compartilhamento.jpg', { type: 'image/jpeg' });
    admin.postForm.patchValue({ ogImage: file });
    await admin.onSubmit();
    expect(uploads.uploadToEntity).toHaveBeenCalledWith(file, 'posts', 456);
    const page = TestBed.createComponent(BlogDetailComponent);
    page.detectChanges();
    params.next(convertToParamMap({ slug: 'conheca-gramado' }));
    page.detectChanges();
    expectSharingImage(sharing, 'article');
    expect(page.nativeElement.querySelector('h1').textContent).toContain('Conheça Gramado');
    const edit = postAdmin();
    edit.postForm.patchValue({ ogImage: null });
    await edit.onSubmit();
    params.next(convertToParamMap({ slug: 'conheca-gramado' }));
    page.detectChanges();
    expectSharingImage(cover, 'article');
  });
});
