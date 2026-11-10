import { describe, expect, it } from 'vitest';
import { TrailingSlashUrlSerializer, addTrailingSlash, stripTrailingSlash } from './trailing-slash-url-serializer';

describe('TrailingSlashUrlSerializer', () => {
  const serializer = new TrailingSlashUrlSerializer();

  it('acrescenta a barra final ao serializar', () => {
    expect(serializer.serialize(serializer.parse('/blog/meu-post'))).toBe('/blog/meu-post/');
    expect(serializer.serialize(serializer.parse('/viagens?destination=italia'))).toBe('/viagens/?destination=italia');
    expect(serializer.serialize(serializer.parse('/'))).toBe('/');
  });

  it('lê URLs com barra final sem criar segmento vazio', () => {
    const tree = serializer.parse('/roteiros-internacionais/italia-rota-de-fe-e-arte/');
    const segments = tree.root.children['primary'].segments.map(segment => segment.path);
    expect(segments).toEqual(['roteiros-internacionais', 'italia-rota-de-fe-e-arte']);
  });

  it('é estável: parse + serialize de uma URL com barra devolve a mesma URL', () => {
    for (const url of ['/blog/', '/blog/page/2/', '/viagens/viagens-culturais/', '/admin/posts/1/editar/']) {
      expect(serializer.serialize(serializer.parse(url))).toBe(url);
    }
  });

  it('não mexe em arquivos nem na raiz', () => {
    expect(addTrailingSlash('/sitemap.xml')).toBe('/sitemap.xml');
    expect(addTrailingSlash('/')).toBe('/');
    expect(stripTrailingSlash('/')).toBe('/');
    expect(stripTrailingSlash('/blog/x/#comentarios')).toBe('/blog/x#comentarios');
  });
});
