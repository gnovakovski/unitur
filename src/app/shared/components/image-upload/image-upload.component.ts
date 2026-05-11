import { Component, Input, Output, EventEmitter, forwardRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UploadService } from '../../../core/services/upload.service';

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [CommonModule],
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
  @Input() accept = 'image/jpeg,image/jpg,image/png,image/webp';
  @Input() maxSize = 2; // MB
  @Output() uploaded = new EventEmitter<File>();

  imageUrl: string | null = null;
  selectedFileName: string | null = null;
  imagePath: string | null = null;
  isLocalFile = false;
  uploading = false;
  error: string | null = null;
  dragOver = false;
  inputId = `image-upload-${Math.random().toString(36).slice(2)}`;

  private onChange: (value: string | File | null) => void = () => {};
  private onTouched: () => void = () => {};
  private openingFilePicker = false;
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
    setTimeout(() => {
      this.openingFilePicker = false;
    }, 800);
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

    // Validação
    const validation = this.uploadService.validateImage(file);
    if (!validation.valid) {
      this.error = validation.error || 'Arquivo inválido';
      return;
    }

    this.setSelectedFile(file);
    this.onChange(file);
    this.uploaded.emit(file);
    this.onTouched();
  }

  removeImage(): void {
    if (this.imageUrl) {
      // Opcional: deletar do servidor
      // this.uploadService.deleteImage(this.imageUrl).subscribe();
      
      this.imageUrl = null;
      this.selectedFileName = null;
      this.imagePath = null;
      this.isLocalFile = false;
      this.clearObjectUrl();
      this.onChange(null);
      this.error = null;
    }
  }

  triggerFileInput(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.openingFilePicker || this.uploading) {
      return;
    }

    this.openingFilePicker = true;
    const input = document.getElementById(this.inputId) as HTMLInputElement;
    input?.click();
    setTimeout(() => {
      this.openingFilePicker = false;
    }, 1200);
  }

  ngOnDestroy(): void {
    this.clearObjectUrl();
  }

  private setSelectedFile(file: File): void {
    this.clearObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.imageUrl = this.objectUrl;
    this.selectedFileName = file.name;
    this.imagePath = null;
    this.isLocalFile = true;
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
