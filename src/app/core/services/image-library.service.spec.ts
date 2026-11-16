import { describe, expect, it } from 'vitest';
import { buildImageLibrary, normalizeLibrarySearch } from './image-library.service';

const url = (name: string) => `https://firebasestorage.googleapis.com/v0/b/x/o/viagens%2F${name}?alt=media`;

describe('buildImageLibrary', () => {
  it('reúne galeria, capa e hotéis de todas as viagens', () => {
    const library = buildImageLibrary([
      {
        title: 'Terra Santa',
        country: 'Israel',
        mainImage: url('capa.jpg'),
        experienceImages: [url('a.jpg'), url('b.jpg')],
        hotels: [{ name: 'Hotel Galilee', image: url('hotel.jpg') }]
      }
    ]);

    expect(library.map(image => image.url)).toEqual([url('a.jpg'), url('b.jpg'), url('capa.jpg'), url('hotel.jpg')]);
    expect(library.find(image => image.url === url('capa.jpg'))?.kinds).toEqual(['cover']);
    expect(library.find(image => image.url === url('hotel.jpg'))).toMatchObject({ kinds: ['hotel'], hotelName: 'Hotel Galilee' });
  });

  it('não repete a foto usada em várias viagens e lista todas elas', () => {
    const library = buildImageLibrary([
      { title: 'Viagem A', updatedAt: new Date('2026-01-01'), experienceImages: [url('fatima.jpg')] },
      { title: 'Viagem B', updatedAt: new Date('2026-06-01'), experienceImages: [url('fatima.jpg')], mainImage: url('fatima.jpg') }
    ]);

    expect(library).toHaveLength(1);
    // A viagem mexida mais recentemente vem primeiro.
    expect(library[0].trips).toEqual(['Viagem B', 'Viagem A']);
    expect(library[0].kinds).toEqual(['gallery', 'cover']);
  });

  it('mostra primeiro as fotos das viagens mais recentes', () => {
    const library = buildImageLibrary([
      { title: 'Antiga', updatedAt: '2025-01-01T00:00:00Z', experienceImages: [url('antiga.jpg')] },
      { title: 'Nova', updatedAt: '2026-10-01T00:00:00Z', experienceImages: [url('nova.jpg')] }
    ]);

    expect(library.map(image => image.url)).toEqual([url('nova.jpg'), url('antiga.jpg')]);
  });

  it('usa `gallery` nas viagens antigas, sem `experienceImages`', () => {
    const library = buildImageLibrary([{ title: 'Legada', gallery: [url('legada.jpg')] }]);
    expect(library.map(image => image.url)).toEqual([url('legada.jpg')]);
  });

  it('ignora valores que não são endereço de imagem', () => {
    const library = buildImageLibrary([
      {
        title: 'Incompleta',
        mainImage: '',
        experienceImages: ['', null, 42, 'blob:local', url('ok.jpg')],
        hotels: [{ name: 'Sem foto' }, null, { name: 'Com foto', image: url('h.jpg') }]
      }
    ]);

    expect(library.map(image => image.url)).toEqual([url('ok.jpg'), url('h.jpg')]);
  });

  it('guarda o primeiro nome de hotel preenchido', () => {
    const library = buildImageLibrary([
      { title: 'A', updatedAt: '2026-02-01', hotels: [{ name: '', image: url('h.jpg') }] },
      { title: 'B', updatedAt: '2026-01-01', hotels: [{ name: 'Hotel Fátima', image: url('h.jpg') }] }
    ]);

    expect(library[0].hotelName).toBe('Hotel Fátima');
  });

  it('monta o texto de busca sem acentos, com viagem, país e hotel', () => {
    const [image] = buildImageLibrary([
      { title: 'Peregrinação a Fátima', country: 'Portugal', hotels: [{ name: 'Hotel São José', image: url('h.jpg') }] }
    ]);

    expect(image.searchText).toContain('peregrinacao a fatima');
    expect(image.searchText).toContain('portugal');
    expect(image.searchText).toContain('hotel sao jose');
  });
});

describe('normalizeLibrarySearch', () => {
  it('tira acentos, maiúsculas e espaços sobrando', () => {
    expect(normalizeLibrarySearch('  São   Paulo ')).toBe('sao paulo');
  });
});
