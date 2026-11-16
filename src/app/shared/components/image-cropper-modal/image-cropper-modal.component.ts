import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ImageCroppedEvent, ImageCropperComponent, ImageTransform, LoadedImage } from 'ngx-image-cropper';

@Component({
  selector: 'app-image-cropper-modal',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  templateUrl: './image-cropper-modal.component.html',
  styleUrl: './image-cropper-modal.component.scss'
})
export class ImageCropperModalComponent implements OnChanges {
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

  /**
   * Roda na abertura e também a cada troca de `file`.
   *
   * Ao enviar várias fotos de uma vez, quem usa esta janela a mantém aberta e só
   * troca o arquivo (fila de recorte). Antes o arquivo era lido uma única vez,
   * na criação: a janela continuava mostrando a 1ª foto e devolvia o recorte
   * dela para todas as seguintes — a galeria ficava com a mesma foto repetida.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['file']) {
      this.imageFile = this.file;
      // Zera o recorte da foto anterior: o botão "Aplicar recorte" só volta a
      // ficar ativo quando a foto nova terminar de carregar.
      this.cropped = null;
      this.loading = true;
      this.transform = { scale: 1 };
    }
    if (changes['aspectRatio']?.firstChange || changes['file']?.firstChange) {
      this.maintainAspectRatio = !!this.aspectRatio && this.aspectRatio > 0;
    }
  }

  onImageCropped(event: ImageCroppedEvent) {
    // Enquanto a foto nova carrega, um recorte que chegue atrasado só pode ser da
    // foto anterior da fila (o recorte em blob é assíncrono): descarta, para não
    // repetir a foto anterior no lugar desta.
    if (this.loading) return;
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
