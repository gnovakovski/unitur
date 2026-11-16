import { describe, expect, it } from 'vitest';
import { SimpleChange } from '@angular/core';
import { ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';
import { ImageCropperModalComponent } from './image-cropper-modal.component';

const photo = (name: string) => new File([name], name, { type: 'image/jpeg' });
const crop = (content: string) => ({ blob: new Blob([content], { type: 'image/jpeg' }) }) as ImageCroppedEvent;
const loaded = {} as LoadedImage;

function open(modal: ImageCropperModalComponent, file: File, previous?: File) {
  modal.file = file;
  modal.ngOnChanges({ file: new SimpleChange(previous, file, !previous) });
}

describe('ImageCropperModalComponent — fila de várias fotos', () => {
  it('cada foto da fila devolve o próprio recorte, nunca o da anterior', async () => {
    const modal = new ImageCropperModalComponent();
    const sent: File[] = [];
    modal.confirmed.subscribe(file => sent.push(file));

    const first = photo('praia.jpg');
    open(modal, first);
    modal.onImageLoaded(loaded);
    modal.onImageCropped(crop('recorte-praia'));
    await modal.confirm();

    // Troca de foto com a janela aberta (como a galeria faz).
    const second = photo('montanha.jpg');
    open(modal, second, first);
    expect(modal.imageFile).toBe(second);
    expect(modal.cropped).toBeNull();
    expect(modal.loading).toBe(true);

    // Recorte atrasado da foto anterior chega enquanto a nova carrega: descartado.
    modal.onImageCropped(crop('recorte-praia'));
    expect(modal.cropped).toBeNull();

    modal.onImageLoaded(loaded);
    modal.onImageCropped(crop('recorte-montanha'));
    await modal.confirm();

    expect(sent.map(file => file.name)).toEqual(['praia-crop.jpg', 'montanha-crop.jpg']);
    expect(await sent[0].text()).toBe('recorte-praia');
    expect(await sent[1].text()).toBe('recorte-montanha');
  });

  it('zera o zoom ao trocar de foto', () => {
    const modal = new ImageCropperModalComponent();
    const first = photo('a.jpg');
    open(modal, first);
    modal.zoomIn();
    open(modal, photo('b.jpg'), first);
    expect(modal.transform.scale).toBe(1);
  });
});
