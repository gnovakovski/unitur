import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { FirebaseService } from './firebase.service';

export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
  path: string;
}

export type EntityType = 'posts' | 'viagens' | 'banners' | 'depoimentos' | 'uploads';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  constructor(private firebaseService: FirebaseService) {}

  /** Upload simples para a pasta genérica (compatibilidade). */
  uploadImage(file: File): Observable<UploadResponse> {
    return this.uploadToEntity(file, 'uploads');
  }

  /** Upload vinculado a uma entidade. Salva em `<entityType>/<entityId|tmp>/<filename>`. */
  uploadToEntity(file: File, entityType: EntityType, entityId?: number | string): Observable<UploadResponse> {
    const folder = entityId !== undefined && entityId !== null && entityId !== ''
      ? `${entityType}/${entityId}`
      : `${entityType}/tmp`;
    const filename = this.getFilename(file);
    const path = `${folder}/${filename}`;
    const imageRef = ref(this.firebaseService.storage, path);

    return from(this.uploadToStorage(imageRef, file, filename, path));
  }

  /** Upload de várias imagens para a mesma entidade. */
  uploadMultipleToEntity(files: File[], entityType: EntityType, entityId?: number | string): Observable<UploadResponse[]> {
    return from(Promise.all(files.map(file => {
      const folder = entityId !== undefined && entityId !== null && entityId !== ''
        ? `${entityType}/${entityId}`
        : `${entityType}/tmp`;
      const filename = this.getFilename(file);
      const path = `${folder}/${filename}`;
      const imageRef = ref(this.firebaseService.storage, path);

      return this.uploadToStorage(imageRef, file, filename, path);
    })));
  }

  uploadMultipleImages(files: File[]): Observable<UploadResponse[]> {
    return this.uploadMultipleToEntity(files, 'uploads');
  }

  deleteImage(url: string): Observable<void> {
    if (!url || url.startsWith('data:')) {
      return from(Promise.resolve());
    }

    try {
      return from(deleteObject(ref(this.firebaseService.storage, url)));
    } catch {
      return from(Promise.resolve());
    }
  }

  validateImage(file: File): { valid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Formato não suportado. Use JPG, PNG ou WebP.' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Imagem muito grande. Máximo 5MB.' };
    }

    return { valid: true };
  }

  private async uploadToStorage(imageRef: ReturnType<typeof ref>, original: File, filename: string, path: string): Promise<UploadResponse> {
    const file = await this.optimizeImage(original);
    const snapshot = await uploadBytes(imageRef, file, {
      contentType: file.type,
      // Cada upload ganha um caminho único (carimbo de tempo no nome), então o
      // arquivo nunca é sobrescrito e pode ficar em cache no navegador por 1 ano.
      // Sem isto o Storage responde `private, max-age=0` e a imagem é baixada de
      // novo a cada visita.
      cacheControl: 'public, max-age=31536000, immutable'
    });

    return {
      url: await getDownloadURL(snapshot.ref),
      filename,
      size: file.size,
      mimetype: file.type,
      path
    };
  }

  /**
   * Reduz fotos grandes antes do upload: limita o lado maior a 2048 px e
   * recomprime em qualidade 0,82. Fotos de banco de imagem chegavam com 3+ MB e
   * eram o maior peso da home (o banner é o LCP). Só mexe em JPEG/WebP — PNG
   * costuma ser logo/arte com transparência e fica como veio. Em qualquer falha,
   * ou se o resultado não ficar menor, envia o arquivo original.
   */
  private async optimizeImage(file: File): Promise<File> {
    const MAX_DIMENSION = 2048;
    const QUALITY = 0.82;
    const SKIP_BELOW_BYTES = 300 * 1024;

    if (!/^image\/(jpe?g|webp)$/i.test(file.type)) return file;
    if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      return file;
    }

    try {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size <= SKIP_BELOW_BYTES) return file;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const type = file.type.toLowerCase() === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, QUALITY));
      if (!blob || blob.size >= file.size) return file;

      return new File([blob], file.name, { type, lastModified: Date.now() });
    } catch {
      return file;
    } finally {
      bitmap.close();
    }
  }

  private getFilename(file: File): string {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
    const base = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'imagem';
    const stamp = Date.now().toString(36);
    return ext ? `${stamp}-${base}.${ext.toLowerCase()}` : `${stamp}-${base}`;
  }
}
