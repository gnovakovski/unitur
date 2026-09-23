import { describe, expect, it } from 'vitest';
import { Post } from '../models/post.model';
import { BrowserStorageService } from './browser-storage.service';
import { FirebaseService } from './firebase.service';
import { PostService } from './post.service';

function post(id: number, title: string, createdAt: string, publishedAt?: string): Post {
  return {
    id,
    title,
    slug: title.toLowerCase(),
    content: 'Conteúdo de teste com mais de cinquenta caracteres para validação.',
    excerpt: 'Resumo',
    categoryId: 1,
    tags: [],
    status: 'published',
    publishedAt: publishedAt ? new Date(publishedAt) : undefined,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    author: { id: 1, name: 'Teste' }
  };
}

describe('PostService ordering', () => {
  const service = new PostService({} as FirebaseService, {} as BrowserStorageService);
  const applyFilters = (items: Post[], filters: object) =>
    (service as unknown as { applyClientFilters(posts: Post[], filters: object): Post[] })
      .applyClientFilters(items, filters);

  const posts = [
    post(1, 'Post antigo', '2024-01-01', '2024-03-01'),
    post(2, 'Post novo', '2023-01-01', '2025-06-01'),
    post(3, 'Sem data de publicação', '2025-01-01')
  ];

  it('ordena por publicação mais recente e usa cadastro como fallback', () => {
    expect(applyFilters(posts, {}).map(item => item.id)).toEqual([2, 3, 1]);
  });

  it('permite ordenar da publicação mais antiga para a mais recente', () => {
    expect(applyFilters(posts, { sortBy: 'publishedAt', sortDirection: 'asc' }).map(item => item.id))
      .toEqual([1, 3, 2]);
  });

  it('ordena alfabeticamente sem considerar acentos e caixa', () => {
    expect(applyFilters(posts, { sortBy: 'title', sortDirection: 'asc' }).map(item => item.title))
      .toEqual(['Post antigo', 'Post novo', 'Sem data de publicação']);
  });
});
