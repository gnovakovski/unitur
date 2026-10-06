import { describe, expect, it } from 'vitest';
import { DEFAULT_POST_AUTHOR, isInstitutionalAuthor, isPlaceholderAuthor, postAuthorName } from './post-author';

describe('post-author', () => {
  it('troca o antigo "Administrador" (e autor vazio) pela assinatura padrão', () => {
    expect(postAuthorName({ author: { id: 1, name: 'Administrador' } })).toBe(DEFAULT_POST_AUTHOR);
    expect(postAuthorName({ author: { id: 1, name: '' } })).toBe(DEFAULT_POST_AUTHOR);
    expect(postAuthorName(null)).toBe(DEFAULT_POST_AUTHOR);
  });

  it('mantém nomes reais', () => {
    expect(postAuthorName({ author: { id: 7, name: 'Cibele Lana' } })).toBe('Cibele Lana');
    expect(isPlaceholderAuthor('Cibele Lana')).toBe(false);
  });

  it('identifica assinaturas institucionais', () => {
    expect(isInstitutionalAuthor('Equipe Unitur')).toBe(true);
    expect(isInstitutionalAuthor('Unitur')).toBe(true);
    expect(isInstitutionalAuthor('Teresa Breda')).toBe(false);
  });
});
