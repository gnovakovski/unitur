import { Component, OnInit } from '@angular/core';
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
import { firstValueFrom, timeout } from 'rxjs';

@Component({
  selector: 'app-post-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageUploadComponent],
  templateUrl: './post-form.component.html',
  styleUrl: './post-form.component.scss'
})
export class PostFormComponent implements OnInit {
  postForm: FormGroup;
  categories: Category[] = [];
  trips: Trip[] = [];
  loading = false;
  saving = false;
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
    private route: ActivatedRoute
  ) {
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
      status: ['draft', [Validators.required]]
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
          status: post.status
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erro ao carregar post';
        this.loading = false;
        console.error(err);
      }
    });
  }

  loadCategories() {
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories.filter(c => c.type === 'blog' || c.type === 'both');
      },
      error: (err) => console.error('Erro ao carregar categorias', err)
    });
  }

  loadTrips() {
    this.tripService.getTrips({ limit: 100 }).subscribe({
      next: (response) => {
        this.trips = response.data;
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
    this.error = null;

    try {
      const formValue = this.postForm.value;
      const { contentImagesText, contentImageUpload, ...baseValue } = formValue;
      const uploadedContentImage = await this.uploadOptionalImage(contentImageUpload);
      const postData: Partial<Post> = {
        ...baseValue,
        featuredImage: await this.uploadImageValue(baseValue.featuredImage),
        tags: formValue.tags ? formValue.tags.split(',').map((t: string) => t.trim()) : [],
        relatedTrips: (formValue.relatedTrips || []).map((id: string | number) => Number(id)).filter(Boolean).slice(0, 3),
        contentImages: [
          ...this.parseLines(contentImagesText),
          uploadedContentImage
        ].filter(Boolean) as string[]
      };

      const request = this.isEditMode && this.postId
        ? this.postService.updatePost(this.postId, postData)
        : this.postService.createPost(postData);

      await firstValueFrom(request);
      this.router.navigate(['/admin/posts']);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Erro ao salvar post';
      console.error(err);
    } finally {
      this.saving = false;
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

  private async uploadImageValue(value: unknown): Promise<string> {
    if (value instanceof File) {
      return (await firstValueFrom(this.uploadService.uploadImage(value).pipe(timeout(30000)))).url;
    }

    return String(value || '');
  }

  private async uploadOptionalImage(value: unknown): Promise<string> {
    if (!value) {
      return '';
    }

    return this.uploadImageValue(value);
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
