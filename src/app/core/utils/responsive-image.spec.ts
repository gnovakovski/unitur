import { describe, expect, it } from 'vitest';
import { srcsetForImage } from './responsive-image';

const A1280 = 'https://firebasestorage.googleapis.com/v0/b/x/o/banners%2F1%2Fa-1280w.jpg?alt=media&token=1';
const A2560 = 'https://firebasestorage.googleapis.com/v0/b/x/o/banners%2F1%2Fa-2560w.jpg?alt=media&token=2';
const SRCSET = `${A1280} 1280w, ${A2560} 2560w`;

describe('responsive-image', () => {
  it('usa o srcset quando ele é da imagem atual', () => {
    expect(srcsetForImage(SRCSET, A2560)).toBe(SRCSET);
  });

  it('ignora srcset de uma arte antiga (imagem trocada)', () => {
    expect(srcsetForImage(SRCSET, 'https://exemplo.com/nova.jpg')).toBe('');
    expect(srcsetForImage(SRCSET, '')).toBe('');
    expect(srcsetForImage('', A2560)).toBe('');
    expect(srcsetForImage(undefined, A2560)).toBe('');
  });
});
