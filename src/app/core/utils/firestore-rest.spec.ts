import { describe, expect, it } from 'vitest';
import { decodeRestFields } from './firestore-rest';

describe('firestore-rest', () => {
  it('converte os tipos do Firestore REST para valores JS', () => {
    const decoded = decodeRestFields({
      title: { stringValue: 'Fátima' },
      categoryId: { integerValue: '12' },
      status: { stringValue: 'published' },
      publishedAt: { timestampValue: '2026-11-06T18:50:00Z' },
      tags: { arrayValue: { values: [{ stringValue: 'portugal' }, { stringValue: 'fé' }] } },
      emptyTags: { arrayValue: {} },
      category: { mapValue: { fields: { id: { integerValue: '12' }, name: { stringValue: 'Portugal' } } } },
      featuredImage: { nullValue: null },
      destaque: { booleanValue: true }
    });

    expect(decoded['title']).toBe('Fátima');
    expect(decoded['categoryId']).toBe(12);
    expect(decoded['publishedAt']).toEqual(new Date('2026-11-06T18:50:00Z'));
    expect(decoded['tags']).toEqual(['portugal', 'fé']);
    expect(decoded['emptyTags']).toEqual([]);
    expect(decoded['category']).toEqual({ id: 12, name: 'Portugal' });
    expect(decoded['featuredImage']).toBeNull();
    expect(decoded['destaque']).toBe(true);
  });
});
