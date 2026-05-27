import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ImageCroppedEvent, ImageCropperComponent, ImageTransform, LoadedImage } from 'ngx-image-cropper';

@Component({
  selector: 'app-image-cropper-modal',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  templateUrl: './image-cropper-modal.component.html',
  styleUrl: './image-cropper-modal.component.scss'
})
export class ImageCropperModalComponent implements OnInit {
  @Input() file!: File;
  @Input() aspectRatio?: number;
  @Input() title = 'Ajustar imagem';
  @Output() confirmed = new EventEmitter<File>();
  @Output() cancelled = new EventEmitter<void>();

  imageFile?: File;
  cropped?: Blob | null;
  loading = true;
  transform: ImageTransform = { scale: 1 };
  maintainAspectRatio = false;

  ngOnInit(): void {
    this.imageFile = this.file;
    this.maintainAspectRatio = !!this.aspectRatio && this.aspectRatio > 0;
  }

  onImageCropped(event: ImageCroppedEvent) {
    this.cropped = event.blob ?? null;
  }

  onImageLoaded(_image: LoadedImage) {
    this.loading = false;
  }

  onLoadFailed() {
    this.loading = false;
    this.cancelled.emit();
  }

  zoomIn() {
    this.transform = { ...this.transform, scale: Math.min(4, (this.transform.scale || 1) + 0.1) };
  }

  zoomOut() {
    this.transform = { ...this.transform, scale: Math.max(0.2, (this.transform.scale || 1) - 0.1) };
  }

  resetZoom() {
    this.transform = { scale: 1 };
  }

  toggleRatio() {
    this.maintainAspectRatio = !this.maintainAspectRatio;
  }

  cancel() {
    this.cancelled.emit();
  }

  async confirm() {
    if (!this.cropped) {
      this.cancelled.emit();
      return;
    }

    const original = this.file;
    const ext = (original.name.split('.').pop() || 'jpg').toLowerCase();
    const baseName = original.name.replace(/\.[^.]+$/, '') || 'imagem';
    const cropped = new File([this.cropped], `${baseName}-crop.${ext}`, {
      type: this.cropped.type || original.type || 'image/jpeg',
      lastModified: Date.now()
    });

    this.confirmed.emit(cropped);
  }
}
