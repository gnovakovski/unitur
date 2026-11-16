import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import type { FirebaseStorage } from 'firebase/storage';
import { FirebaseService } from './firebase.service';

export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
  path: string;
}

/** Imagem salva em várias larguras, para o navegador baixar só a do tamanho da tela. */
export interface ResponsiveUploadResponse {
  /** Versão padrão (usada como `src` e nos lugares que não usam srcset). */
  url: string;
  /** Valor pronto para o atributo `srcset` ("url 1280w, url 1920w, ..."). */
  srcset: string;
}

export type EntityType = 'posts' | 'viagens' | 'banners' | 'depoimentos' | 'uploads';

/**
 * Larguras geradas para cada tipo de arte responsiva. A maior cobre telas 4K e
 * Retina, então nenhuma tela recebe imagem menor do que consegue exibir. Nunca
 * se gera versão maior que o original.
 */
export const RESPONSIVE_PRESETS = {
  /** Banner da home (computador): ocupa a largura toda, até 2400 px de CSS. */
  // defaultWidth = maior versão: é a usada onde não há srcset (miniatura do
  // admin, versões antigas do site), então nunca sai com menos qualidade.
  // Com srcset o navegador ignora o `src` e baixa só a versão do tamanho da tela.
  bannerDesktop: { widths: [1280, 1920, 2560, 2880, 3840], defaultWidth: 3840 },
  /** Banner da home (celular/tablet até 768 px de CSS, telas de densidade 2x–3x). */
  bannerMobile: { widths: [640, 1080, 1280, 1536], defaultWidth: 1536 },
} as const;

export type ResponsivePreset = keyof typeof RESPONSIVE_PRESETS;

/** Qualidade JPEG/WebP das versões geradas (visualmente igual ao original). */
const ENCODE_QUALITY = 0.86;

/** Arquivo nunca é sobrescrito (nome com carimbo de tempo): pode ficar em cache 1 ano. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

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
    return from(this.uploadOne(file, this.folderFor(entityType, entityId)));
  }

  /** Upload de várias imagens para a mesma entidade. */
  uploadMultipleToEntity(files: File[], entityType: EntityType, entityId?: number | string): Observable<UploadResponse[]> {
    const folder = this.folderFor(entityType, entityId);
    return from(Promise.all(files.map(file => this.uploadOne(file, folder))));
  }

  uploadMultipleImages(files: File[]): Observable<UploadResponse[]> {
    return this.uploadMultipleToEntity(files, 'uploads');
  }

  /** PDF original, sem conversão, com download direto pelo navegador. */
  uploadTripPdf(file: File, tripId: number | string): Observable<UploadResponse> {
    return from((async () => {
      const validation = await this.validatePdf(file);
      if (!validation.valid) throw new Error(validation.error);
      const filename = this.getFilename(file);
      const path = `${this.folderFor('viagens', tripId)}/${filename}`;
      let url: string;
      try {
        url = await this.putFile(path, file, {
          contentType: 'application/pdf',
          contentDisposition: `attachment; filename="${filename}"`
        });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === 'storage/unauthorized') {
          throw new Error('O Firebase Storage não autorizou o envio do PDF. Confira as regras do Storage para PDFs na pasta viagens e a permissão do usuário. (storage/unauthorized)');
        }
        if (code === 'storage/unauthenticated') {
          throw new Error('Sua sessão de upload expirou. Entre novamente no painel e tente enviar o PDF.');
        }
        throw error;
      }
      return { url, filename: file.name, size: file.size, mimetype: 'application/pdf', path };
    })());
  }

  async validatePdf(file: File): Promise<{ valid: boolean; error?: string }> {
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) {
      return { valid: false, error: 'Selecione um arquivo PDF.' };
    }
    if (file.size > 20 * 1024 * 1024) {
      return { valid: false, error: 'PDF muito grande. Máximo 20 MB.' };
    }
    // Confere também o conteúdo: renomear uma imagem para .pdf não é suficiente.
    const signature = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Não foi possível ler o PDF. Selecione o arquivo novamente.'));
      reader.readAsText(file.slice(0, 5));
    });
    return signature === '%PDF-'
      ? { valid: true }
      : { valid: false, error: 'O arquivo selecionado não contém um PDF válido.' };
  }

  /**
   * Salva a imagem em várias larguras (ver RESPONSIVE_PRESETS) e devolve a URL
   * padrão e o `srcset`. Usado nos banners da home: o celular baixa a versão de
   * celular e um monitor 4K recebe a versão grande, sem perda de qualidade
   * visível em nenhum dos dois.
   *
   * Se o navegador não conseguir processar a imagem (formato não suportado ou
   * falha de memória), faz o upload comum de um arquivo só e devolve srcset
   * vazio, ou seja, o mesmo comportamento de antes.
   */
  uploadResponsiveImage(
    file: File,
    entityType: EntityType,
    entityId: number | string | undefined,
    preset: ResponsivePreset
  ): Observable<ResponsiveUploadResponse> {
    return from(this.uploadResponsive(file, this.folderFor(entityType, entityId), preset));
  }

  deleteImage(url: string): Observable<void> {
    if (!url || url.startsWith('data:')) {
      return from(Promise.resolve());
    }

    return from((async () => {
      const [storage, { ref, deleteObject }] = await Promise.all([
        this.firebaseService.getStorage(),
        import('firebase/storage')
      ]);
      let target;
      try {
        target = ref(storage, url);
      } catch {
        return; // URL que não é do Storage: nada a apagar.
      }
      await deleteObject(target);
    })());
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

  private folderFor(entityType: EntityType, entityId?: number | string): string {
    return entityId !== undefined && entityId !== null && entityId !== ''
      ? `${entityType}/${entityId}`
      : `${entityType}/tmp`;
  }

  private async uploadOne(original: File, folder: string): Promise<UploadResponse> {
    const filename = this.getFilename(original);
    const path = `${folder}/${filename}`;
    const file = await this.optimizeImage(original);
    const url = await this.putFile(path, file);
    return { url, filename, size: file.size, mimetype: file.type, path };
  }

  private async uploadResponsive(file: File, folder: string, presetName: ResponsivePreset): Promise<ResponsiveUploadResponse> {
    const preset = RESPONSIVE_PRESETS[presetName];
    const variants = await this.buildVariants(file, preset.widths);
    if (!variants) {
      const single = await this.uploadOne(file, folder);
      return { url: single.url, srcset: '' };
    }

    // Mesmo carimbo para todas as larguras: fica fácil achar as irmãs no Storage.
    const base = this.getFilename(file).replace(/\.[^.]+$/, '');
    const ext = variants[0].blob.type === 'image/webp' ? 'webp' : variants[0].blob.type === 'image/png' ? 'png' : 'jpg';
    const uploaded = await Promise.all(variants.map(async variant => ({
      width: variant.width,
      url: await this.putFile(`${folder}/${base}-${variant.width}w.${ext}`, variant.blob)
    })));

    const fallback = [...uploaded].reverse().find(item => item.width <= preset.defaultWidth) || uploaded[uploaded.length - 1];
    return {
      url: fallback.url,
      srcset: uploaded.map(item => `${item.url} ${item.width}w`).join(', ')
    };
  }

  private async putFile(path: string, data: Blob, metadata: { contentDisposition?: string; contentType?: string } = {}): Promise<string> {
    const [storage, { ref, uploadBytes, getDownloadURL }] = await Promise.all([
      this.firebaseService.getStorage(),
      import('firebase/storage')
    ]);
    const snapshot = await uploadBytes(ref(storage as FirebaseStorage, path), data, {
      contentType: data.type,
      ...metadata,
      // Sem isto o Storage responde `private, max-age=0` e a imagem é baixada de
      // novo a cada visita.
      cacheControl: IMMUTABLE_CACHE
    });
    return getDownloadURL(snapshot.ref);
  }

  /**
   * Gera as versões de uma foto em cada largura pedida (só as menores que o
   * original; se o original for menor que todas, uma versão no tamanho dele).
   * Devolve null se o navegador não conseguir processar a imagem.
   */
  private async buildVariants(file: File, widths: readonly number[]): Promise<Array<{ width: number; blob: Blob }> | null> {
    // PNG pode ter transparência: segue no upload comum, sem conversão.
    if (!/^image\/(jpe?g|webp)$/i.test(file.type)) return null;
    const bitmap = await this.decode(file);
    if (!bitmap) return null;

    try {
      const targets = widths.filter(width => width < bitmap.width);
      if (targets.length === 0) targets.push(bitmap.width);

      const type = file.type.toLowerCase() === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const variants: Array<{ width: number; blob: Blob }> = [];
      for (const width of targets) {
        const canvas = this.resize(bitmap, width);
        const blob = canvas ? await this.encode(canvas, type) : null;
        if (!blob) return null;
        variants.push({ width, blob });
      }
      return variants;
    } catch {
      return null;
    } finally {
      bitmap.close();
    }
  }

  /**
   * Reduz fotos grandes antes do upload comum (posts, viagens etc.): lado maior
   * até 2560 px e recompressão em qualidade alta. Fotos de banco de imagem
   * chegavam com 3+ MB. Só mexe em JPEG/WebP; PNG costuma ser logo ou arte com
   * transparência e fica como veio. Em qualquer falha, ou se o resultado não
   * ficar menor, envia o arquivo original.
   */
  private async optimizeImage(file: File): Promise<File> {
    const MAX_DIMENSION = 2560;
    const SKIP_BELOW_BYTES = 300 * 1024;

    if (!/^image\/(jpe?g|webp)$/i.test(file.type)) return file;

    const bitmap = await this.decode(file);
    if (!bitmap) return file;

    try {
      const longest = Math.max(bitmap.width, bitmap.height);
      if (longest <= MAX_DIMENSION && file.size <= SKIP_BELOW_BYTES) return file;

      const targetWidth = Math.round(bitmap.width * Math.min(1, MAX_DIMENSION / longest));
      const canvas = this.resize(bitmap, targetWidth);
      const type = file.type.toLowerCase() === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const blob = canvas ? await this.encode(canvas, type) : null;
      if (!blob || blob.size >= file.size) return file;

      return new File([blob], file.name, { type, lastModified: Date.now() });
    } catch {
      return file;
    } finally {
      bitmap.close();
    }
  }

  private async decode(file: File): Promise<ImageBitmap | null> {
    if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
    if (!/^image\/(jpe?g|webp|png)$/i.test(file.type)) return null;
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      return null;
    }
  }

  /**
   * Redimensiona para `width` mantendo a proporção. Reduções grandes (ex.:
   * 6000 → 1280 px) são feitas pela metade a cada passo: reduzir de uma vez só
   * no canvas serrilha e perde nitidez.
   */
  private resize(source: ImageBitmap, width: number): HTMLCanvasElement | null {
    const targetWidth = Math.max(1, Math.round(width));
    const targetHeight = Math.max(1, Math.round(source.height * (targetWidth / source.width)));

    let current: CanvasImageSource = source;
    let currentWidth = source.width;
    let currentHeight = source.height;

    while (currentWidth / 2 >= targetWidth) {
      const step = this.drawScaled(current, Math.round(currentWidth / 2), Math.round(currentHeight / 2));
      if (!step) return null;
      current = step;
      currentWidth = step.width;
      currentHeight = step.height;
    }

    return this.drawScaled(current, targetWidth, targetHeight);
  }

  private drawScaled(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, width, height);
    return canvas;
  }

  private encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
    return new Promise(resolve => canvas.toBlob(resolve, type, ENCODE_QUALITY));
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
