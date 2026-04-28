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
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;
    const imageRef = ref(this.firebaseService.storage, `uploads/${filename}`);

    return from(
      uploadBytes(imageRef, file).then(async snapshot => ({
        url: await getDownloadURL(snapshot.ref),
        filename,
        size: file.size,
        mimetype: file.type
      }))
    );
  }

  uploadMultipleImages(files: File[]): Observable<UploadResponse[]> {
    return from(Promise.all(files.map(file => {
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;
      const imageRef = ref(this.firebaseService.storage, `uploads/${filename}`);

      return uploadBytes(imageRef, file).then(async snapshot => ({
        url: await getDownloadURL(snapshot.ref),
        filename,
        size: file.size,
        mimetype: file.type
      }));
    })));
  }

  deleteImage(url: string): Observable<void> {
    return from(deleteObject(ref(this.firebaseService.storage, url)));
  }

  validateImage(file: File): { valid: boolean; error?: string } {
    const maxSize = 2 * 1024 * 1024; // 2MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Formato não suportado. Use JPG, PNG ou WebP.' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Imagem muito grande. Máximo 2MB.' };
    }

    return { valid: true };
  }
}
