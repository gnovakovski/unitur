import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input, OnDestroy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UploadService } from '../../../core/services/upload.service';
import { ImageCropperModalComponent } from '../image-cropper-modal/image-cropper-modal.component';
import { ImageLibraryModalComponent } from '../image-library-modal/image-library-modal.component';
import { LibraryImage } from '../../../core/services/image-library.service';

/**
 * Item da galeria: pode ser uma string (URL já no Storage) ou um File local
 * que ainda será enviado ao Storage quando o form pai salvar.
 */
export type GalleryItem = string | File;

@Component({
  selector: 'app-multi-image-upload',
  standalone: true,
  imports: [CommonModule, ImageCropperModalComponent, ImageLibraryModalComponent],
  templateUrl: './multi-image-upload.component.html',
  styleUrl: './multi-image-upload.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiImageUploadComponent),
      multi: true
    }
  ]
})
export class MultiImageUploadComponent implements ControlValueAccessor, OnDestroy {
  @Input() label = 'Imagens';
  @Input() helper = '';
  @Input() accept = 'image/jpeg,image/jpg,image/png,image/webp';
  @Input() maxSize = 5; // MB
  @Input() maxItems = 20;
  @Input() cropRatio?: number;
  @Input() enableCrop = true;
  /** Mostra o botão "Escolher do banco de imagens" (fotos já enviadas em outras viagens). */
  @Input() libraryEnabled = false;

  libraryOpen = false;
  items: GalleryItem[] = [];
  previews: string[] = [];
  error: string | null = null;
  dragOver = false;
  inputId = `multi-image-upload-${Math.random().toString(36).slice(2)}`;
  cropQueue: File[] = [];
  get currentCropFile(): File | null {
    return this.cropQueue[0] || null;
  }

  private onChange: (value: GalleryItem[]) => void = () => {};
  private onTouched: () => void = () => {};
  private objectUrls: string[] = [];

  constructor(private uploadService: UploadService) {}

  writeValue(value: GalleryItem[] | null): void {
    this.releaseObjectUrls();
    this.items = Array.isArray(value) ? [...value] : [];
    this.previews = this.items.map(item => this.toPreviewUrl(item));
  }

  registerOnChange(fn: (value: GalleryItem[]) => void): void {
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
    // Revoga objectURL se era um File local
    if (removedPreview && removedPreview.startsWith('blob:')) {
      URL.revokeObjectURL(removedPreview);
      this.objectUrls = this.objectUrls.filter(u => u !== removedPreview);
    }
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

  isLocal(item: GalleryItem): boolean {
    return item instanceof File;
  }

  /** Quantas fotos ainda cabem na galeria. */
  get remainingSlots(): number {
    return Math.max(0, this.maxItems - this.items.length);
  }

  /** Fotos que já estão na galeria (a janela do banco as mostra como "já adicionada"). */
  get existingUrls(): string[] {
    return this.items.filter((item): item is string => typeof item === 'string');
  }

  openLibrary(event?: Event): void {
    event?.stopPropagation();
    this.error = null;
    if (this.remainingSlots === 0) {
      this.error = `Limite de ${this.maxItems} imagens atingido.`;
      return;
    }
    this.libraryOpen = true;
  }

  /** Fotos escolhidas no banco: entram como endereço pronto, sem novo upload. */
  onLibraryConfirmed(images: LibraryImage[]): void {
    this.libraryOpen = false;
    const existing = new Set(this.existingUrls);
    for (const image of images) {
      if (this.remainingSlots === 0) break;
      if (existing.has(image.url)) continue;
      existing.add(image.url);
      this.items.push(image.url);
      this.previews.push(image.url);
    }
    this.emit();
    this.onTouched();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  getFileSize(item: GalleryItem): string {
    return item instanceof File ? this.formatSize(item.size) : '';
  }

  ngOnDestroy(): void {
    this.releaseObjectUrls();
  }

  private handleFiles(files: File[]): void {
    this.error = null;
    const remaining = Math.max(0, this.maxItems - this.items.length);
    if (remaining === 0) {
      this.error = `Limite de ${this.maxItems} imagens atingido.`;
      return;
    }
    const toAdd = files.slice(0, remaining);
    const validFiles: File[] = [];

    for (const file of toAdd) {
      const validation = this.uploadService.validateImage(file);
      if (!validation.valid) {
        this.error = `${file.name}: ${validation.error}`;
        continue;
      }
      validFiles.push(file);
    }

    if (files.length > remaining) {
      this.error = `Apenas ${remaining} imagem(ns) foram adicionadas. Limite: ${this.maxItems}.`;
    }

    if (this.enableCrop && validFiles.length) {
      this.cropQueue = [...this.cropQueue, ...validFiles];
      this.onTouched();
      return;
    }

    for (const file of validFiles) {
      this.addFile(file);
    }
    this.emit();
    this.onTouched();
  }

  onCropConfirmed(file: File) {
    this.addFile(file);
    this.cropQueue = this.cropQueue.slice(1);
    this.emit();
  }

  onCropCancelled() {
    this.cropQueue = this.cropQueue.slice(1);
  }

  private addFile(file: File) {
    this.items.push(file);
    const url = URL.createObjectURL(file);
    this.objectUrls.push(url);
    this.previews.push(url);
  }

  private emit(): void {
    this.onChange([...this.items]);
  }

  private toPreviewUrl(item: GalleryItem): string {
    if (item instanceof File) {
      const url = URL.createObjectURL(item);
      this.objectUrls.push(url);
      return url;
    }
    return item;
  }

  private releaseObjectUrls(): void {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls = [];
  }
}
