import { describe, expect, it } from 'vitest';
import { extractVideoEmbeds, normalizePostHtml, safeVideoEmbedUrl } from './post-content';

describe('post-content', () => {
  it('aceita só embeds do YouTube e do Vimeo', () => {
    expect(safeVideoEmbedUrl('https://www.youtube.com/embed/2fpwUu_NnGU?feature=oembed'))
      .toBe('https://www.youtube.com/embed/2fpwUu_NnGU');
    expect(safeVideoEmbedUrl('https://player.vimeo.com/video/123456')).toBe('https://player.vimeo.com/video/123456');
    expect(safeVideoEmbedUrl('https://www.unitur.com.br/roteiro/embed/#?secret=abc')).toBeNull();
    expect(safeVideoEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(safeVideoEmbedUrl('https://evil.example/embed/2fpwUu_NnGU')).toBeNull();
  });

  it('troca vídeos permitidos por marcadores e remove os demais iframes', () => {
    const { html, embeds } = extractVideoEmbeds(
      '<p>Antes</p>' +
      '<iframe title="Cart&#227;o &amp; viagem" src="https://www.youtube.com/embed/KzNKaV8P4aQ" width="560"></iframe>' +
      '<iframe class="wp-embedded-content" style="position: absolute; visibility: hidden;" src="https://www.unitur.com.br/x/embed/"></iframe>'
    );

    expect(html).toBe('<p>Antes</p><p>[[unitur-embed-0]]</p>');
    expect(embeds).toHaveLength(1);
    expect(embeds[0]).toContain('src="https://www.youtube.com/embed/KzNKaV8P4aQ"');
    expect(embeds[0]).toContain('title="Cartão &amp; viagem"');
  });

  it('converte texto puro legado em parágrafos', () => {
    expect(normalizePostHtml('Linha 1\nLinha 2\n\nSegundo & parágrafo'))
      .toBe('<p>Linha 1<br>Linha 2</p><p>Segundo &amp; parágrafo</p>');
  });
});
