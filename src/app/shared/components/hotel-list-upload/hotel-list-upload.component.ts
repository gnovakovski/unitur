import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input, OnDestroy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UploadService } from '../../../core/services/upload.service';

export interface HotelItem {
  name: string;
  /** URL no Storage (string) ou File local pendente de upload. */
  image: string | File;
}

@Component({
  selector: 'app-hotel-list-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hotel-list-upload.component.html',
  styleUrl: './hotel-list-upload.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => HotelListUploadComponent),
      multi: true
    }
  ]
})
export class HotelListUploadComponent implements ControlValueAccessor, OnDestroy {
  @Input() label = 'Hotéis';
  @Input() helper = '';
  @Input() accept = 'image/jpeg,image/jpg,image/png,image/webp';
  @Input() maxSize = 5;
  @Input() maxItems = 15;

  items: HotelItem[] = [];
  previews: string[] = [];
  error: string | null = null;
  dragOver = false;
  inputId = `hotel-list-upload-${Math.random().toString(36).slice(2)}`;

  private onChange: (value: HotelItem[]) => void = () => {};
  private onTouched: () => void = () => {};
  private objectUrls: string[] = [];

  constructor(private uploadService: UploadService) {}

  writeValue(value: HotelItem[] | null): void {
    this.releaseObjectUrls();
    this.items = Array.isArray(value) ? value.map(item => ({ ...item })) : [];
    this.previews = this.items.map(item => this.toPreviewUrl(item.image));
  }

  registerOnChange(fn: (value: HotelItem[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.handleFiles(Array.from(input.files));
    }
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    if (event.dataTransfer?.files?.length) {
      this.handleFiles(Array.from(event.dataTransfer.files));
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

  triggerFileInput(event?: Event): void {
    event?.stopPropagation();
    const input = document.getElementById(this.inputId) as HTMLInputElement | null;
    if (!input) return;
    input.value = '';
    input.click();
  }

  remove(index: number, event?: Event): void {
    event?.stopPropagation();
    const removedPreview = this.previews[index];
    this.items.splice(index, 1);
    this.previews.splice(index, 1);
    if (removedPreview && removedPreview.startsWith('blob:')) {
      URL.revokeObjectURL(removedPreview);
      this.objectUrls = this.objectUrls.filter(u => u !== removedPreview);
    }
    this.emit();
  }

  updateName(index: number, name: string): void {
    if (!this.items[index]) return;
    this.items[index] = { ...this.items[index], name };
    this.emit();
  }

  moveUp(index: number, event?: Event): void {
    event?.stopPropagation();
    if (index <= 0) return;
    [this.items[index - 1], this.items[index]] = [this.items[index], this.items[index - 1]];
    [this.previews[index - 1], this.previews[index]] = [this.previews[index], this.previews[index - 1]];
    this.emit();
  }

  moveDown(index: number, event?: Event): void {
    event?.stopPropagation();
    if (index >= this.items.length - 1) return;
    [this.items[index + 1], this.items[index]] = [this.items[index], this.items[index + 1]];
    [this.previews[index + 1], this.previews[index]] = [this.previews[index], this.previews[index + 1]];
    this.emit();
  }

  isLocal(item: HotelItem): boolean {
    return item.image instanceof File;
  }

  ngOnDestroy(): void {
    this.releaseObjectUrls();
  }

  private handleFiles(files: File[]): void {
    this.error = null;
    const remaining = Math.max(0, this.maxItems - this.items.length);
    if (remaining === 0) {
      this.error = `Limite de ${this.maxItems} hotéis atingido.`;
      return;
    }
    const toAdd = files.slice(0, remaining);

    for (const file of toAdd) {
      const validation = this.uploadService.validateImage(file);
      if (!validation.valid) {
        this.error = `${file.name}: ${validation.error}`;
        continue;
      }
      this.items.push({ name: '', image: file });
      const url = URL.createObjectURL(file);
      this.objectUrls.push(url);
      this.previews.push(url);
    }

    if (files.length > remaining) {
      this.error = `Apenas ${remaining} hotel(éis) foram adicionados. Limite: ${this.maxItems}.`;
    }

    this.emit();
    this.onTouched();
  }

  private emit(): void {
    this.onChange(this.items.map(item => ({ ...item })));
  }

  private toPreviewUrl(image: string | File): string {
    if (image instanceof File) {
      const url = URL.createObjectURL(image);
      this.objectUrls.push(url);
      return url;
    }
    return image;
  }

  private releaseObjectUrls(): void {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls = [];
  }
}
