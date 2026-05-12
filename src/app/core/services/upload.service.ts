import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { FirebaseService } from './firebase.service';

export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  constructor(private firebaseService: FirebaseService) {}

  uploadImage(file: File): Observable<UploadResponse> {
    const filename = this.getFilename(file);
    const imageRef = ref(this.firebaseService.storage, `uploads/${filename}`);

    return from(this.uploadToStorage(imageRef, file, filename));
  }

  uploadMultipleImages(files: File[]): Observable<UploadResponse[]> {
    return from(Promise.all(files.map(file => {
      const filename = this.getFilename(file);
      const imageRef = ref(this.firebaseService.storage, `uploads/${filename}`);

      return this.uploadToStorage(imageRef, file, filename);
    })));
  }

  deleteImage(url: string): Observable<void> {
    if (url.startsWith('data:')) {
      return from(Promise.resolve());
    }

    return from(deleteObject(ref(this.firebaseService.storage, url)));
  }

  validateImage(file: File): { valid: boolean; error?: string } {
    const maxSize = 2 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Formato nao suportado. Use JPG, PNG ou WebP.' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Imagem muito grande. Maximo 2MB.' };
    }

    return { valid: true };
  }

  private async uploadToStorage(imageRef: ReturnType<typeof ref>, file: File, filename: string): Promise<UploadResponse> {
    const snapshot = await uploadBytes(imageRef, file, {
      contentType: file.type
    });

    return {
      url: await getDownloadURL(snapshot.ref),
      filename,
      size: file.size,
      mimetype: file.type
    };
  }

  private getFilename(file: File): string {
    return `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;
  }
}
