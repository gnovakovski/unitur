import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
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
export class ImageUploadComponent implements ControlValueAccessor {
  @Input() label = 'Imagem';
  @Input() accept = 'image/jpeg,image/jpg,image/png,image/webp';
  @Input() maxSize = 2; // MB
  @Output() uploaded = new EventEmitter<File>();

  imageUrl: string | null = null;
  uploading = false;
  error: string | null = null;
  dragOver = false;
  inputId = `image-upload-${Math.random().toString(36).slice(2)}`;

  private onChange: (value: string | File | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private uploadService: UploadService) {}

  writeValue(value: string | File | null): void {
    if (value instanceof File) {
      this.setPreview(value);
      return;
    }

    this.imageUrl = value;
  }

  registerOnChange(fn: (value: string | File | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.handleFile(input.files[0]);
    }
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

    this.setPreview(file);
    this.onChange(file);
    this.uploaded.emit(file);
    this.onTouched();
  }

  removeImage(): void {
    if (this.imageUrl) {
      // Opcional: deletar do servidor
      // this.uploadService.deleteImage(this.imageUrl).subscribe();
      
      this.imageUrl = null;
      this.onChange(null);
      this.error = null;
    }
  }

  triggerFileInput(): void {
    const input = document.getElementById(this.inputId) as HTMLInputElement;
    input?.click();
  }

  private setPreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imageUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}
