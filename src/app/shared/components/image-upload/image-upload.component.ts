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
  @Output() uploaded = new EventEmitter<string>();

  imageUrl: string | null = null;
  uploading = false;
  error: string | null = null;
  dragOver = false;

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private uploadService: UploadService) {}

  writeValue(value: string | null): void {
    this.imageUrl = value;
  }

  registerOnChange(fn: (value: string | null) => void): void {
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

    // Preview local
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imageUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Upload
    this.uploading = true;
    this.uploadService.uploadImage(file).subscribe({
      next: (response) => {
        this.imageUrl = response.url;
        this.onChange(response.url);
        this.uploaded.emit(response.url);
        this.uploading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erro ao fazer upload';
        this.uploading = false;
        this.imageUrl = null;
      }
    });
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
    const input = document.getElementById('file-input') as HTMLInputElement;
    input?.click();
  }
}
