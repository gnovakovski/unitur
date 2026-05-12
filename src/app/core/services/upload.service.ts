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

  private async uploadToStorage(imageRef: ReturnType<typeof ref>, file: File, filename: string, path: string): Promise<UploadResponse> {
    const snapshot = await uploadBytes(imageRef, file, {
      contentType: file.type
    });

    return {
      url: await getDownloadURL(snapshot.ref),
      filename,
      size: file.size,
      mimetype: file.type,
      path
    };
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
