import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PostService } from '../../../core/services/post.service';
import { CategoryService } from '../../../core/services/category.service';
import { TripService } from '../../../core/services/trip.service';
import { Post, Category } from '../../../core/models/post.model';
import { Trip } from '../../../core/models/trip.model';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';

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
          relatedTrips: post.relatedTrips || [],
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

  setupSlugGeneration() {
    this.postForm.get('title')?.valueChanges.subscribe(title => {
      if (title && !this.isEditMode) {
        const slug = this.postService.generateSlug(title);
        this.postForm.patchValue({ slug }, { emitEvent: false });
      }
    });
  }

  onSubmit() {
    if (this.postForm.invalid) {
      this.markFormGroupTouched(this.postForm);
      return;
    }

    this.saving = true;
    this.error = null;

    const formValue = this.postForm.value;
    const { contentImagesText, contentImageUpload, ...baseValue } = formValue;
    const postData: Partial<Post> = {
      ...baseValue,
      tags: formValue.tags ? formValue.tags.split(',').map((t: string) => t.trim()) : []
        ,
      relatedTrips: (formValue.relatedTrips || []).map((id: string | number) => Number(id)).filter(Boolean).slice(0, 3),
      contentImages: this.parseLines(contentImagesText)
    };

    const request = this.isEditMode && this.postId
      ? this.postService.updatePost(this.postId, postData)
      : this.postService.createPost(postData);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/admin/posts']);
      },
      error: (err) => {
        this.error = 'Erro ao salvar post';
        this.saving = false;
        console.error(err);
      }
    });
  }

  onCancel() {
    this.router.navigate(['/admin/posts']);
  }

  onContentImageUploaded(url: string) {
    const current = this.postForm.get('contentImagesText')?.value || '';
    const nextValue = [current, url].filter(Boolean).join('\n');
    this.postForm.patchValue({
      contentImagesText: nextValue,
      contentImageUpload: ''
    });
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
