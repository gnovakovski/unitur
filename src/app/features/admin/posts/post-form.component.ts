import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PostService } from '../../../core/services/post.service';
import { CategoryService } from '../../../core/services/category.service';
import { TripService } from '../../../core/services/trip.service';
import { UploadService } from '../../../core/services/upload.service';
import { Post, Category } from '../../../core/models/post.model';
import { Trip } from '../../../core/models/trip.model';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';
import { SavingOverlayComponent } from '../../../shared/components/saving-overlay/saving-overlay.component';
import { UnsavedChangesModalComponent } from '../../../shared/components/unsaved-changes-modal/unsaved-changes-modal.component';
import { UnsavedFormBase } from '../../../shared/components/unsaved-changes-modal/unsaved-form.base';
import { firstValueFrom, timeout } from 'rxjs';

@Component({
  selector: 'app-post-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageUploadComponent, SavingOverlayComponent, UnsavedChangesModalComponent],
  templateUrl: './post-form.component.html',
  styleUrl: './post-form.component.scss'
})
export class PostFormComponent extends UnsavedFormBase implements OnInit {
  postForm: FormGroup;

  protected fieldLabels: Record<string, string> = {
    title: 'Título',
    slug: 'Slug',
    excerpt: 'Resumo',
    content: 'Conteúdo',
    featuredImage: 'Imagem destacada',
    contentImageUpload: 'Imagem do conteúdo',
    contentImagesText: 'URLs de imagens',
    categoryId: 'Categoria',
    tags: 'Tags',
    relatedTrips: 'Viagens relacionadas',
    status: 'Status',
    metaTitle: 'Meta título (SEO)',
    metaDescription: 'Meta descrição (SEO)',
    ogImage: 'Imagem de compartilhamento (SEO)'
  };

  protected getMainForm(): FormGroup { return this.postForm; }
  protected async triggerSave(): Promise<void> { await this.onSubmit(); }

  categories: Category[] = [];
  trips: Trip[] = [];
  loading = false;
  saving = false;
  savingStep = '';
  error: string | null = null;
  isEditMode = false;
  postId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private postService: PostService,
    private categoryService: CategoryService,
    private tripService: TripService,
    private uploadService: UploadService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    super();
    this.postForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      slug: ['', [Validators.required]],
      excerpt: ['', [Validators.required, Validators.maxLength(200)]],
      content: ['', [Validators.required, Validators.minLength(50)]],
      featuredImage: [''],
      contentImageUpload: [''],
      contentImagesText: [''],
      categoryId: ['', [Validators.required]],
      tags: [''],
      relatedTrips: [[]],
      status: ['draft', [Validators.required]],
      // SEO (opcionais; vazio => fallback automático para title/excerpt/imagem)
      metaTitle: ['', [Validators.maxLength(70)]],
      metaDescription: ['', [Validators.maxLength(160)]],
      ogImage: ['']
    });
  }

  ngOnInit() {
    this.loadCategories();
    this.loadTrips();
    this.setupSlugGeneration();
    this.checkEditMode();
  }

  checkEditMode() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.postId = parseInt(id, 10);
      this.loadPost(this.postId);
    }
  }

  loadPost(id: number) {
    this.loading = true;
    this.postService.getPost(id).subscribe({
      next: (post) => {
        this.postForm.patchValue({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          featuredImage: post.featuredImage || '',
          contentImagesText: (post.contentImages || []).join('\n'),
          categoryId: post.categoryId,
          tags: post.tags.join(', '),
          relatedTrips: (post.relatedTrips || []).map(id => Number(id)).filter(Boolean).slice(0, 3),
          status: post.status,
          metaTitle: post.metaTitle || '',
          metaDescription: post.metaDescription || '',
          ogImage: post.ogImage || ''
        });
        this.postForm.markAsPristine();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = 'Erro ao carregar post';
        this.loading = false;
        this.cdr.markForCheck();
        console.error(err);
      }
    });
  }

  loadCategories() {
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories.filter(c => c.type === 'blog' || c.type === 'both');
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Erro ao carregar categorias', err)
    });
  }

  loadTrips() {
    this.tripService.getTrips({ limit: 100 }).subscribe({
      next: (response) => {
        this.trips = response.data;
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Erro ao carregar viagens', err)
    });
  }

  get selectedRelatedTripIds(): number[] {
    return (this.postForm.get('relatedTrips')?.value || [])
      .map((id: string | number) => Number(id))
      .filter(Boolean);
  }

  isTripSelected(tripId: number): boolean {
    return this.selectedRelatedTripIds.includes(Number(tripId));
  }

  canSelectRelatedTrip(tripId: number): boolean {
    return this.isTripSelected(tripId) || this.selectedRelatedTripIds.length < 3;
  }

  toggleRelatedTrip(tripId: number) {
    const id = Number(tripId);
    const selected = this.selectedRelatedTripIds;
    const next = selected.includes(id)
      ? selected.filter(selectedId => selectedId !== id)
      : selected.length < 3
        ? [...selected, id]
        : selected;

    this.postForm.get('relatedTrips')?.setValue(next);
    this.postForm.get('relatedTrips')?.markAsDirty();
  }

  setupSlugGeneration() {
    this.postForm.get('title')?.valueChanges.subscribe(title => {
      if (title && !this.isEditMode) {
        const slug = this.postService.generateSlug(title);
        this.postForm.patchValue({ slug }, { emitEvent: false });
      }
    });
  }

  async onSubmit() {
    if (this.postForm.invalid) {
      this.markFormGroupTouched(this.postForm);
      return;
    }

    this.saving = true;
    this.markSaving(true);
    this.error = null;
    this.savingStep = 'Salvando informações...';

    try {
      const formValue = this.postForm.value;
      const { contentImagesText, contentImageUpload, featuredImage, ...baseValue } = formValue;

      const featuredFile = featuredImage instanceof File ? featuredImage : null;
      const contentFile = contentImageUpload instanceof File ? contentImageUpload : null;
      const existingFeatured = featuredImage instanceof File ? '' : String(featuredImage || '');

      const basePostData: Partial<Post> = {
        ...baseValue,
        featuredImage: existingFeatured,
        tags: formValue.tags ? formValue.tags.split(',').map((t: string) => t.trim()) : [],
        relatedTrips: (formValue.relatedTrips || []).map((id: string | number) => Number(id)).filter(Boolean).slice(0, 3),
        contentImages: this.parseLines(contentImagesText)
      };

      const saved = this.isEditMode && this.postId
        ? await firstValueFrom(this.postService.updatePost(this.postId, basePostData))
        : await firstValueFrom(this.postService.createPost(basePostData));

      const postIdToUse = saved?.id || this.postId;

      if ((featuredFile || contentFile) && postIdToUse) {
        this.savingStep = 'Enviando imagens para o Firebase Storage...';
        const updates: Partial<Post> = {};

        try {
          if (featuredFile) {
            const uploaded = await firstValueFrom(
              this.uploadService.uploadToEntity(featuredFile, 'posts', postIdToUse).pipe(timeout(45000))
            );
            updates.featuredImage = uploaded.url;
          }

          if (contentFile) {
            const uploaded = await firstValueFrom(
              this.uploadService.uploadToEntity(contentFile, 'posts', postIdToUse).pipe(timeout(45000))
            );
            updates.contentImages = [...(basePostData.contentImages || []), uploaded.url];
          }

          if (Object.keys(updates).length > 0) {
            await firstValueFrom(this.postService.updatePost(postIdToUse, updates));
          }
        } catch (uploadErr: any) {
          this.error = `Post salvo, mas falhou o upload da imagem: ${uploadErr?.message || 'erro desconhecido'}. Edite o post novamente para tentar enviar a imagem.`;
          console.error('Upload error', uploadErr);
          this.saving = false;
          this.savingStep = '';
          return;
        }
      }

      this.postForm.markAsPristine();
      this.markSaving(false, true);
      this.router.navigate(['/admin/posts']);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Erro ao salvar post';
      console.error(err);
      this.markSaving(false, false);
      throw err;
    } finally {
      this.saving = false;
      this.savingStep = '';
    }
  }

  onCancel() {
    this.router.navigate(['/admin/posts']);
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.postForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.postForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'Campo obrigatório';
      if (field.errors['minlength']) return `Mínimo de ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['maxlength']) return `Máximo de ${field.errors['maxlength'].requiredLength} caracteres`;
    }
    return '';
  }

  private parseLines(value: string): string[] {
    return String(value || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);
  }
}
