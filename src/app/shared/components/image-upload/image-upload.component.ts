import { Component, Input, Output, EventEmitter, forwardRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UploadService } from '../../../core/services/upload.service';
import { ImageCropperModalComponent } from '../image-cropper-modal/image-cropper-modal.component';
import { ImageLibraryModalComponent } from '../image-library-modal/image-library-modal.component';
import { LibraryImage } from '../../../core/services/image-library.service';

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [CommonModule, ImageCropperModalComponent, ImageLibraryModalComponent],
  templateUrl: './image-upload.component.html',
  styleUrl: './image-upload.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ImageUploadComponent),
      multi: true
    }
  ]
})
export class ImageUploadComponent implements ControlValueAccessor, OnDestroy {
  @Input() label = 'Imagem';
  @Input() helper = '';
  @Input() accept = 'image/jpeg,image/jpg,image/png,image/webp';
  @Input() maxSize = 5; // MB
  @Input() aspectRatio: 'wide' | 'square' | 'portrait' | 'auto' = 'wide';
  @Input() compact = false;
  @Input() cropRatio?: number;
  @Input() enableCrop = true;
  /** Mostra o botão "Escolher do banco de imagens" (fotos já enviadas nas viagens). */
  @Input() libraryEnabled = false;
  @Output() uploaded = new EventEmitter<File>();

  libraryOpen = false;
  pendingFile: File | null = null;

  imageUrl: string | null = null;
  selectedFileName: string | null = null;
  selectedFileSize: number | null = null;
  imagePath: string | null = null;
  isLocalFile = false;
  uploading = false;
  error: string | null = null;
  dragOver = false;
  inputId = `image-upload-${Math.random().toString(36).slice(2)}`;

  private onChange: (value: string | File | null) => void = () => {};
  private onTouched: () => void = () => {};
  private objectUrl: string | null = null;

  constructor(private uploadService: UploadService) {}

  writeValue(value: string | File | null): void {
    if (value instanceof File) {
      this.setSelectedFile(value);
      return;
    }

    this.clearObjectUrl();
    this.imageUrl = value;
    this.imagePath = value || null;
    this.isLocalFile = false;
    this.selectedFileName = value ? this.getFileNameFromUrl(value) : null;
    this.selectedFileSize = null;
  }

  registerOnChange(fn: (value: string | File | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onFileSelected(event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.handleFile(input.files[0]);
    }

    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  private handleFile(file: File): void {
    this.error = null;

    const validation = this.uploadService.validateImage(file);
    if (!validation.valid) {
      this.error = validation.error || 'Arquivo inválido';
      return;
    }

    if (this.enableCrop) {
      this.pendingFile = file;
      return;
    }

    this.acceptFile(file);
  }

  onCropConfirmed(file: File) {
    this.pendingFile = null;
    this.acceptFile(file);
  }

  onCropCancelled() {
    this.pendingFile = null;
  }

  getCropRatio(): number | undefined {
    if (this.cropRatio) return this.cropRatio;
    if (this.aspectRatio === 'wide') return 16 / 9;
    if (this.aspectRatio === 'square') return 1;
    if (this.aspectRatio === 'portrait') return 4 / 5;
    return undefined;
  }

  private acceptFile(file: File) {
    this.setSelectedFile(file);
    this.onChange(file);
    this.uploaded.emit(file);
    this.onTouched();
  }

  removeImage(event?: Event): void {
    event?.stopPropagation();
    this.imageUrl = null;
    this.selectedFileName = null;
    this.selectedFileSize = null;
    this.imagePath = null;
    this.isLocalFile = false;
    this.clearObjectUrl();
    this.onChange(null);
    this.error = null;
  }

  openLibrary(event?: Event): void {
    event?.stopPropagation();
    if (this.uploading) return;
    this.error = null;
    this.libraryOpen = true;
  }

  /** Foto escolhida no banco: vira o valor do campo como endereço pronto, sem upload. */
  onLibraryConfirmed(images: LibraryImage[]): void {
    this.libraryOpen = false;
    const url = images[0]?.url;
    if (!url) return;
    this.writeValue(url);
    this.onChange(url);
    this.onTouched();
  }

  replaceImage(event?: Event): void {
    event?.stopPropagation();
    this.triggerFileInput();
  }

  triggerFileInput(event?: MouseEvent | Event): void {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (this.uploading) {
      return;
    }

    const input = document.getElementById(this.inputId) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    // Reseta o value para que o mesmo arquivo possa ser selecionado novamente
    // e para garantir que o evento `change` sempre dispare.
    input.value = '';
    input.click();
  }

  ngOnDestroy(): void {
    this.clearObjectUrl();
  }

  formatSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private setSelectedFile(file: File): void {
    this.clearObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.imageUrl = this.objectUrl;
    this.selectedFileName = file.name;
    this.selectedFileSize = file.size;
    this.imagePath = null;
    this.isLocalFile = true;
    this.error = null;
  }

  private clearObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private getFileNameFromUrl(value: string): string {
    try {
      const url = new URL(value);
      const storageName = url.searchParams.get('name');
      const path = storageName || url.pathname;
      const fileName = decodeURIComponent(path.split('/').pop() || '');
      return fileName || 'Imagem cadastrada';
    } catch {
      return 'Imagem cadastrada';
    }
  }
}
