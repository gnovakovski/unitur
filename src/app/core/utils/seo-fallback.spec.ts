import { describe, expect, it } from 'vitest';
import { tripMetaDescription, truncateForMeta } from './seo-fallback';

describe('truncateForMeta', () => {
  it('remove HTML e espaços repetidos', () => {
    expect(truncateForMeta('<p>Roteiro   pela <strong>Itália</strong></p>')).toBe('Roteiro pela Itália');
  });

  it('corta em ~160 caracteres sem quebrar palavra', () => {
    const result = truncateForMeta('palavra '.repeat(40));
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toMatch(/palavr…$/);
  });
});

describe('tripMetaDescription', () => {
  const description = '    • Alpes Suíços: uma imersão completa nas montanhas.\n    • Trens panorâmicos entre lagos e vales.';

  it('prefere a meta description cadastrada', () => {
    expect(tripMetaDescription({ metaDescription: ' Texto do admin ', shortDescription: 'x', description }))
      .toBe('Texto do admin');
  });

  it('completa a chamada curta (só a data) com o começo da descrição', () => {
    expect(tripMetaDescription({ shortDescription: '21/04/27 a 01/05/27 - 11 dias', description }))
      .toBe('21/04/27 a 01/05/27 - 11 dias. Alpes Suíços: uma imersão completa nas montanhas. Trens panorâmicos entre lagos e vales.');
  });

  it('usa a chamada curta sozinha quando ela já descreve a viagem', () => {
    const short = 'Peregrinação pelos santuários marianos de Portugal, Espanha e França, com guia espiritual.';
    expect(tripMetaDescription({ shortDescription: short, description })).toBe(short);
  });

  it('não repete a pontuação ao juntar os dois textos', () => {
    expect(tripMetaDescription({ shortDescription: 'Saída em abril.', description: 'Roteiro completo.' }))
      .toBe('Saída em abril. Roteiro completo.');
  });

  it('funciona sem chamada curta ou sem descrição', () => {
    expect(tripMetaDescription({ shortDescription: '', description: 'Roteiro completo.' })).toBe('Roteiro completo.');
    expect(tripMetaDescription({ shortDescription: '11 dias', description: '' })).toBe('11 dias');
    expect(tripMetaDescription({})).toBe('');
  });
});
